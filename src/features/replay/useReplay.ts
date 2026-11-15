import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { demoFlags } from '@/features/demo/demoFlags';
import type { Moment, Trip } from '@/lib/types';

import {
  canPauseSpeech,
  estimateMs,
  pauseSpeech,
  pickVoice,
  resumeSpeech,
  speak,
  splitWords,
  stopSpeech,
} from './narrator';
import { pairingMomentId } from './people';
import { sortedMoments } from './useTrip';

export type ReplayPhase = 'idle' | 'title' | 'flying' | 'pin' | 'photos' | 'narrating' | 'done';

const TITLE_MS = 3200; // opening title card
const FLY_MS = 2600; // approach flight
const SETTLE_MS = 1100; // camera eases into the final framing
const PIN_MS = 500;
const PHOTOS_MS = 900;
const BREATH_MS = 700; // beat after a stop's narration before the next flight
const HOLD_MS = 4000; // no narration at all: hold the caption this long
const NARRATION_CAP_MS = 45_000; // safety net if a clip never reports finished
const TICK_MS = 100;
const AMBIENT_VOLUME = 0.2;
const WORD_IN_MS = 240;

// Final framing at a stop, and the slightly wider, rotated approach pose
// the flight lands on first, so the settle reads as the camera finding its mark.
const SETTLE = { pitch: 55, zoom: 17, altitude: 650 };
const APPROACH = { pitch: 38, zoom: 16.1, altitude: 1250, headingOffset: -16 };
const DRIFT = { headingOffset: 7, altitude: 600 };

// Player props are set outside the hook body so the React Compiler doesn't
// treat them as mutating hook state.
function configureAmbient(player: AudioPlayer) {
  player.loop = true;
  player.volume = AMBIENT_VOLUME;
}

// Drives the Replay film:
// title -> (flight -> settle + pin -> photos -> narration -> breath) per stop -> end card.
// Every wait is pause-aware and cancels when a newer run starts (jump / restart / unmount).
export function useReplay(trip: Trip, mapRef: RefObject<MapView | null>, opts: { reducedMotion?: boolean } = {}) {
  const moments = useMemo(() => sortedMoments(trip), [trip]);
  const reducedMotion = !!opts.reducedMotion;

  // pairing id -> index of the stop where it happened
  const pairingStops = useMemo(() => {
    const out: { pairingId: string; stopIndex: number }[] = [];
    for (const p of trip.pairings) {
      const mid = pairingMomentId(p, moments);
      const stopIndex = moments.findIndex((m) => m.id === mid);
      if (stopIndex >= 0) out.push({ pairingId: p.id, stopIndex });
    }
    return out;
  }, [trip, moments]);

  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<ReplayPhase>('idle');
  const [paused, setPaused] = useState(false);
  const [reachedPairings, setReachedPairings] = useState<string[]>([]);

  // Words revealed in the current caption (float; word i shows as it passes i).
  const captionProgress = useSharedValue(0);
  // Whole-film progress 0..1; stop i owns [i/n, (i+1)/n].
  const filmProgress = useSharedValue(0);

  const pausedRef = useRef(false);
  const runRef = useRef(0);
  const phaseRef = useRef<ReplayPhase>('idle');
  const momentRef = useRef<Moment | undefined>(undefined);
  const voiceRef = useRef<string | undefined>(undefined);
  // Set while on-device speech is active, so pause/resume act immediately.
  const speechCtl = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const progressGoal = useRef<{ target: number; msPerUnit: number } | null>(null);

  const narrator = useAudioPlayer(null);
  const ambient = useAudioPlayer(null);


  const go = (p: ReplayPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const n = Math.max(1, moments.length);

  const progressTo = (target: number, ms: number, easing = Easing.linear) => {
    const from = filmProgress.get();
    progressGoal.current = { target, msPerUnit: Math.abs(target - from) > 1e-4 ? ms / Math.abs(target - from) : 0 };
    filmProgress.set(withTiming(target, { duration: Math.max(0, ms), easing }));
  };

  const revealWord = (wordIndex: number) => {
    const target = wordIndex + 1;
    if (target <= captionProgress.get() + 0.01) return;
    captionProgress.set(withTiming(target, { duration: WORD_IN_MS, easing: Easing.out(Easing.quad) }));
  };

  // Resolves true after `ms` of un-paused time, false if this run was superseded.
  const wait = (ms: number, run: number, onTick?: (elapsed: number) => void) =>
    new Promise<boolean>((resolve) => {
      let elapsed = 0;
      const t = setInterval(() => {
        if (runRef.current !== run) {
          clearInterval(t);
          resolve(false);
          return;
        }
        if (!pausedRef.current) {
          elapsed += TICK_MS;
          onTick?.(elapsed);
        }
        if (elapsed >= ms) {
          clearInterval(t);
          resolve(true);
        }
      }, TICK_MS);
    });

  // Narrator off (demo panel): no audio, captions reveal on the time-based estimate.
  const captionsOnly = async (wordCount: number, run: number) => {
    const msPerWord = estimateMs(wordCount) / Math.max(1, wordCount);
    const ok = await wait(estimateMs(wordCount), run, (elapsed) =>
      revealWord(Math.min(wordCount - 1, Math.floor(elapsed / msPerWord))),
    );
    if (ok) revealWord(wordCount - 1);
    return ok;
  };

  // Recorded clip path (narrationUri). Captions follow the clip's playhead.
  const playNarration = (uri: string, wordCount: number, run: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      let left = NARRATION_CAP_MS;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        sub.remove();
        clearInterval(t);
        resolve(ok);
      };
      const sub = narrator.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) finish(true);
      });
      const t = setInterval(() => {
        if (runRef.current !== run) {
          narrator.pause();
          finish(false);
          return;
        }
        if (!pausedRef.current) left -= TICK_MS;
        const dur = narrator.duration;
        if (dur > 0) revealWord(Math.min(wordCount - 1, Math.floor((narrator.currentTime / dur) * wordCount)));
        if (left <= 0) finish(true);
      }, TICK_MS);
      try {
        narrator.replace(uri);
        if (!pausedRef.current) narrator.play();
      } catch {
        finish(true);
      }
    });

  // On-device voice path. Advances on onDone; captions follow onBoundary when
  // the platform sends it, otherwise a time-based estimate.
  const speakNarration = (text: string, run: number) =>
    new Promise<boolean>((resolve) => {
      const { words } = splitWords(text);
      const estimate = estimateMs(words.length);
      const msPerWord = estimate / Math.max(1, words.length);
      let settled = false;
      let boundarySeen = false;
      let current = 0;
      let elapsed = 0;
      let capLeft = estimate * 2 + 5000;
      let cancel: (() => void) | null = null;

      const begin = (from: number) => {
        cancel?.();
        cancel = speak(text, from, voiceRef.current, {
          onWord: (i) => {
            boundarySeen = true;
            current = Math.max(current, i);
            revealWord(i);
          },
          onDone: () => finish(true),
        });
      };

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearInterval(t);
        cancel?.();
        speechCtl.current = null;
        if (ok) revealWord(words.length - 1);
        resolve(ok);
      };

      speechCtl.current = {
        pause: () => {
          if (canPauseSpeech) pauseSpeech();
          else {
            cancel?.();
            stopSpeech();
          }
        },
        // Android can't pause speech: restart from the word we were on.
        resume: () => (canPauseSpeech ? resumeSpeech() : begin(current)),
      };

      const t = setInterval(() => {
        if (runRef.current !== run) {
          stopSpeech();
          finish(false);
          return;
        }
        if (pausedRef.current) return;
        elapsed += TICK_MS;
        capLeft -= TICK_MS;
        if (!boundarySeen) {
          const est = Math.min(words.length - 1, Math.floor(elapsed / msPerWord));
          current = Math.max(current, est);
          revealWord(est);
        }
        if (capLeft <= 0) {
          stopSpeech();
          finish(true);
        }
      }, TICK_MS);

      begin(0);
    });

  const startAmbient = (uri?: string) => {
    if (!uri) return;
    try {
      ambient.replace(uri);
      configureAmbient(ambient);
      if (!pausedRef.current) ambient.play();
    } catch {}
  };

  const stopAudio = () => {
    try {
      narrator.pause();
      ambient.pause();
    } catch {}
  };

  const fitAll = () => {
    if (!moments.length) return;
    mapRef.current?.fitToCoordinates(
      moments.map((m) => ({ latitude: m.lat, longitude: m.lng })),
      { edgePadding: { top: 140, right: 70, bottom: 420, left: 70 }, animated: true },
    );
  };

  const run = async (from: number, withTitle: boolean) => {
    const id = ++runRef.current;
    speechCtl.current = null;
    if (withTitle) {
      setIndex(-1);
      go('title');
      filmProgress.set(0);
    }
    stopAudio();
    await stopSpeech();
    if (runRef.current !== id) return;
    if (withTitle && !(await wait(TITLE_MS, id))) return;

    for (let i = from; i < moments.length; i++) {
      const m = moments[i];
      const heading = m.headingDeg ?? 0;
      momentRef.current = m;
      captionProgress.set(0);
      setIndex(i);
      go('flying');
      progressTo(i / n, 500, Easing.out(Easing.cubic));

      mapRef.current?.animateCamera(
        {
          center: { latitude: m.lat, longitude: m.lng },
          pitch: APPROACH.pitch,
          heading: heading + APPROACH.headingOffset,
          zoom: APPROACH.zoom, // Google Maps
          altitude: APPROACH.altitude, // Apple Maps
        },
        { duration: FLY_MS },
      );
      if (!(await wait(FLY_MS, id))) return;

      // Settle: a short second move into the final framing, pin lands on it.
      go('pin');
      mapRef.current?.animateCamera(
        { center: { latitude: m.lat, longitude: m.lng }, heading, ...SETTLE },
        { duration: SETTLE_MS },
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const met = pairingStops.filter((p) => p.stopIndex === i).map((p) => p.pairingId);
      if (!(await wait(PIN_MS, id))) return;
      if (met.length) {
        setReachedPairings((prev) => Array.from(new Set([...prev, ...met])));
        // Softer double tick for a person.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
        setTimeout(() => {
          if (runRef.current === id) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
        }, 120);
      }

      go('photos');
      startAmbient(m.ambientUri);
      if (!(await wait(PHOTOS_MS, id))) return;

      go('narrating');
      const text = m.narration ?? m.caption ?? '';
      const wordCount = splitWords(text).words.length;
      const expected = m.narrationUri || text ? estimateMs(wordCount) : HOLD_MS;
      progressTo((i + 1) / n, expected + BREATH_MS);
      if (!reducedMotion) {
        // Slow living drift while the narrator talks.
        mapRef.current?.animateCamera(
          {
            center: { latitude: m.lat, longitude: m.lng },
            heading: heading + DRIFT.headingOffset,
            pitch: SETTLE.pitch,
            zoom: SETTLE.zoom + 0.15,
            altitude: DRIFT.altitude,
          },
          { duration: expected },
        );
      }

      let ok: boolean;
      if (!demoFlags.narratorOn && text) ok = await captionsOnly(wordCount, id);
      else if (m.narrationUri) ok = await playNarration(m.narrationUri, wordCount, id);
      else if (text) ok = await speakNarration(text, id);
      else ok = await wait(HOLD_MS, id);
      if (!ok) return;
      try {
        ambient.pause();
      } catch {}
      if (!(await wait(BREATH_MS, id))) return;
    }
    progressTo(1, 400);
    fitAll();
    go('done');
  };

  const setPausedBoth = (p: boolean) => {
    pausedRef.current = p;
    setPaused(p);
  };

  const freezeCamera = async () => {
    try {
      const cam = await mapRef.current?.getCamera();
      if (cam) mapRef.current?.setCamera(cam);
    } catch {}
  };

  const togglePause = () => {
    if (phaseRef.current === 'done' || phaseRef.current === 'idle') return;
    const next = !pausedRef.current;
    setPausedBoth(next);
    try {
      const m = momentRef.current;
      if (next) {
        narrator.pause();
        ambient.pause();
        speechCtl.current?.pause();
        cancelAnimation(filmProgress);
        freezeCamera();
      } else {
        if (phaseRef.current === 'narrating' && m?.narrationUri && demoFlags.narratorOn) narrator.play();
        if ((phaseRef.current === 'photos' || phaseRef.current === 'narrating') && m?.ambientUri) ambient.play();
        speechCtl.current?.resume();
        const goal = progressGoal.current;
        if (goal) {
          const remaining = Math.abs(goal.target - filmProgress.get()) * goal.msPerUnit;
          filmProgress.set(withTiming(goal.target, { duration: remaining, easing: Easing.linear }));
        }
        // Flights were frozen by the pause; pick the current stop's framing back up.
        if (m && (phaseRef.current === 'flying' || phaseRef.current === 'pin')) {
          mapRef.current?.animateCamera(
            { center: { latitude: m.lat, longitude: m.lng }, heading: m.headingDeg ?? 0, ...SETTLE },
            { duration: SETTLE_MS },
          );
        }
      }
    } catch {}
  };

  const jumpTo = (i: number) => {
    const target = Math.max(0, Math.min(i, moments.length - 1));
    setPausedBoth(false);
    setReachedPairings(pairingStops.filter((p) => p.stopIndex < target).map((p) => p.pairingId));
    run(target, false);
  };

  const restart = () => {
    setPausedBoth(false);
    setReachedPairings([]);
    run(0, true);
  };

  const start = () => {
    if (phaseRef.current !== 'idle') return;
    restart();
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    pickVoice().then((v) => {
      voiceRef.current = v;
    });
    // Fallback in case onMapReady never fires; start() is a no-op once running.
    const t = setTimeout(() => start(), 2000);
    return () => {
      clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runRef.current++; // cancel any running timeline
      speechCtl.current = null;
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    moments,
    index,
    moment: index >= 0 ? moments[index] : undefined,
    phase,
    paused,
    reachedPairings,
    captionProgress,
    filmProgress,
    start,
    togglePause,
    jumpTo,
    restart,
  };
}
