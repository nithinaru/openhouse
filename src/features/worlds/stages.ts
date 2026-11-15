import type { World } from './api';

export type Stage = { key: 'send' | 'reconstruct' | 'paint' | 'ready' | 'failed'; label: string; progress: number };

/**
 * Progress line for a world build. World Labs exposes no percent, so the stage follows the
 * real request state (sending until the build call returns, ready/failed from the row) and
 * elapsed time against the expected duration in between. Capped at 96% until ready.
 */
export function stageFor(world: World | null, photoCount: number, sending: boolean, now: number): Stage {
  const photos = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
  if (world?.status === 'ready') return { key: 'ready', label: 'ready', progress: 1 };
  if (world?.status === 'failed') return { key: 'failed', label: "couldn't build this room", progress: 0 };
  if (sending || !world) return { key: 'send', label: `sending ${photos} to world labs`, progress: 0.06 };

  const t = Math.max(0, Math.min(1, (now - world.startedAt) / world.expectedMs));
  const progress = Math.min(0.96, 0.08 + t * 0.9);
  if (t < 0.12) return { key: 'send', label: `sending ${photos} to world labs`, progress };
  if (t < 0.6) return { key: 'reconstruct', label: 'reconstructing the room', progress };
  return { key: 'paint', label: 'painting gaussians', progress };
}
