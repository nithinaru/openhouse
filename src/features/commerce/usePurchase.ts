// The one purchase flow every Whop surface shares:
//   idle -> starting (Convex makes the checkout) -> paying (in-app browser open)
//        -> confirming (polling Convex) -> done | waiting (not confirmed yet) | unavailable
// "done" is only ever reached from a Convex read, never from the browser closing.

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { openCheckout, type CheckoutStart, type Result, type Unavailable } from './checkout';

export type PurchaseState<T> =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'paying' }
  | { phase: 'confirming'; checkout: CheckoutStart }
  | { phase: 'done'; value: T; checkout: CheckoutStart }
  | { phase: 'waiting'; checkout: CheckoutStart }
  | { phase: 'unavailable'; reason: Unavailable; message: string };

export type Purchase<T> = {
  state: PurchaseState<T>;
  busy: boolean;
  /** Starts a checkout and waits for Convex to confirm it. */
  buy: (start: () => Promise<Result<CheckoutStart>>, confirm: (c: CheckoutStart, signal: AbortSignal) => Promise<T | null>) => Promise<void>;
  /** Keeps polling after a "not confirmed yet". */
  retryConfirm: () => Promise<void>;
  reset: () => void;
  /** Rehearsal: jump straight to the confirmed state. */
  preview: (value: T) => void;
};

export function usePurchase<T>(): Purchase<T> {
  const [state, setState] = useState<PurchaseState<T>>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const lastConfirm = useRef<((c: CheckoutStart, s: AbortSignal) => Promise<T | null>) | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const confirmWith = useCallback(async (checkout: CheckoutStart) => {
    const confirm = lastConfirm.current;
    if (!confirm) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState({ phase: 'confirming', checkout });
    const value = await confirm(checkout, ctl.signal).catch(() => null);
    if (ctl.signal.aborted) return;
    if (value) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setState({ phase: 'done', value, checkout });
    } else {
      setState({ phase: 'waiting', checkout });
    }
  }, []);

  const buy: Purchase<T>['buy'] = useCallback(
    async (start, confirm) => {
      lastConfirm.current = confirm;
      setState({ phase: 'starting' });
      const res = await start().catch(() => null);
      if (!res) {
        setState({ phase: 'unavailable', reason: 'error', message: 'checkout hit a snag. try again' });
        return;
      }
      if (!res.ok) {
        setState({ phase: 'unavailable', reason: res.reason, message: res.message });
        return;
      }
      setState({ phase: 'paying' });
      await openCheckout(res.value.url);
      // The sheet closed. That says nothing about payment: ask Convex.
      await confirmWith(res.value);
    },
    [confirmWith],
  );

  const retryConfirm = useCallback(async () => {
    if (state.phase === 'waiting') await confirmWith(state.checkout);
  }, [confirmWith, state]);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  const preview = useCallback((value: T) => {
    abort.current?.abort();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setState({ phase: 'done', value, checkout: { url: '', orderId: 'preview' } });
  }, []);

  const busy = state.phase === 'starting' || state.phase === 'paying' || state.phase === 'confirming';
  return { state, busy, buy, retryConfirm, reset, preview };
}

/** Short status line for the non-terminal phases. */
export function phaseLine(state: PurchaseState<unknown>): string | null {
  switch (state.phase) {
    case 'starting':
      return 'opening whop checkout…';
    case 'paying':
      return 'finish paying in the sheet';
    case 'confirming':
      return 'confirming with whop…';
    case 'waiting':
      return "payment isn't confirmed yet. it shows here the moment whop tells us";
    case 'unavailable':
      return state.message;
    default:
      return null;
  }
}
