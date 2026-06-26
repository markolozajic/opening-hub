import { describe, it, expect } from 'vitest';
import { parseLichessUrl } from '../lib/utils/lichess';

describe('parseLichessUrl', () => {
  it('extracts game ID from standard URL', () => {
    expect(parseLichessUrl('https://lichess.org/abc123def')).toBe('abc123def');
  });

  it('extracts game ID from URL with trailing slash', () => {
    expect(parseLichessUrl('https://lichess.org/abc123def/')).toBe('abc123def');
  });

  it('extracts game ID from URL without protocol', () => {
    expect(parseLichessUrl('lichess.org/abc123def')).toBe('abc123def');
  });

  it('extracts game ID from URL with color parameter', () => {
    expect(parseLichessUrl('https://lichess.org/abc123def/white')).toBe('abc123def');
  });

  it('returns null for non-Lichess URL', () => {
    expect(parseLichessUrl('https://chess.com/game/123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseLichessUrl('')).toBeNull();
  });
});
