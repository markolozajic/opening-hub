import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey, normalizeFen } from '../lib/utils/fen';
import { Chess } from 'chess.js';
import type { Position, Repertoire } from '../lib/types';
import { makePos, makeRoot, fenSeq } from './helpers';
import { STARTING_FEN } from '../lib/constants';

const { mockDbPut } = vi.hoisted(() => ({
  mockDbPut: vi.fn(),
}));

vi.mock('../lib/db/schema', () => ({
  db: { positions: { put: mockDbPut } },
}));

import { detectTranspositions, positionCache } from '../lib/db/positionStore.svelte';
import { initPositionStore } from '../lib/db/positionStore.svelte';

const ROOT = STARTING_FEN;
const A = fenSeq(['e4']);
const B = fenSeq(['e4', 'e5']);

beforeEach(async () => {
  for (const key of Object.keys(positionCache)) {
    delete positionCache[key];
  }
  positionCache[cacheKey('white', ROOT)] = makeRoot('white');
  positionCache[cacheKey('black', ROOT)] = makeRoot('black');
  mockDbPut.mockReset();
});

describe('detectTranspositions', () => {
  it('detects a transposition when legal move leads to existing position', async () => {
    positionCache[cacheKey('white', A)] = makePos('white', A, {});
    positionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {});

    positionCache[cacheKey('white', B)] = makePos('white', B, {});

    await detectTranspositions('white', ROOT);

    const rootPos = positionCache[cacheKey('white', ROOT)];
    expect(rootPos.moves['e4']).toBeDefined();
    expect(rootPos.moves['e4'].toFen).toBe(A);
    expect(rootPos.moves['e4'].autoDetected).toBe(true);
    expect(mockDbPut).toHaveBeenCalled();
  });

  it('skips moves that already exist', async () => {
    positionCache[cacheKey('white', A)] = makePos('white', A, {});
    positionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });

    await detectTranspositions('white', ROOT);

    expect(mockDbPut).not.toHaveBeenCalled();
  });

  it('skips dismissed transpositions', async () => {
    positionCache[cacheKey('white', A)] = makePos('white', A, {});
    positionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {}, {
      dismissedTranspositions: ['e4'],
    });

    await detectTranspositions('white', ROOT);

    expect(mockDbPut).not.toHaveBeenCalled();
  });

  it('does nothing when no target position exists for any legal move', async () => {
    positionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {});

    await detectTranspositions('white', ROOT);

    expect(mockDbPut).not.toHaveBeenCalled();
  });

  it('does nothing for position with no legal moves (impossible FEN)', async () => {
    const checkmateFen = 'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq -';
    positionCache[cacheKey('white', checkmateFen)] = makePos('white', checkmateFen, {});

    await detectTranspositions('white', checkmateFen);

    expect(mockDbPut).not.toHaveBeenCalled();
  });
});
