import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey } from '../lib/utils/fen';
import type { Position, Repertoire } from '../lib/types';
import { ROOT, A, B, C, makePos, makeRoot, fenSeq } from './helpers';

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

import { getNovelty, invalidateNoveltyCache, getOnlineNovelty, invalidateOnlineNoveltyCache } from '../lib/state/novelty.svelte';

const ORPHAN = fenSeq(['d4']);

beforeEach(() => {
  for (const key of Object.keys(mockPositionCache)) {
    delete mockPositionCache[key];
  }
  mockPositionCache[cacheKey('white', ROOT)] = makeRoot('white');
  invalidateNoveltyCache();
  invalidateOnlineNoveltyCache();
});

describe('getNovelty', () => {
  it('returns false for root', () => {
    expect(getNovelty('white', ROOT)).toBe(false);
  });

  it('returns false for positions on a non-novelty path', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    expect(getNovelty('white', A)).toBe(false);
  });

  it('returns true for position beyond an N novelty edge', () => {
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      Nf3: { toFen: C },
    });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    mockPositionCache[cacheKey('white', A)].moves['Nf3'].isNovelty = true;
    expect(getNovelty('white', C)).toBe(true);
  });

  it('returns false for unreachable positions', () => {
    mockPositionCache[cacheKey('white', ORPHAN)] = makePos('white', ORPHAN, {});
    expect(getNovelty('white', ORPHAN)).toBe(false);
  });

  it('recomputes after invalidation when data changes', () => {
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      Nf3: { toFen: C },
    });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    expect(getNovelty('white', C)).toBe(false);

    mockPositionCache[cacheKey('white', A)].moves['Nf3'].isNovelty = true;
    invalidateNoveltyCache('white');
    expect(getNovelty('white', C)).toBe(true);
  });
});

describe('getOnlineNovelty', () => {
  it('returns false for positions on a non-novelty path', () => {
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      d4: { toFen: B },
    });
    expect(getOnlineNovelty('white', B)).toBe(false);
  });

  it('returns true for position beyond an ON novelty edge', () => {
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {
      Nf3: { toFen: C },
    });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    mockPositionCache[cacheKey('white', A)].moves['Nf3'].isOnlineNovelty = true;
    expect(getOnlineNovelty('white', C)).toBe(true);
  });

  it('invalidates independently from getNovelty', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    getNovelty('white', A);
    getOnlineNovelty('white', A);

    invalidateNoveltyCache('white');
    getNovelty('white', A);
    expect(getOnlineNovelty('white', A)).toBe(false);
  });
});
