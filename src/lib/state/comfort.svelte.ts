import type { ComfortLevel, Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { getTurn } from '../utils/fen';
import { COMFORT_SEVERITY } from '../constants';

const comfortCache: Record<string, ComfortLevel | null> = {};

const PRIORITY_ORDER: ComfortLevel[] = ['easy', 'comfortable', 'moderate', 'uncomfortable', 'struggling'];

function fromPriority(p: number): ComfortLevel | null {
  return p >= 0 && p < PRIORITY_ORDER.length ? PRIORITY_ORDER[p] : null;
}

function visibleChildren(pos: { moves: Record<string, { toFen: string; label?: string }> }, fen: string, ourSide: string): string[] {
  const children: string[] = [];
  for (const [san, edge] of Object.entries(pos.moves)) {
    const turn = getTurn(fen);
    if (turn === ourSide && (edge.label === 'alternative' || edge.label === 'avoid')) continue;
    children.push(edge.toFen);
  }
  return children;
}

function collectLeafComforts(repertoire: Repertoire, fen: string, ourSide: string, visited: Set<string>): number[] {
  if (visited.has(fen)) return [];
  visited.add(fen);

  const pos = getPosition(repertoire, fen);
  if (!pos) return [];

  const children = visibleChildren(pos, fen, ourSide);

  if (children.length === 0) {
    return pos.comfortLevel != null ? [COMFORT_SEVERITY[pos.comfortLevel]] : [];
  }

  const results: number[] = [];
  for (const child of children) {
    results.push(...collectLeafComforts(repertoire, child, ourSide, visited));
  }
  return results;
}

function computeComfortFor(repertoire: Repertoire, fen: string): ComfortLevel | null {
  const ourSide = repertoire === 'white' ? 'w' : 'b';
  const leafValues = collectLeafComforts(repertoire, fen, ourSide, new Set());
  if (leafValues.length === 0) return null;
  return fromPriority(Math.max(...leafValues));
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
