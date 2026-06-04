import type { ComfortLevel, SortMode } from '../types';
import { COMFORT_VALUE } from '../constants';

export function comfortRank(c: string | null | undefined): number {
  if (c == null) return Infinity;
  return COMFORT_VALUE[c] ?? 2;
}

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
  return [...moves].sort((a, b) => comfortRank(a.comfort) - comfortRank(b.comfort));
}

export function formatNumberedSan(depth: number | null, turn: 'w' | 'b', san: string): string {
  if (depth === null) return san;
  const moveNum = Math.floor(depth / 2) + 1;
  return turn === 'w' ? `${moveNum}. ${san}` : `${moveNum}...${san}`;
}
