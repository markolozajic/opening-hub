export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const LIGHT_SQUARE = '#f0d9b5';
export const DARK_SQUARE = '#b58863';

export const PIECE_URL: Record<string, string> = {
  wK: '/pieces/wk.svg', wQ: '/pieces/wq.svg', wR: '/pieces/wr.svg',
  wB: '/pieces/wb.svg', wN: '/pieces/wn.svg', wP: '/pieces/wp.svg',
  bK: '/pieces/bk.svg', bQ: '/pieces/bq.svg', bR: '/pieces/br.svg',
  bB: '/pieces/bb.svg', bN: '/pieces/bn.svg', bP: '/pieces/bp.svg',
};

export function parseFenBoard(fen: string): (string | null)[][] {
  const placement = fen.split(' ')[0];
  const rows: (string | null)[][] = [];
  for (const row of placement.split('/')) {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        const empty = parseInt(ch);
        for (let i = 0; i < empty; i++) cells.push(null);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        cells.push(color + ch.toUpperCase());
      }
    }
    rows.push(cells);
  }
  return rows;
}

export function getSquareColor(file: number, rank: number): 'light' | 'dark' {
  return (file + rank) % 2 === 0 ? 'light' : 'dark';
}

export function displayToReal(
  displayFile: number,
  displayRank: number,
  flipped: boolean
): { file: number; rank: number; sq: string } {
  const realFile = flipped ? 7 - displayFile : displayFile;
  const realRank = flipped ? 7 - displayRank : displayRank;
  return { file: realFile, rank: realRank, sq: FILES[realFile] + RANKS[realRank] };
}

export function realToDisplay(
  file: number,
  rank: number,
  flipped: boolean
): { displayFile: number; displayRank: number } {
  return {
    displayFile: flipped ? 7 - file : file,
    displayRank: flipped ? 7 - rank : rank,
  };
}

export function parseSq(sq: string): { file: number; rank: number } {
  return { file: FILES.indexOf(sq[0]), rank: RANKS.indexOf(sq[1]) };
}
