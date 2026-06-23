import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey } from '../lib/utils/fen';
import type { Position, Repertoire } from '../lib/types';
import { ROOT, A, B, C, makePos, makeRoot } from './helpers';

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

import { getComfort, invalidateComfortCache } from '../lib/state/comfort.svelte';

// Our-turn position (White to move after 1.e4 e5) used for main-line filter tests
const OUR_TURN = 'rnbqkbnr/pppppppp/8/8/4Pp2/8/PPPP1PPP/RNBQKBNR w KQkq -';
const CHILD_EASY = 'rnbqkbnr/pppppppp/8/8/4Pp2/5N2/PPPP1PPP/RNBQKB1R b KQkq -';
const CHILD_HARD = 'rnbqkbnr/pppppppp/8/8/4Pp2/2P5/PPPP1PPP/RNBQKBNR b KQkq -';

beforeEach(() => {
  for (const key of Object.keys(mockPositionCache)) {
    delete mockPositionCache[key];
  }
  mockPositionCache[cacheKey('white', ROOT)] = makeRoot('white');
  mockPositionCache[cacheKey('black', ROOT)] = makeRoot('black');
  invalidateComfortCache();
});

// ---------- Basic comfort ----------

describe('basic comfort', () => {
  it('returns the stored comfort for a leaf position', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('easy');
  });

  it('returns null when no comfort is set anywhere', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', ROOT)).toBeNull();
    expect(getComfort('white', A)).toBeNull();
  });

  it('uses the deepest explicit comfort level', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      e5: { toFen: B },
    });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {}, { comfortLevel: 'uncomfortable' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('uncomfortable');
    expect(getComfort('white', ROOT)).toBe('uncomfortable');
  });

  it('leaf comfort overrides a parent comfort on the same branch', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      e5: { toFen: B },
    }, { comfortLevel: 'moderate' });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('easy');
    expect(getComfort('white', ROOT)).toBe('easy');
  });

  it('among multiple leaves the worst wins', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      e5: { toFen: B },
      Nf6: { toFen: C },
    });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {}, { comfortLevel: 'uncomfortable' });
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('uncomfortable');
  });
});

// ---------- Main-line filter ----------

describe('main-line filter', () => {
  it('only follows main-labeled moves for our-turn positions', () => {
    mockPositionCache[cacheKey('white', OUR_TURN)] = makePos('white', OUR_TURN, {
      Nf3: { toFen: CHILD_EASY, label: 'main' },
      Bc4: { toFen: CHILD_HARD, label: 'alternative' },
    });
    mockPositionCache[cacheKey('white', CHILD_EASY)] = makePos('white', CHILD_EASY, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', CHILD_HARD)] = makePos('white', CHILD_HARD, {}, { comfortLevel: 'uncomfortable' });
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: OUR_TURN } });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A, label: 'main' } });

    expect(getComfort('white', OUR_TURN)).toBe('easy');
  });

  it('follows all moves for opponent-turn positions', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      e5: { toFen: B },
      Nf6: { toFen: C },
    });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {}, { comfortLevel: 'uncomfortable' });
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('uncomfortable');
  });
});

// ---------- Caching ----------

describe('caching', () => {
  it('caches after first computation', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {}, { comfortLevel: 'moderate' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('moderate');
    expect(getComfort('white', A)).toBe('moderate');
  });

  it('recomputes after invalidation', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'main' },
    });

    expect(getComfort('white', A)).toBe('easy');

    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {}, { comfortLevel: 'uncomfortable' });
    invalidateComfortCache('white');
    expect(getComfort('white', A)).toBe('uncomfortable');
  });

  it('invalidate by repertoire only clears that repertoire', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {}, { comfortLevel: 'moderate' });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A, label: 'main' } });
    mockPositionCache[cacheKey('black', A)] = makePos('black', A, {}, { comfortLevel: 'easy' });
    mockPositionCache[cacheKey('black', ROOT)] = makePos('black', ROOT, { e4: { toFen: A } });

    getComfort('white', A);
    getComfort('black', A);

    invalidateComfortCache('white');

    expect(getComfort('black', A)).toBe('easy');
  });
});
