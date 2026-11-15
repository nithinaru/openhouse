import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type MapView from 'react-native-maps';

import type { Moment, Trip } from '@/lib/types';

import { pairingMomentId } from './people';
import { sortedMoments } from './useTrip';

export type ReplayPhase = 'idle' | 'flying' | 'pin' | 'photos' | 'narrating' | 'done';

const FLY_MS = 2500;
const PIN_MS = 450;
const PHOTOS_MS = 900;
const HOLD_MS = 4000; // no narration clip: hold the caption this long
const NARRATION_CAP_MS = 45_000; // safety net if the clip never reports finished
const TICK_MS = 100;
const AMBIENT_VOLUME = 0.2;

// Drives the Replay film: camera flight -> pin drop -> photo fan -> narration -> next.
// All waits are pause-aware and cancel when a newer run starts (jump / restart / unmount).
export function useReplay(trip: Trip, mapRef: RefObject<MapView | null>) {
  const moments = useMemo(() => sortedMoments(trip), [trip]);

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

  const pausedRef = useRef(false);
  const runRef = useRef(0);
  const phaseRef = useRef<ReplayPhase>('idle');
  const momentRef = useRef<Moment | undefined>(undefined);

  const narrator = useAudioPlayer(null);
  const ambient = useAudioPlayer(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    // Fallback in case onMapReady never fires; start() is a no-op once running.
    const t = setTimeout(() => start(), 2000);
    return () => {
      clearTimeout(t);
      runRef.current++; // cancel any running timeline
    };
  }, []);

  const go = (p: ReplayPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Resolves true after `ms` of un-paused time, false if this run was superseded.
  const wait = (ms: number, run: number) =>
    new Promise<boolean>((resolve) => {
      let left = ms;
      const t = setInterval(() => {
        if (runRef.current !== run) {
          clearInterval(t);
          resolve(false);
          return;
        }
        if (!pausedRef.current) left -= TICK_MS;
        if (left <= 0) {
          clearInterval(t);
          resolve(true);
        }
      }, TICK_MS);
    });

  const playNarration = (uri: string, run: number) =>
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
        if (left <= 0) finish(true);
      }, TICK_MS);
      try {
        narrator.replace(uri);
        if (!pausedRef.current) narrator.play();
      } catch {
        finish(true);
      }
    });

  const startAmbient = (uri?: string) => {
    if (!uri) return;
    try {
      ambient.replace(uri);
      ambient.loop = true;
      ambient.volume = AMBIENT_VOLUME;
      if (!pausedRef.current) ambient.play();
    } catch {}
  };

  const stopAudio = () => {
    try {
      narrator.pause();
      ambient.pause();
    } catch {}
  };

  const run = async (from: number) => {
    const id = ++runRef.current;
    stopAudio();
    for (let i = from; i < moments.length; i++) {
      const m = moments[i];
      momentRef.current = m;
      setIndex(i);
      go('flying');
      mapRef.current?.animateCamera(
        {
          center: { latitude: m.lat, longitude: m.lng },
          pitch: 55,
          heading: m.headingDeg ?? 0,
          zoom: 17, // Google Maps
          altitude: 650, // Apple Maps
        },
        { duration: FLY_MS },
      );
      if (!(await wait(FLY_MS + TICK_MS, id))) return;

      go('pin');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const met = pairingStops.filter((p) => p.stopIndex === i).map((p) => p.pairingId);
      if (!(await wait(PIN_MS, id))) return;
      if (met.length) {
        setReachedPairings((prev) => Array.from(new Set([...prev, ...met])));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      go('photos');
      startAmbient(m.ambientUri);
      if (!(await wait(PHOTOS_MS, id))) return;

      go('narrating');
      const ok = m.narrationUri ? await playNarration(m.narrationUri, id) : await wait(HOLD_MS, id);
      if (!ok) return;
      try {
        ambient.pause();
      } catch {}
    }
    go('done');
  };

  const setPausedBoth = (p: boolean) => {
    pausedRef.current = p;
    setPaused(p);
  };

  const togglePause = () => {
    if (phaseRef.current === 'done' || phaseRef.current === 'idle') return;
    const next = !pausedRef.current;
    setPausedBoth(next);
    try {
      if (next) {
        narrator.pause();
        ambient.pause();
      } else {
        const m = momentRef.current;
        if (phaseRef.current === 'narrating' && m?.narrationUri) narrator.play();
        if ((phaseRef.current === 'photos' || phaseRef.current === 'narrating') && m?.ambientUri) ambient.play();
      }
    } catch {}
  };

  const jumpTo = (i: number) => {
    const target = Math.max(0, Math.min(i, moments.length - 1));
    setPausedBoth(false);
    setReachedPairings(pairingStops.filter((p) => p.stopIndex < target).map((p) => p.pairingId));
    run(target);
  };

  const start = () => {
    if (phaseRef.current !== 'idle') return;
    jumpTo(0);
  };

  return {
    moments,
    index,
    moment: index >= 0 ? moments[index] : undefined,
    phase,
    paused,
    reachedPairings,
    start,
    togglePause,
    jumpTo,
    restart: () => jumpTo(0),
  };
}
