// Session store for contacts: who we found, who you followed, who you invited.
// A tiny module-level store read through useSyncExternalStore, so any screen can ask
// "which friends are on wish you were here" without a provider. Lives in memory only.

import { useSyncExternalStore } from 'react';

import { buildPeople, demoPeople, sortInvite, sortOn, type Person, type RawContact } from './people';

type State = {
  synced: boolean;
  source: 'device' | 'sample' | null;
  people: Person[];
  followed: ReadonlySet<string>;
  invited: ReadonlySet<string>;
};

const initialPeople = demoPeople();

let state: State = {
  synced: false,
  source: null,
  people: initialPeople,
  // The demo friends are already mutuals: you paired with rohan at lunch.
  followed: new Set(initialPeople.map((p) => p.id)),
  invited: new Set(),
};

const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getState = () => state;

export function useContactsState(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---------------------------------------------------------------------------
// Actions

export function syncContacts(raw: RawContact[], source: 'device' | 'sample'): Person[] {
  const people = buildPeople(raw, source);
  set({ synced: true, source, people });
  return people;
}

export function toggleFollow(id: string): boolean {
  const followed = new Set(state.followed);
  const now = !followed.has(id);
  if (now) followed.add(id);
  else followed.delete(id);
  set({ followed });
  return now;
}

/** Simulated: marks the person invited. No SMS, no network. */
export function invite(id: string) {
  if (state.invited.has(id)) return;
  set({ invited: new Set(state.invited).add(id) });
}

export function inviteMany(ids: string[]): number {
  const invited = new Set(state.invited);
  let n = 0;
  ids.forEach((id) => {
    if (!invited.has(id)) {
      invited.add(id);
      n++;
    }
  });
  if (n) set({ invited });
  return n;
}

// ---------------------------------------------------------------------------
// Read side for other screens

export type Friend = Person & { followed: boolean };

/**
 * Friends on wish you were here, demo friends first, then whoever "was there", then a–z.
 * Before contacts are synced this is just the demo trip's people (rohan), so a
 * "who's inside" strip is never empty.
 */
export function useFriends(): {
  friends: Friend[];
  followed: Friend[];
  wasThere: Friend[];
  inviteCount: number;
  invitedCount: number;
  synced: boolean;
} {
  const s = useContactsState();
  const friends = sortOn(s.people).map((p) => ({ ...p, followed: s.followed.has(p.id) }));
  return {
    friends,
    followed: friends.filter((f) => f.followed),
    wasThere: friends.filter((f) => !!f.wasThere),
    inviteCount: sortInvite(s.people).length,
    invitedCount: s.invited.size,
    synced: s.synced,
  };
}
