import type { ComfortLevel, Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { getTurn } from '../utils/fen';

const comfortCache: Record<string, ComfortLevel | null> = {};

function comfortPriority(level: ComfortLevel | null): number {
  if (level === 'uncomfortable') return 2;
  if (level === 'moderate') return 1;
  if (level === 'easy') return 0;
  return -1;
}

function fromPriority(p: number): ComfortLevel | null {
  if (p >= 2) return 'uncomfortable';
  if (p === 1) return 'moderate';
  if (p === 0) return 'easy';
  return null;
}

function computeComfortFor(repertoire: Repertoire, fen: string): ComfortLevel | null {
  const ourSide = repertoire === 'white' ? 'w' : 'b';
  const visited = new Set<string>();
  const stack = [fen];
  let worst = -1;
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const pos = getPosition(repertoire, current);
    if (!pos) continue;
    const p = comfortPriority(pos.comfortLevel ?? null);
    if (p > worst) worst = p;
    for (const [san, edge] of Object.entries(pos.moves)) {
      if (visited.has(edge.toFen)) continue;
      const turn = getTurn(current);
      if (turn === ourSide && edge.label !== 'main') continue;
      stack.push(edge.toFen);
    }
  }
  return fromPriority(worst);
}

export function getComfort(repertoire: Repertoire, fen: string): ComfortLevel | null {
  const key = `${repertoire}|${fen}`;
  if (key in comfortCache) return comfortCache[key];
  const result = computeComfortFor(repertoire, fen);
  comfortCache[key] = result;
  return result;
}

export function invalidateComfortCache(repertoire?: string, fen?: string): void {
  if (repertoire) {
    for (const key of Object.keys(comfortCache)) {
      if (key.startsWith(`${repertoire}|`)) {
        delete comfortCache[key];
      }
    }
  } else {
    for (const key of Object.keys(comfortCache)) {
      delete comfortCache[key];
    }
  }
}
