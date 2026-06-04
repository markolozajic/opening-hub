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

    function fmt(v: string): string {
      return v && v !== '?' && v !== '*' && v !== '????.??.??' && v !== '-' ? v : '';
    }

    function extractYear(text: string): string | null {
      const m = text.match(/(\d{4})/);
      return m ? m[1] : null;
    }

    function buildLabel(white: string, black: string, result: string, event: string, date: string): string {
      const parts: string[] = [];

      if (fmt(white) && fmt(black)) {
        let players = `${white} vs ${black}`;
        if (fmt(result)) players += `, ${result}`;
        parts.push(players);
      }

      const eventYear = event ? extractYear(event) : null;
      const dateYear = date && date !== '?' && date !== '????.??.??' ? date.substring(0, 4) : '';
      const year = eventYear || fmt(dateYear) || '';
      const cleanEvent = eventYear ? event.replace(/\s*\d{4}\s*$/, '').trim() : (fmt(event) || '');

      const eventParts: string[] = [];
      if (cleanEvent) eventParts.push(cleanEvent);
      if (year) eventParts.push(year);
      if (eventParts.length > 0) parts.push(eventParts.join(', '));

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
