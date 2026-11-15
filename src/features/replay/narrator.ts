import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// On-device narrator for stops that have no recorded narration clip.
// Calm en-US voice, a touch slower than default, word callbacks for captions.

const RATE = Platform.OS === 'ios' ? 0.9 : 0.92;
const PITCH = 0.98;
// Rough speaking speed at RATE, used when onBoundary never fires.
const WORDS_PER_SEC = 2.45;

// Voices we know sound calm; earlier = preferred. Matched against voice name.
const PREFERRED = ['Ava', 'Zoe', 'Evan', 'Nathan', 'Allison', 'Samantha', 'Nicky', 'Tom'];

let voicePromise: Promise<string | undefined> | null = null;

function scoreVoice(v: Speech.Voice): number {
  let s = 0;
  const id = v.identifier.toLowerCase();
  if (id.includes('premium')) s += 40;
  if (v.quality === Speech.VoiceQuality.Enhanced) s += 30;
  if (id.includes('siri')) s -= 5; // can't always be driven by third-party apps
  if (id.includes('eloquence') || id.includes('speech.synthesis.voice')) s -= 50; // novelty voices
  const pref = PREFERRED.findIndex((n) => v.name.startsWith(n));
  if (pref >= 0) s += 20 - pref;
  return s;
}

// Resolves once; later calls reuse the result. Never rejects.
export function pickVoice(): Promise<string | undefined> {
  if (!voicePromise) {
    voicePromise = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const en = voices.filter((v) => v.language?.replace('_', '-').toLowerCase() === 'en-us');
        if (!en.length) return undefined;
        return [...en].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]?.identifier;
      })
      .catch(() => undefined);
  }
  return voicePromise;
}

export type Words = { words: string[]; starts: number[] };

// Split narration into words and remember each word's char offset,
// so an onBoundary charIndex maps straight to a word index.
export function splitWords(text: string): Words {
  const words: string[] = [];
  const starts: number[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    words.push(m[0]);
    starts.push(m.index);
  }
  return { words, starts };
}

export function wordAt(starts: number[], charIndex: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= charIndex) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function estimateMs(wordCount: number): number {
  return (wordCount / WORDS_PER_SEC) * 1000 + 600;
}

export type SpeakHandlers = {
  onWord: (wordIndex: number, fromBoundary: boolean) => void;
  onDone: () => void;
};

// Speaks `text` starting at word `fromWord`. Returns a stop function.
// Word indices reported back are absolute (into the full text).
export function speak(text: string, fromWord: number, voice: string | undefined, h: SpeakHandlers): () => void {
  const { starts } = splitWords(text);
  const offset = starts[fromWord] ?? 0;
  const slice = text.slice(offset);
  const sliceStarts = starts.slice(fromWord).map((s) => s - offset);
  let alive = true;
  Speech.speak(slice, {
    language: 'en-US',
    voice,
    rate: RATE,
    pitch: PITCH,
    onBoundary: (ev: unknown) => {
      if (!alive) return;
      const idx = (ev as { charIndex?: number })?.charIndex;
      if (typeof idx === 'number') h.onWord(fromWord + wordAt(sliceStarts, idx), true);
    },
    onDone: () => {
      if (!alive) return;
      alive = false;
      h.onDone();
    },
    onError: () => {
      if (!alive) return;
      alive = false;
      h.onDone();
    },
    // Stopped from outside (demo panel turned the narrator off): move on.
    onStopped: () => {
      if (!alive) return;
      alive = false;
      h.onDone();
    },
  });
  return () => {
    alive = false;
  };
}

export const stopSpeech = () => Speech.stop().catch(() => {});
export const pauseSpeech = () => Speech.pause().catch(() => {});
export const resumeSpeech = () => Speech.resume().catch(() => {});
export const canPauseSpeech = Platform.OS === 'ios' || Platform.OS === 'web';
