import type { ComfortLevel, Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { getTurn } from '../utils/fen';
import { COMFORT_SEVERITY } from '../constants';
import { labelData } from './labels.svelte';

const comfortCache: Record<string, ComfortLevel | null> = {};

const PRIORITY_ORDER: ComfortLevel[] = ['easy', 'comfortable', 'moderate', 'uncomfortable', 'struggling'];

function fromPriority(p: number): ComfortLevel | null {
  return p >= 0 && p < PRIORITY_ORDER.length ? PRIORITY_ORDER[p] : null;
}

function aggregateComfort(
  repertoire: Repertoire,
  fen: string,
  ourSide: string,
  visited: Set<string>,
  isMainLine: boolean,
): number | null {
  if (visited.has(fen)) return null;
  visited.add(fen);

  const pos = getPosition(repertoire, fen);
  if (!pos) return null;

  const turn = getTurn(fen);

  const childValues: number[] = [];
  for (const [, edge] of Object.entries(pos.moves)) {
    if (edge.label === 'avoid') continue;
    if (turn === ourSide && isMainLine && edge.label === 'alternative') continue;

    const childIsMain = edge.label !== 'alternative';
    const val = aggregateComfort(repertoire, edge.toFen, ourSide, visited, childIsMain);
    if (val !== null) childValues.push(val);
  }

  if (childValues.length > 0) {
    return turn === ourSide ? Math.min(...childValues) : Math.max(...childValues);
  }

  return pos.comfortLevel != null ? COMFORT_SEVERITY[pos.comfortLevel] : null;
}

function computeComfortFor(repertoire: Repertoire, fen: string): ComfortLevel | null {
  const ourSide = repertoire === 'white' ? 'w' : 'b';
  const posLabel = labelData.positionLabels[fen];
  const isMainLine = posLabel !== 'alternative';
  const severity = aggregateComfort(repertoire, fen, ourSide, new Set(), isMainLine);
  if (severity === null) return null;
  return fromPriority(severity);
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
