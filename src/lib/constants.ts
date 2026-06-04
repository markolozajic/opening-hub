export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
export const COMFORT_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f59e0b',
  uncomfortable: '#ef4444',
};
export const COMFORT_LABELS: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  uncomfortable: 'Uncomfortable',
};
export const MOVE_LABELS: Record<string, string> = {
  main: 'Main',
  alternative: 'Alternative',
  avoid: 'Avoid',
};
export const MOVE_LABEL_COLORS: Record<string, string> = {
  main: '#d97706',
  alternative: '#2563eb',
  avoid: '#dc2626',
};
export const COMFORT_RANK: Record<string, number> = {
  uncomfortable: 0,
  moderate: 1,
  easy: 2,
};
export const COMFORT_PRIORITY: Record<string, number> = {
  easy: 0,
  moderate: 1,
  uncomfortable: 2,
};
