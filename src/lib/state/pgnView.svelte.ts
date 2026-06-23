import { Chess } from 'chess.js';
import { STARTING_FEN } from '../constants';

export const pgnView = $state({
  active: false,
  moves: [] as Array<{ san: string; after: string }>,
  commentsMap: {} as Record<string, string>,
  label: '',
  currentMoveIndex: -1,
});

export function openPgnView(pgn: string): void {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const headers = chess.getHeaders();
    const allMoves = chess.history({ verbose: true }) as Array<{ san: string; after: string }>;

    const moves = allMoves.map(m => ({ san: m.san, after: m.after }));

    const commentsMap: Record<string, string> = {};
    for (const { fen, comment } of chess.getComments()) {
      commentsMap[fen] = comment;
    }

    function buildLabel(white: string, black: string, result: string, event: string, date: string): string {
      const ok = (v: string) => v && v !== '?' && v !== '*' && v !== '????.??.??' && v !== '-';
      const parts: string[] = [];

      if (ok(white) && ok(black)) {
        parts.push(`${white} vs ${black}${ok(result) ? `, ${result}` : ''}`);
      }

      const year = event?.match(/(\d{4})/)?.[1] || (ok(date) ? date.substring(0, 4) : '');
      const cleanEvent = event?.replace(/\s*\d{4}\s*$/, '').trim() || (ok(event) ? event : '');

      if (cleanEvent || year) parts.push([cleanEvent, year].filter(Boolean).join(', '));

      return parts.length > 0 ? parts.join(' · ') : 'Game';
    }

    const label = buildLabel(
      headers['White'] || '',
      headers['Black'] || '',
      headers['Result'] || '',
      headers['Event'] || '',
      headers['Date'] || '',
    );

    pgnView.active = true;
    pgnView.moves = moves;
    pgnView.commentsMap = commentsMap;
    pgnView.label = label;
    pgnView.currentMoveIndex = -1;
  } catch {
    // Invalid PGN — don't open
  }
}

export function closePgnView(): void {
  pgnView.active = false;
  pgnView.moves = [];
  pgnView.commentsMap = {};
  pgnView.label = '';
  pgnView.currentMoveIndex = -1;
}

export function pgnGoToMove(index: number): void {
  if (!pgnView.active) return;
  if (index < -1 || index >= pgnView.moves.length) return;
  pgnView.currentMoveIndex = index;
}

export function pgnCurrentFen(): string | null {
  if (!pgnView.active) return null;
  if (pgnView.currentMoveIndex === -1) return STARTING_FEN;
  return pgnView.moves[pgnView.currentMoveIndex].after;
}
