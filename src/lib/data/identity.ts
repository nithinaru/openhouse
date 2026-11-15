// Stable on-device identity: a local device id, a display name and a 6-char share code,
// persisted as JSON in the app's document directory (expo-file-system; secure-store isn't installed).
// When the backend is up, users:ensure({ deviceId, name }) returns the Convex userId and the
// server's shareCode, which then replaces the local one (pairing looks codes up server-side).

import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';

import { tryCall } from './convexHttp';

export type Identity = {
  deviceId: string;
  name: string;
  shareCode: string;
  /** Convex users._id once users:ensure has succeeded. */
  userId?: string;
};

const FILE_NAME = 'openhouse-identity.json';
// Same alphabet as convex/users.ts (no 0/O/1/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let cached: Identity | undefined;
let ensuring: Promise<Identity> | undefined;

function randomFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const newShareCode = (): string => randomFrom(ALPHABET, 6);

function defaultName(): string {
  // "Nithin's iPhone" -> "Nithin". iOS 16+ often reports just "iPhone", which we skip.
  const raw = Device.deviceName ?? '';
  const m = raw.match(/^(.+?)['’]s\s/);
  return m?.[1]?.trim() || 'You';
}

function file(): File | undefined {
  try {
    return new File(Paths.document, FILE_NAME);
  } catch {
    return undefined;
  }
}

function readFromDisk(): Identity | undefined {
  try {
    const f = file();
    if (!f?.exists) return undefined;
    const parsed = JSON.parse(f.textSync()) as Partial<Identity>;
    if (typeof parsed.deviceId !== 'string' || typeof parsed.shareCode !== 'string') return undefined;
    return {
      deviceId: parsed.deviceId,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : defaultName(),
      shareCode: parsed.shareCode,
      userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
    };
  } catch {
    return undefined;
  }
}

function writeToDisk(id: Identity): void {
  try {
    const f = file();
    if (!f) return;
    if (!f.exists) f.create();
    f.writeSync(JSON.stringify(id));
  } catch {
    // Read-only or unavailable FS: identity still works for this session.
  }
}

/** Synchronous, always returns an identity (creating and persisting one on first launch). */
export function getIdentity(): Identity {
  if (cached) return cached;
  cached = readFromDisk();
  if (!cached) {
    cached = { deviceId: `dev-${Date.now().toString(36)}-${randomFrom('abcdefghijkmnpqrstuvwxyz23456789', 10)}`, name: defaultName(), shareCode: newShareCode() };
    writeToDisk(cached);
  }
  return cached;
}

export function setDisplayName(name: string): Identity {
  const next = { ...getIdentity(), name: name.trim() || 'You' };
  cached = next;
  writeToDisk(next);
  void ensureRemoteUser(true);
  return next;
}

type EnsureResult = { userId: string; name: string; shareCode: string };

/**
 * Calls users:ensure once per session (or again with force). Resolves with the identity either
 * way; `userId` is set only when the backend answered. Never throws.
 */
export function ensureRemoteUser(force = false): Promise<Identity> {
  const local = getIdentity();
  if (ensuring && !force) return ensuring;
  ensuring = (async () => {
    const res = await tryCall<EnsureResult>('usersEnsure', { deviceId: local.deviceId, name: local.name });
    if (!res.ok || typeof res.value?.userId !== 'string') {
      ensuring = undefined; // retry next time
      return getIdentity();
    }
    const next: Identity = { ...getIdentity(), userId: res.value.userId, shareCode: res.value.shareCode || local.shareCode };
    cached = next;
    writeToDisk(next);
    return next;
  })();
  return ensuring;
}
