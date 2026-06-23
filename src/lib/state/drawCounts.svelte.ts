import type { Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { getTurn } from '../utils/fen';
import { clearPrefix } from '../utils/helpers';

const drawCountsCache: Record<string, { forced: number; practical: number }> = {};

function computeFor(
  repertoire: string,
  fen: string,
  visited: Set<string>,
  isMainLine: boolean,
): { forced: number; practical: number } {
  if (visited.has(fen)) return { forced: 0, practical: 0 };
  visited.add(fen);

  const pos = getPosition(repertoire as Repertoire, fen);
  if (!pos) return { forced: 0, practical: 0 };

  const edgeKeys = Object.keys(pos.moves);
  if (edgeKeys.length === 0) {
    return {
      forced: pos.forcedDraw ? 1 : 0,
      practical: pos.practicalDraw ? 1 : 0,
    };
  }

  const ourSide = repertoire === 'white' ? 'w' : 'b';
  const turn = getTurn(fen);

  let forced = 0;
  let practical = 0;
  for (const edge of Object.values(pos.moves)) {
    if (edge.label === 'avoid') continue;
    if (turn === ourSide && isMainLine && edge.label === 'alternative') continue;

    const childIsMain = edge.label !== 'alternative';
    const child = computeFor(repertoire, edge.toFen, visited, childIsMain);
    forced += child.forced;
    practical += child.practical;
  }

  return { forced, practical };
}

export function getDrawCounts(repertoire: Repertoire, fen: string): { forced: number; practical: number } {
  const key = `${repertoire}|${fen}`;
  if (key in drawCountsCache) return drawCountsCache[key];
  const result = computeFor(repertoire, fen, new Set(), true);
  drawCountsCache[key] = result;
  return result;
}

export function invalidateDrawCounts(repertoire?: string): void {
  clearPrefix(drawCountsCache as Record<string, unknown>, repertoire);
}
