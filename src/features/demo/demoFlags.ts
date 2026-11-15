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
  /** Openhouse+ lock. auto = real entitlements (unlocked on the demo trip / offline). */
  plusLocked: PlusLock;
  /** Whop beat: "sign in with whop" finished (referral payouts + host payout label). */
  whopConnected: boolean;
  /** Whop beat: a drop purchase confirmed (real or rehearsal), unlocks the owners chat. */
  ownsHoodie: boolean;
  /** Whop beat: messages the user sent in the owners chat, appended after the seed. */
  chatMessages: ChatMessage[];
  /** Whop beat: joined the sold-out waitlist. */
  waitlisted: boolean;
};

export type ChatMessage = { id: string; text: string; time: string };

export type PlusLock = 'auto' | 'locked' | 'unlocked';

const initial: DemoFlags = {
  friendPaired: false,
  orderPaid: false,
  narratorOn: true,
  onboardingReset: false,
  plusLocked: 'auto',
  whopConnected: false,
  ownsHoodie: false,
  chatMessages: [],
  waitlisted: false,
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
  get plusLocked() {
    return state.plusLocked;
  },
  get whopConnected() {
    return state.whopConnected;
  },
  get ownsHoodie() {
    return state.ownsHoodie;
  },
  get chatMessages() {
    return state.chatMessages;
  },
  get waitlisted() {
    return state.waitlisted;
  },
  /** Append a message the user sent in the owners chat. */
  addChatMessage(msg: ChatMessage) {
    state = { ...state, chatMessages: [...state.chatMessages, msg] };
    emit();
  },
  get(): DemoFlags {
    return state;
  },
  set(patch: Partial<DemoFlags>) {
    state = { ...state, ...patch };
    emit();
  },
  reset() {
    state = { ...initial, chatMessages: [] };
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
