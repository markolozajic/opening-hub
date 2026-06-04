import type { Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { STARTING_FEN } from '../constants';

const noveltyCache: Record<string, boolean> = {};

function computeNoveltyFor(repertoire: Repertoire, fen: string): boolean {
  if (fen === STARTING_FEN) return false;

  const familiar = new Set<string>();
  const queueFamiliar = [STARTING_FEN];
  familiar.add(STARTING_FEN);

  while (queueFamiliar.length > 0) {
    const f = queueFamiliar.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (edge.marker !== 'N' && !familiar.has(edge.toFen)) {
        familiar.add(edge.toFen);
        queueFamiliar.push(edge.toFen);
      }
    }
  }

  if (familiar.has(fen)) return false;

  const reachable = new Set<string>();
  const queueAll = [STARTING_FEN];
  reachable.add(STARTING_FEN);

  while (queueAll.length > 0) {
    const f = queueAll.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (!reachable.has(edge.toFen)) {
        reachable.add(edge.toFen);
        queueAll.push(edge.toFen);
      }
    }
  }

  return reachable.has(fen);
}

export function getNovelty(repertoire: Repertoire, fen: string): boolean {
  const key = `${repertoire}|${fen}`;
  if (key in noveltyCache) return noveltyCache[key];
  const result = computeNoveltyFor(repertoire, fen);
  noveltyCache[key] = result;
  return result;
}

export function invalidateNoveltyCache(repertoire?: string, fen?: string): void {
  if (repertoire) {
    for (const key of Object.keys(noveltyCache)) {
      if (key.startsWith(`${repertoire}|`)) {
        delete noveltyCache[key];
      }
    }
  } else {
    for (const key of Object.keys(noveltyCache)) {
      delete noveltyCache[key];
    }
  }
}
