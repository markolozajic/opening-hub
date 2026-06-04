import { Chess } from 'chess.js';
import { normalizeFen } from '../lib/utils/fen';
import { STARTING_FEN } from '../lib/constants';
import { cacheKey } from '../lib/utils/fen';
import type { Position, Repertoire, MoveLabel, MoveEdge } from '../lib/types';

export function makePos(
  repertoire: Repertoire,
  fen: string,
  moves: Record<string, { toFen: string; label?: string; autoDetected?: boolean }>,
  extra?: Partial<Position>,
): Position {
  const edges: Record<string, MoveEdge> = {};
  for (const [san, edge] of Object.entries(moves)) {
    edges[san] = { toFen: edge.toFen, label: (edge.label ?? 'main') as MoveLabel };
  }
  return {
    repertoire,
    fen,
    moves: edges,
    links: [],
    pgnAttachments: [],
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

export function makeRoot(repertoire: Repertoire): Position {
  return makePos(repertoire, STARTING_FEN, {});
}

export function placeTree(
  cache: Record<string, Position>,
  repertoire: Repertoire,
  positions: Array<{ fen: string; moves: Record<string, { toFen: string; label?: string }>; extra?: Partial<Position> }>,
): void {
  for (const p of positions) {
    cache[cacheKey(repertoire, p.fen)] = makePos(repertoire, p.fen, p.moves, p.extra);
  }
}

export function fenSeq(moves: string[]): string {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return normalizeFen(chess.fen());
}

export const ROOT = STARTING_FEN;
export const A = fenSeq(['e4']);
export const B = fenSeq(['e4', 'e5']);
export const C = fenSeq(['e4', 'e5', 'Nf3']);
export const D = fenSeq(['e4', 'e5', 'Nf3', 'Nc6']);
export const ALT_A = fenSeq(['d4']);
export const ALT_B = fenSeq(['d4', 'd5']);
export const ALT_C = fenSeq(['d4', 'd5', 'Nf3']);
