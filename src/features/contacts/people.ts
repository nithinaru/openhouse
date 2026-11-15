// Turns the raw address book into "your people": who is already on wish you were here and who
// can be invited. Matching is simulated and deterministic (a hash of the name), so the
// same phone shows the same friends every time. Nothing here touches the network.

import { demoTrip } from '@/lib/demo/demoTrip';

export type RawContact = { id: string; name: string; uri?: string };

export type Person = {
  id: string;
  /** Display name, lowercase. */
  name: string;
  first: string;
  initials: string;
  uri?: string;
  /** Pastel sticker fill behind initials. */
  tint: string;
  onOpenhouse: boolean;
  /** Set for the friends who were at the demo day: "was there · 3 photos". */
  wasThere?: { photos: number };
  /** "4 mutual" style social proof for matched friends. */
  mutual?: number;
  source: 'demo' | 'device' | 'sample';
};

export const TINTS = ['#F7C5DD', '#B4D2F0', '#CDEBD9', '#F6E7B0', '#DCD3F5', '#F8D5C2', '#DCEAF8'];

/** FNV-1a, 32-bit. Stable across launches and devices. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toLowerCase();
}

/** Faces for the sample crowd. Only a fixed number is sent, never a name. */
export const face = (n: number) => `https://i.pravatar.cc/300?img=${n}`;

/** A believable crowd for a phone with an empty address book, or "use sample friends". */
export const SAMPLE: RawContact[] = [
  ['maya chen', 47],
  ['theo park', 12],
  ['ines alvarez', 44],
  ['jules okafor', 33],
  ['priya natarajan', 49],
  ['sam rivera', 59],
  ['noor haddad', 45],
  ['leo martins', 15],
  ['ava kim', 32],
  ['ben carter', 0],
  ['chloe dubois', 9],
  ['dev patel', 53],
  ['emma lindqvist', 0],
  ['finn o’brien', 52],
  ['grace liu', 0],
  ['hana sato', 41],
  ['isaac mensah', 0],
  ['kai nakamura', 60],
  ['lena fischer', 0],
  ['marco rossi', 68],
  ['nia brooks', 0],
  ['omar farouk', 0],
  ['ruby zhang', 26],
  ['sofia reyes', 0],
  ['tariq aziz', 0],
  ['uma shah', 0],
  ['vic torres', 0],
  ['will hart', 0],
  ['yara nasser', 0],
  ['zoe bennett', 25],
].map(([name, img]) => ({ id: `sample-${name}`, name: name as string, uri: img ? face(img as number) : undefined }));

/** Sample names that always land "on wish you were here", to match the onboarding art. */
const SAMPLE_ON = new Set(['maya chen', 'theo park', 'ines alvarez', 'jules okafor']);

/** The demo trip's people (rohan) always lead "on wish you were here" so the story connects. */
export function demoPeople(): Person[] {
  const angles = Object.values(demoTrip.theirAngles ?? {}).flat();
  return demoTrip.people.map((p, i) => {
    const name = p.name.toLowerCase();
    const photos = angles.filter((a) => a.userId === p.id).length || 3;
    return {
      id: p.id,
      name,
      first: name.split(' ')[0],
      initials: initialsOf(name),
      uri: p.avatarUri,
      tint: TINTS[i % TINTS.length],
      onOpenhouse: true,
      wasThere: { photos },
      mutual: 6,
      source: 'demo' as const,
    };
  });
}

const MIN_CROWD = 14;
const MAX_ON = 14;

/**
 * Builds the full list. Device contacts come first; a thin address book is topped up
 * with the sample crowd so the screen never looks empty.
 */
export function buildPeople(raw: RawContact[], source: 'device' | 'sample'): Person[] {
  const demo = demoPeople();
  const taken = new Set(demo.map((d) => d.first));

  const seen = new Set<string>();
  const pool: (RawContact & { src: 'device' | 'sample' })[] = [];
  const add = (c: RawContact, src: 'device' | 'sample') => {
    const name = c.name.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!name || seen.has(name) || taken.has(name.split(' ')[0])) return;
    seen.add(name);
    pool.push({ ...c, name, src });
  };
  raw.forEach((c) => add(c, source));
  if (pool.length < MIN_CROWD) SAMPLE.forEach((c) => add(c, 'sample'));

  // ~25% of the crowd is "already on wish you were here", by hash; at least 3 when there are enough.
  const scored = pool.map((c) => ({ c, h: hash(c.name) }));
  const onIds = new Set(
    scored.filter(({ c, h }) => (c.src === 'sample' ? SAMPLE_ON.has(c.name) : h % 100 < 25)).map(({ c }) => c.id),
  );
  if (onIds.size < 3 && pool.length >= 6) {
    [...scored].sort((a, b) => a.h - b.h).forEach(({ c }) => onIds.size < 3 && onIds.add(c.id));
  }
  // Keep the "on wish you were here" list short enough to read; the rest stay invitable.
  if (onIds.size > MAX_ON) {
    const keep = scored.filter(({ c }) => onIds.has(c.id)).sort((a, b) => a.h - b.h).slice(0, MAX_ON);
    onIds.clear();
    keep.forEach(({ c }) => onIds.add(c.id));
  }

  // One or two matched friends "were there" too, so the day has more than one angle.
  const onSorted = scored.filter(({ c }) => onIds.has(c.id)).sort((a, b) => a.h - b.h);
  const wasThere = new Map<string, number>();
  onSorted.slice(0, Math.min(2, onSorted.length)).forEach(({ c, h }, i) => wasThere.set(c.id, i === 0 ? 3 : 2 + (h % 4)));

  const people: Person[] = pool.map((c) => {
    const h = hash(c.name);
    const on = onIds.has(c.id);
    return {
      id: c.id,
      name: c.name,
      first: c.name.split(' ')[0],
      initials: initialsOf(c.name),
      uri: c.uri,
      tint: TINTS[h % TINTS.length],
      onOpenhouse: on,
      wasThere: wasThere.has(c.id) ? { photos: wasThere.get(c.id)! } : undefined,
      mutual: on ? 1 + (h % 7) : undefined,
      source: c.src,
    };
  });

  return [...demo, ...people];
}

export function sortOn(people: Person[]): Person[] {
  const rank = (p: Person) => (p.source === 'demo' ? 0 : p.wasThere ? 1 : 2);
  return people.filter((p) => p.onOpenhouse).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function sortInvite(people: Person[]): Person[] {
  return people.filter((p) => !p.onOpenhouse).sort((a, b) => a.name.localeCompare(b.name));
}

export function letterOf(name: string): string {
  const c = name.trim()[0]?.toUpperCase() ?? '#';
  return c >= 'A' && c <= 'Z' ? c : '#';
}
