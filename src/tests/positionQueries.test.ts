import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey } from '../lib/utils/fen';
import type { Position, Repertoire } from '../lib/types';
import { ROOT, A, B, C, D, ALT_A, ALT_B, ALT_C, makePos, makeRoot } from './helpers';

vi.mock('../lib/db/schema', () => ({}));

const { mockPositionCache } = vi.hoisted(() => {
  const cache: Record<string, Position> = {};
  return { mockPositionCache: cache };
});

vi.mock('../lib/db/positionStore.svelte', () => ({
  positionCache: mockPositionCache,
  getPosition: (repertoire: Repertoire, fen: string) =>
    mockPositionCache[cacheKey(repertoire, fen)],
}));

import { findMoveNumber, buildMovePath, findAllTranspositionPaths, getUnreachablePositions } from '../lib/utils/positionQueries';

function pos(fen: string, moves: Record<string, string> = {}, extra?: Partial<Position>): Position {
  const edges: Record<string, { toFen: string }> = {};
  for (const [san, toFen] of Object.entries(moves)) {
    edges[san] = { toFen };
  }
  return {
    repertoire: 'white',
    fen,
    moves: edges,
    links: [],
    pgnAttachments: [],
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockPositionCache)) {
    delete mockPositionCache[key];
  }
  mockPositionCache[cacheKey('white', ROOT)] = makeRoot('white');
  mockPositionCache[cacheKey('black', ROOT)] = makeRoot('black');
});

// ---------- findMoveNumber ----------

describe('findMoveNumber', () => {
  it('returns 0 for root', () => {
    expect(findMoveNumber('white', ROOT)).toBe(0);
  });

  it('returns 1 for depth-1 position', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    expect(findMoveNumber('white', A)).toBe(1);
  });

  it('returns correct depth for deeper positions', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: B });
    mockPositionCache[cacheKey('white', B)] = pos(B, { Nf3: C });
    mockPositionCache[cacheKey('white', C)] = pos(C);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    expect(findMoveNumber('white', C)).toBe(3);
  });

  it('returns null for unknown fen', () => {
    expect(findMoveNumber('white', 'nonexistent-fen')).toBeNull();
  });

  it('handles branching without affecting depth', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: B, c5: C });
    mockPositionCache[cacheKey('white', B)] = pos(B);
    mockPositionCache[cacheKey('white', C)] = pos(C);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    expect(findMoveNumber('white', B)).toBe(2);
    expect(findMoveNumber('white', C)).toBe(2);
  });
});

// ---------- buildMovePath ----------

describe('buildMovePath', () => {
  it('returns empty path for root', () => {
    expect(buildMovePath('white', ROOT)).toEqual([]);
  });

  it('returns path from root to target', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    const path = buildMovePath('white', A);
    expect(path).toHaveLength(1);
    expect(path[0].san).toBe('e4');
    expect(path[0].toFen).toBe(A);
    expect(path[0].fen).toBe(ROOT);
  });

  it('returns path with multiple steps', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: B });
    mockPositionCache[cacheKey('white', B)] = pos(B);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    const path = buildMovePath('white', B);
    expect(path).toHaveLength(2);
    expect(path[0].san).toBe('e4');
    expect(path[1].san).toBe('e5');
    expect(path[1].fen).toBe(A);
  });

  it('handles transpositions (returns first found path)', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: C });
    mockPositionCache[cacheKey('white', B)] = pos(B, { d5: C });
    mockPositionCache[cacheKey('white', C)] = pos(C);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A, d4: B });

    const path = buildMovePath('white', C);
    expect(path.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------- findAllTranspositionPaths ----------

describe('findAllTranspositionPaths', () => {
  it('returns empty array for root', () => {
    expect(findAllTranspositionPaths('white', ROOT)).toEqual([]);
  });

  it('returns single path when no transpositions', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: B });
    mockPositionCache[cacheKey('white', B)] = pos(B);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    const paths = findAllTranspositionPaths('white', B);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveLength(2);
  });

  it('returns multiple paths when transpositions exist', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { e5: C });
    mockPositionCache[cacheKey('white', B)] = pos(B, { d5: C });
    mockPositionCache[cacheKey('white', C)] = pos(C);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A, d4: B });

    const paths = findAllTranspositionPaths('white', C);
    expect(paths).toHaveLength(2);
  });

  it('does not revisit positions (cycle guard)', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A, { Bf3: B });
    mockPositionCache[cacheKey('white', B)] = pos(B, { Bg4: A });
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    const paths = findAllTranspositionPaths('white', B);
    expect(paths).toHaveLength(1);
  });
});

// ---------- getUnreachablePositions ----------

describe('getUnreachablePositions', () => {
  it('returns empty when all positions reachable', () => {
    mockPositionCache[cacheKey('white', A)] = pos(A);
    mockPositionCache[cacheKey('white', ROOT)] = pos(ROOT, { e4: A });

    expect(getUnreachablePositions('white')).toEqual([]);
  });

  it('includes positions not reachable from root', () => {
    mockPositionCache[cacheKey('white', 'orphan')] = pos('orphan');

    const unreachable = getUnreachablePositions('white');
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0].fen).toBe('orphan');
  });

  it('handles empty tree', () => {
    expect(getUnreachablePositions('white')).toEqual([]);
  });
});
