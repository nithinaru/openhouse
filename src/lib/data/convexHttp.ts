// Talks to Convex over its public HTTP API (https://docs.convex.dev/http-api/):
//   POST <CONVEX_URL>/api/query | /api/mutation | /api/action
//   body { path: "module:function", args: {...}, format: "json" }
//   -> { status: "success", value, logLines } | { status: "error", errorMessage, errorData?, logLines }
// No convex client needed, so it works the same in Expo Go and offline (calls just fail fast).
// Every call records what it learned in `backendStatus`; nothing here throws into the UI unless
// the caller asks for it (`call`), and the `try*` helpers never throw.

import { FN, type FnKind, type FnName } from './paths';

const FALLBACK_CONVEX_URL = 'https://trustworthy-anteater-9.convex.cloud';
// Must be accessed literally so Expo inlines it at bundle time.
export const CONVEX_URL: string = (process.env.EXPO_PUBLIC_CONVEX_URL || FALLBACK_CONVEX_URL).replace(/\/+$/, '');

export const DEFAULT_TIMEOUT_MS = 8000;

/** What we know about one function path. */
export type FnState = 'ok' | 'missing' | 'error' | 'unreachable';

export type ConvexErrorKind = 'missing' | 'server' | 'network' | 'timeout' | 'bad-response';

export class ConvexCallError extends Error {
  constructor(
    readonly kind: ConvexErrorKind,
    readonly path: string,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ConvexCallError';
  }
}

type ConvexResponse =
  | { status: 'success'; value: unknown; logLines?: string[] }
  | { status: 'error'; errorMessage: string; errorData?: unknown; logLines?: string[] };

// ---------------------------------------------------------------------------------------------
// backendStatus: per-path memory + "is the deployment reachable at all".

type Listener = () => void;

const fnStates = new Map<string, { state: FnState; at: number }>();
const listeners = new Set<Listener>();
let reachable: boolean | undefined; // undefined = not tried yet
const warned = new Set<string>();

function record(path: string, state: FnState): void {
  const prevReachable = reachable;
  const prev = fnStates.get(path)?.state;
  fnStates.set(path, { state, at: Date.now() });
  // A "missing function" or app error still means the deployment answered.
  reachable = state !== 'unreachable';
  if (prev !== state || prevReachable !== reachable) listeners.forEach((l) => l());
}

export const backendStatus = {
  /** Last known state of a path, or undefined if never called. */
  of(path: string): FnState | undefined {
    return fnStates.get(path)?.state;
  },
  /** True once a path has answered "Could not find public function". */
  isMissing(path: string): boolean {
    return fnStates.get(path)?.state === 'missing';
  },
  /** Deployment answered the last request (any answer, even an error). */
  get reachable(): boolean | undefined {
    return reachable;
  },
  /** Reachable and at least the core read path works. */
  get live(): boolean {
    return reachable === true && fnStates.get(FN.tripsList.path)?.state === 'ok';
  },
  /** Should we bother calling `path` now? Missing functions are retried every 30 s (deploys land). */
  worthTrying(path: string): boolean {
    const s = fnStates.get(path);
    if (!s) return true;
    if (s.state === 'missing') return Date.now() - s.at > 30_000;
    if (s.state === 'unreachable') return Date.now() - s.at > 5_000;
    return true;
  },
  snapshot(): Record<string, FnState> {
    return Object.fromEntries([...fnStates].map(([k, v]) => [k, v.state]));
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

function quietLog(path: string, msg: string): void {
  // console.log, not warn/error: Expo Go turns those into LogBox toasts during the demo.
  if (!__DEV__ || warned.has(path + msg)) return;
  warned.add(path + msg);
  console.log(`[openhouse/convex] ${path}: ${msg}`);
}

// ---------------------------------------------------------------------------------------------
// Raw call.

export type CallOptions = { timeoutMs?: number; signal?: AbortSignal };

async function post(kind: FnKind, path: string, args: object, opts: CallOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  let res: Response;
  try {
    res = await fetch(`${CONVEX_URL}/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
      signal: controller.signal,
    });
  } catch (e) {
    record(path, 'unreachable');
    const kindOf: ConvexErrorKind = timedOut ? 'timeout' : 'network';
    quietLog(path, kindOf);
    throw new ConvexCallError(kindOf, path, e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }

  let body: ConvexResponse;
  try {
    body = (await res.json()) as ConvexResponse;
  } catch {
    record(path, res.status >= 500 ? 'unreachable' : 'error');
    throw new ConvexCallError('bad-response', path, `HTTP ${res.status} with a non-JSON body`);
  }

  if (body.status === 'success') {
    record(path, 'ok');
    return body.value;
  }
  const message = body.errorMessage ?? 'Unknown Convex error';
  if (/Could not find public function/i.test(message)) {
    record(path, 'missing');
    quietLog(path, 'not deployed yet, using fallback');
    throw new ConvexCallError('missing', path, message);
  }
  record(path, 'error');
  quietLog(path, message.split('\n').slice(0, 3).join(' '));
  throw new ConvexCallError('server', path, message, body.errorData);
}

/** Throws ConvexCallError. Use when the caller handles failure itself. */
export function call<T>(name: FnName, args: object = {}, opts?: CallOptions): Promise<T> {
  const fn = FN[name];
  return post(fn.kind, fn.path, args, opts) as Promise<T>;
}

export type TryResult<T> = { ok: true; value: T } | { ok: false; error: ConvexCallError };

/** Never throws. Skips the network for paths recently known to be missing or unreachable. */
export async function tryCall<T>(name: FnName, args: object = {}, opts?: CallOptions): Promise<TryResult<T>> {
  const fn = FN[name];
  if (!backendStatus.worthTrying(fn.path)) {
    const state = backendStatus.of(fn.path);
    return {
      ok: false,
      error: new ConvexCallError(state === 'missing' ? 'missing' : 'network', fn.path, 'skipped (recently failed)'),
    };
  }
  try {
    return { ok: true, value: (await post(fn.kind, fn.path, args, opts)) as T };
  } catch (e) {
    const err = e instanceof ConvexCallError ? e : new ConvexCallError('network', fn.path, String(e));
    return { ok: false, error: err };
  }
}

export const query = <T>(name: FnName, args?: object, opts?: CallOptions) => call<T>(name, args, opts);
export const mutation = <T>(name: FnName, args?: object, opts?: CallOptions) => call<T>(name, args, opts);
export const action = <T>(name: FnName, args?: object, opts?: CallOptions) => call<T>(name, args, opts);
