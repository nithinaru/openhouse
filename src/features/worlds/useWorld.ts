import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchWorld, type World } from './api';

/**
 * Polls worlds:forMoment. `pollMs` 0 fetches once (and on refresh()); the generation screen
 * uses 3000. Polling stops once the world is ready or failed; bump `epoch` to restart it
 * (after starting a new build).
 */
export function useWorld(momentId: string | undefined, pollMs = 0, epoch = 0) {
  const [world, setWorld] = useState<World | null>(null);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!momentId) return null;
    const w = await fetchWorld(momentId);
    if (alive.current) {
      setWorld(w);
      setLoaded(true);
    }
    return w;
  }, [momentId]);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const w = await refresh();
      const done = w && w.status !== 'pending';
      if (pollMs > 0 && alive.current && !done) timer = setTimeout(tick, pollMs);
    };
    tick();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh, pollMs, epoch]);

  return { world, loaded, refresh };
}
