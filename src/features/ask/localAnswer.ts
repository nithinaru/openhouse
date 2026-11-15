import type { Moment, Trip } from '@/lib/types';

// Offline answerer for "Ask your day". Plain rules over the trip data so the
// demo still answers with no network: people/pairings, golden hour, weather,
// longest stop, first/last stop, then keyword match on place/caption/narration.

export type AskAnswer = { answer: string; momentIds: string[] };

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} minutes`;
  const hours = mins / 60;
  const rounded = Math.round(hours * 2) / 2; // nearest half hour
  if (rounded === 1) return 'about an hour';
  return `about ${rounded % 1 === 0 ? rounded : rounded.toFixed(1)} hours`;
}

const place = (m: Moment) => m.placeName ?? 'an unnamed spot';

function sorted(trip: Trip): Moment[] {
  return [...trip.moments].sort((a, b) => a.order - b.order);
}

function nearestMoment(moments: Moment[], at: number): Moment | undefined {
  let best: Moment | undefined;
  let bestD = Infinity;
  for (const m of moments) {
    const d = at < m.startAt ? m.startAt - at : at > m.endAt ? at - m.endAt : 0;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

// Whole-word match (with simple plural/tense endings) so "photo" doesn't hit "hot".
const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}(s|es|ed|ing)?\\b`).test(q));

function sentence(s?: string): string {
  if (!s) return '';
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// Which part of the day the question points at, if any.
function timeWindow(q: string): [number, number] | null {
  if (has(q, 'breakfast', 'morning', 'coffee')) return [5, 11];
  if (has(q, 'lunch', 'noon', 'midday')) return [11, 14.5];
  if (has(q, 'afternoon')) return [12, 17];
  if (has(q, 'evening', 'sunset', 'dinner', 'night')) return [17, 24];
  return null;
}

function inWindow(m: Moment, [from, to]: [number, number]): boolean {
  const d = new Date(m.startAt);
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= from && h < to;
}

function momentFor(q: string, moments: Moment[]): Moment | undefined {
  // Explicit words in the place or caption beat the clock ("lunch" in "Lunch on 3rd St").
  const tokens = tokenize(q);
  const byText = bestKeywordMatch(tokens, moments);
  if (byText && byText.score >= 2) return byText.moment;
  const win = timeWindow(q);
  if (win) {
    const hit = moments.find((m) => inWindow(m, win));
    if (hit) return hit;
  }
  return byText?.moment;
}

const STOP = new Set(
  'a an the i me my we our you your was were is are did do does at in on of to for and or with what when where who how which time day today there that this it about long longest spend spent most show tell'.split(
    ' ',
  ),
);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function bestKeywordMatch(tokens: string[], moments: Moment[]): { moment: Moment; score: number } | undefined {
  if (!tokens.length) return undefined;
  let best: { moment: Moment; score: number } | undefined;
  for (const m of moments) {
    const strong = `${m.placeName ?? ''} ${m.caption ?? ''} ${(m.sceneTags ?? []).join(' ')}`.toLowerCase();
    const weak = `${m.narration ?? ''} ${m.fact ?? ''} ${m.weather?.summary ?? ''}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      const stem = t.length > 4 ? t.replace(/(es|s)$/, '') : t;
      if (strong.includes(stem)) score += 2;
      else if (weak.includes(stem)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { moment: m, score };
  }
  return best;
}

export function answerLocally(trip: Trip, question: string): AskAnswer {
  const q = question.toLowerCase().trim();
  const moments = sorted(trip);
  if (!moments.length) {
    return { answer: "I don't have any stops for this day yet. Give it a minute to finish reading your photos.", momentIds: [] };
  }

  // People: "when did I meet Rohan?", "who was there?"
  const person = trip.people.find((p) => q.includes(p.name.toLowerCase()));
  if (person || has(q, 'meet', 'met', 'who', 'friend', 'people', 'person')) {
    const pairings = person
      ? trip.pairings.filter((p) => p.userA === person.id || p.userB === person.id)
      : trip.pairings;
    if (pairings.length) {
      const parts = pairings.slice(0, 2).map((pr) => {
        const who = trip.people.find((p) => p.id === pr.userA || p.id === pr.userB)?.name ?? 'a friend';
        const m = (pr.momentId && moments.find((x) => x.id === pr.momentId)) || nearestMoment(moments, pr.at);
        return { who, m, at: pr.at };
      });
      const first = parts[0];
      let answer = `You met ${first.who} at ${first.m ? place(first.m) : 'a stop'} around ${formatTime(first.at)}.`;
      if (parts.length > 1) answer += ` Then ${parts[1].who} at ${parts[1].m ? place(parts[1].m) : 'another stop'}.`;
      else if (first.m?.caption) answer += ` ${sentence(first.m.caption)}`;
      return { answer, momentIds: parts.map((p) => p.m?.id).filter((x): x is string => !!x) };
    }
    if (person) {
      return { answer: `${person.name} is in your people, but I can't place where you met today.`, momentIds: [] };
    }
    return { answer: "You didn't scan anyone's code today, so it was just you and your camera.", momentIds: [] };
  }

  // Golden hour
  if (has(q, 'golden', 'sunset', 'best light', 'light')) {
    const golden = moments.filter((m) => m.isGoldenHour);
    const m = golden[0] ?? [...moments].reverse().find((x) => new Date(x.startAt).getHours() >= 16);
    if (m) {
      const lead = golden.length
        ? `Golden hour caught you at ${place(m)}, around ${formatTime(m.startAt)}.`
        : `Closest you got to golden hour was ${place(m)}, around ${formatTime(m.startAt)}.`;
      const extra = m.caption && !/golden/i.test(m.caption) ? sentence(m.caption) : '';
      return { answer: `${lead} ${extra}`.trim(), momentIds: [m.id] };
    }
    return { answer: "The light never quite turned gold in your photos today. Everything was shot before late afternoon.", momentIds: [] };
  }

  // Weather
  if (has(q, 'weather', 'temperature', 'cold', 'warm', 'hot', 'rain', 'sunny', 'fog', 'degrees')) {
    const target = momentFor(q, moments);
    const withWeather = moments.filter((m) => m.weather);
    const m = target?.weather ? target : target ? nearestMoment(withWeather, target.startAt) : withWeather[0];
    if (m?.weather) {
      const name = place(m);
      const when = has(q, 'lunch')
        ? /^lunch/i.test(name)
          ? `At l${name.slice(1)}`
          : `At lunch at ${name}`
        : `At ${name}`;
      return {
        answer: `${when} it was ${Math.round(m.weather.tempF)}°F and ${m.weather.summary.toLowerCase()}, around ${formatTime(m.startAt)}.`,
        momentIds: [m.id],
      };
    }
    return { answer: "I don't have weather for that part of the day.", momentIds: target ? [target.id] : [] };
  }

  // Longest stop
  if (has(q, 'longest', 'most time', 'spend', 'spent', 'longer')) {
    const m = moments.reduce((a, b) => (b.endAt - b.startAt > a.endAt - a.startAt ? b : a));
    return {
      answer: `You spent the longest at ${place(m)}, ${formatDuration(m.endAt - m.startAt)} from ${formatTime(m.startAt)} to ${formatTime(m.endAt)}. ${sentence(m.caption)}`.trim(),
      momentIds: [m.id],
    };
  }

  // First / last
  if (has(q, 'first', 'start', 'begin')) {
    const m = moments[0];
    return { answer: `Your day started at ${place(m)} around ${formatTime(m.startAt)}. ${sentence(m.caption)}`.trim(), momentIds: [m.id] };
  }
  if (has(q, 'last', 'end', 'finish')) {
    const m = moments[moments.length - 1];
    return { answer: `You wrapped up at ${place(m)} around ${formatTime(m.startAt)}. ${sentence(m.caption)}`.trim(), momentIds: [m.id] };
  }

  // How many / summary
  if (has(q, 'how many', 'stops', 'summary', 'summarize', 'recap', 'what did i do')) {
    const names = moments.map(place);
    return {
      answer: `${moments.length} stops, from ${names[0]} at ${formatTime(moments[0].startAt)} to ${names[names.length - 1]} at ${formatTime(moments[moments.length - 1].startAt)}.`,
      momentIds: moments.map((m) => m.id),
    };
  }

  // Keyword / time-of-day match
  const m = momentFor(q, moments);
  if (m) {
    return {
      answer: `That sounds like ${place(m)}, around ${formatTime(m.startAt)}. ${sentence(m.caption ?? m.narration)}`.trim(),
      momentIds: [m.id],
    };
  }

  return {
    answer: `Your day had ${moments.length} stops, from ${place(moments[0])} to ${place(moments[moments.length - 1])}. Try asking about a person, a place, or the light.`,
    momentIds: [],
  };
}
