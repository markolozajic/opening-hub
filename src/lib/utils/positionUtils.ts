import type { ComfortLevel, SortMode } from '../types';
import { COMFORT_VALUE } from '../constants';

export function sortMoves<T extends { san: string; comfort: ComfortLevel | null }>(
  moveOrder: string[] | undefined,
  moves: T[],
  sortMode?: SortMode,
): T[] {
  if (sortMode === 'manual') {
    if (!moveOrder || moveOrder.length === 0) return [...moves];
    const orderSet = new Set(moveOrder);
    const ordered = moveOrder.filter(san => moves.some(m => m.san === san));
    const unordered = moves.filter(m => !orderSet.has(m.san));
    return [...ordered.map(san => moves.find(m => m.san === san)!), ...unordered];
  }
  return [...moves].sort((a, b) => {
    const ar = a.comfort == null ? Infinity : (COMFORT_VALUE[a.comfort] ?? 2);
    const br = b.comfort == null ? Infinity : (COMFORT_VALUE[b.comfort] ?? 2);
    return ar - br;
  });
}

export function formatNumberedSan(depth: number | null, turn: 'w' | 'b', san: string): string {
  if (depth === null) return san;
  const moveNum = Math.floor(depth / 2) + 1;
  return turn === 'w' ? `${moveNum}. ${san}` : `${moveNum}...${san}`;
}
