import { Chess } from 'chess.js';
import { getPosition, addMove } from '../db/positionStore.svelte';
import { normalizeFen, getTurn } from './fen';
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

export function exportRepertoirePgn(repertoire: Repertoire): string {
  const ourSide = repertoire === 'white' ? 'w' : 'b';

  function formatMove(san: string, turn: 'w' | 'b', moveNum: number, startsVariation: boolean): string {
    if (turn === 'w') {
      return `${moveNum}. ${san}`;
    }
    return startsVariation ? `${moveNum}... ${san}` : san;
  }

  function walk(fen: string, ply: number, visited: Set<string>): string {
    if (visited.has(fen)) return '';
    visited.add(fen);

    const pos = getPosition(repertoire, fen);
    if (!pos) { visited.delete(fen); return ''; }

    const turn = getTurn(fen) as 'w' | 'b';
    const isOurTurn = turn === ourSide;
    const moveNum = Math.floor(ply / 2) + 1;

    const allMoves = Object.entries(pos.moves);
    const exportMoves = isOurTurn
      ? allMoves.filter(([, e]) => e.label !== 'alternative' && e.label !== 'avoid')
      : allMoves;

    if (exportMoves.length === 0) { visited.delete(fen); return ''; }

    const [mainSan, mainEdge] = exportMoves[0];
    const variations = exportMoves.slice(1);

    let result = ' ' + formatMove(mainSan, turn, moveNum, false);

    for (const [vSan, vEdge] of variations) {
      let varText = formatMove(vSan, turn, moveNum, true);
      varText += walk(vEdge.toFen, ply + 1, new Set(visited));
      result += ` (${varText.trim()})`;
    }

    result += walk(mainEdge.toFen, ply + 1, new Set(visited));

    visited.delete(fen);
    return result;
  }

  const result = walk(STARTING_FEN, 0, new Set());
  const header = `[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n`;
  return header + result.trim();
}
