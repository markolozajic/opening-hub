import { Chess } from 'chess.js';
import { getPosition, addMove } from '../db/positionStore.svelte';
import { normalizeFen, toChessJsFen } from './fen';
import type { Repertoire } from '../types';
import { STARTING_FEN } from '../constants';

export async function importPgn(repertoire: Repertoire, pgnText: string): Promise<number> {
  const chess = new Chess();
  try {
    chess.loadPgn(pgnText);
  } catch {
    throw new Error('Invalid PGN');
  }

  const history = chess.history({ verbose: true }) as Array<{
    san: string;
    after: string;
  }>;

  const rootFen = normalizeFen(STARTING_FEN);
  let prevFen = rootFen;
  let count = 0;

  for (const move of history) {
    const afterFen = normalizeFen(move.after);
    await addMove(repertoire, prevFen, move.san, afterFen);
    prevFen = afterFen;
    count++;
  }

  return count;
}

export function exportMainlinePgn(repertoire: Repertoire, fromFen?: string): string {
  const rootFen = normalizeFen(STARTING_FEN);
  const startFen = fromFen || rootFen;
  const chess = new Chess(toChessJsFen(startFen));
  let fen = startFen;

  const visited = new Set<string>();

  while (!visited.has(fen)) {
    visited.add(fen);
    const pos = getPosition(repertoire, fen);
    if (!pos || Object.keys(pos.moves).length === 0) break;

    const moves = Object.entries(pos.moves);
    const mainMove = moves.find(([, e]) => e.label === 'main');
    const [san] = mainMove ?? moves[0];

    try {
      chess.move(san);
      fen = normalizeFen(chess.fen());
    } catch {
      break;
    }
  }

  return chess.pgn();
}
