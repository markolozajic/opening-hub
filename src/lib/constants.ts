export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
export const STARTING_POSITION_COMMENT = `# Welcome to Opening Hub

Build, organize, and study your chess opening repertoire.

## Getting started

- **Add moves** — click a piece on the board, then click a target square
- **Edit details** — click the edit button to rename a position, add notes, links, or example games
- **Navigate** — use the arrow buttons or click a move in the move list
- **Organize** — assign comfort levels and move labels to track your progress
- **Prepare** — tag players at positions to track who plays what

## Features

- Separate repertoires for White and Black
- Import and export PGN or JSON
- Search positions by name or comment
- Detect issues like missing responses or transpositions
- Filter the move list to one player's repertoire for targeted preparation

Happy studying!`;
export const COMFORT_COLORS: Record<string, string> = {
  easy: '#096e2e',
  comfortable: '#75eba0',
  moderate: '#f59e0b',
  uncomfortable: '#f35353',
  struggling: '#990a0a',
};
export const COMFORT_LABELS: Record<string, string> = {
  easy: 'Easy',
  comfortable: 'Comfortable',
  moderate: 'Moderate',
  uncomfortable: 'Uncomfortable',
  struggling: 'Struggling',
};
export const MOVE_LABELS: Record<string, string> = {
  main: 'Main',
  alternative: 'Alternative',
  avoid: 'Avoid',
};
export const COMFORT_VALUE: Record<string, number> = {
  struggling: 0,
  uncomfortable: 1,
  moderate: 2,
  comfortable: 3,
  easy: 4,
};
export const COMFORT_SEVERITY: Record<string, number> = {
  easy: 0,
  comfortable: 1,
  moderate: 2,
  uncomfortable: 3,
  struggling: 4,
};
