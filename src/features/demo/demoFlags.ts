import { useSyncExternalStore } from 'react';

// Rehearsal switches flipped from the hidden demo panel (/demo).
// Module-level, session-only. Other screens read them directly
// (`demoFlags.orderPaid`) or reactively with useDemoFlags().

export type DemoFlags = {
  /** Pretend a friend just paired: show the celebration / face pin path. */
  friendPaired: boolean;
  /** Pretend the Whop webhook marked the print order paid. */
  orderPaid: boolean;
  /** Replay narrator voice. Off = captions only. */
  narratorOn: boolean;
  /** Set when "Reset onboarding" was tapped, so Home can show first-run copy. */
  onboardingReset: boolean;
};

const initial: DemoFlags = {
  friendPaired: false,
  orderPaid: false,
  narratorOn: true,
  onboardingReset: false,
};

let state: DemoFlags = { ...initial };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const demoFlags = {
  get friendPaired() {
    return state.friendPaired;
  },
  get orderPaid() {
    return state.orderPaid;
  },
  get narratorOn() {
    return state.narratorOn;
  },
  get onboardingReset() {
    return state.onboardingReset;
  },
  get(): DemoFlags {
    return state;
  },
  set(patch: Partial<DemoFlags>) {
    state = { ...state, ...patch };
    emit();
  },
  reset() {
    state = { ...initial };
    emit();
  },
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Re-renders when any flag changes. */
export function useDemoFlags(): DemoFlags {
  return useSyncExternalStore(demoFlags.subscribe, demoFlags.get, demoFlags.get);
}
