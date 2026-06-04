import type { Repertoire } from '../types';

export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function toChessJsFen(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length >= 6) return fen;
  return fen + ' 0 1';
}

export function getTurn(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] as 'w' | 'b';
}

export function getSideLabel(turn: 'w' | 'b'): string {
  return turn === 'w' ? 'White to move' : 'Black to move';
}

export function cacheKey(repertoire: Repertoire, fen: string): string {
  return `${repertoire}|${fen}`;
}
