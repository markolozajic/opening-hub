import { Chess } from 'chess.js';
import { toChessJsFen } from '../utils/fen';
import type { VerboseMove } from '../types';

export function getLegalMoves(fen: string): VerboseMove[] {
  try {
    const chess = new Chess(toChessJsFen(fen));
    return (chess.moves({ verbose: true }) as VerboseMove[]).map(m => ({
      from: m.from,
      to: m.to,
      san: m.san,
      color: m.color,
    }));
  } catch {
    return [];
  }
}

export function getPieceAt(fen: string, sq: string): { color: 'w' | 'b'; type: string } | null {
  try {
    const chess = new Chess(toChessJsFen(fen));
    const [f, r] = [sq.charCodeAt(0) - 97, 8 - parseInt(sq[1])];
    const board = chess.board();
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const p = board[r][f];
      return p ? { color: p.color, type: p.type } : null;
    }
    return null;
  } catch {
    return null;
  }
}
