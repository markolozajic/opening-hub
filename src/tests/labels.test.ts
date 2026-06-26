import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey } from '../lib/utils/fen';
import type { Position, Repertoire } from '../lib/types';
import { ROOT, A, B, C, ALT_A, ALT_B, makePos, makeRoot, fenSeq } from './helpers';

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

import { recomputeLabels, labelData } from '../lib/state/labels.svelte';

beforeEach(() => {
  for (const key of Object.keys(mockPositionCache)) {
    delete mockPositionCache[key];
  }
  mockPositionCache[cacheKey('white', ROOT)] = makeRoot('white');
  mockPositionCache[cacheKey('black', ROOT)] = makeRoot('black');
  labelData.positionLabels = {};
  labelData.moveLabels = {};
  labelData.issueCount = 0;
  labelData.issuePositions = [];
});

// ---------- Simple inheritance ----------

describe('label propagation', () => {
  it('inherits main for our moves with no explicit label', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[ROOT]).toBeNull();
    expect(labelData.moveLabels[ROOT]?.['e4']).toBe('main');
    expect(labelData.positionLabels[A]).toBe('main');
  });

  it('walks deeper levels', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: B } });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.positionLabels[A]).toBe('main');
    expect(labelData.positionLabels[B]).toBe('main');
    expect(labelData.moveLabels[A]?.['e5']).toBe('main');
  });

  it('inherits opponent moves from position label', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: B } });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.moveLabels[A]?.['e5']).toBe('main');
  });
});

// ---------- Override via explicit labels ----------

describe('explicit label overrides', () => {
  it('alternative label overrides inheritance', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'alternative' },
    });
    recomputeLabels('white');

    expect(labelData.moveLabels[ROOT]?.['e4']).toBe('alternative');
    expect(labelData.positionLabels[A]).toBe('alternative');
  });

  it('avoid label overrides inheritance', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'avoid' },
    });
    recomputeLabels('white');

    expect(labelData.moveLabels[ROOT]?.['e4']).toBe('avoid');
    expect(labelData.positionLabels[A]).toBe('avoid');
  });

  it('our moves at our-turn position inherit from context when no explicit label', () => {
    const posB_whiteTurn = 'rnbqkbnr/pppppppp/8/8/4Pp2/8/PPPP1PPP/RNBQKBNR w KQkq -';
    const posC = 'rnbqkbnr/pppppppp/8/8/4Pp2/5N2/PPPP1PPP/RNBQKB1R b KQkq -';

    mockPositionCache[cacheKey('white', B)] = makePos('white', B, {
      Nf3: { toFen: posC, label: 'alternative' },
    });
    mockPositionCache[cacheKey('white', posC)] = makePos('white', posC, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: B } });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.positionLabels[A]).toBe('main');
    expect(labelData.moveLabels[A]?.['e5']).toBe('main');
    expect(labelData.positionLabels[B]).toBe('main');
    expect(labelData.moveLabels[B]?.['Nf3']).toBe('alternative');
    expect(labelData.positionLabels[posC]).toBe('alternative');
  });
});

// ---------- Dominance ----------

describe('dominance', () => {
  const X = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq -';

  it('main dominates alternative when both paths reach same position', () => {
    mockPositionCache[cacheKey('white', X)] = makePos('white', X, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: X },
      d4: { toFen: X, label: 'alternative' },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[X]).toBe('main');
  });

  it('avoid dominates main', () => {
    mockPositionCache[cacheKey('white', X)] = makePos('white', X, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: X },
      d4: { toFen: X, label: 'avoid' },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[X]).toBe('avoid');
  });

  it('avoid dominates alternative', () => {
    mockPositionCache[cacheKey('white', X)] = makePos('white', X, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: X, label: 'alternative' },
      d4: { toFen: X, label: 'avoid' },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[X]).toBe('avoid');
  });

  it('processes black repertoire correctly', () => {
    mockPositionCache[cacheKey('black', A)] = makePos('black', A, {});
    mockPositionCache[cacheKey('black', ROOT)] = makePos('black', ROOT, {
      e4: { toFen: A },
    });
    recomputeLabels('black');

    expect(labelData.positionLabels[ROOT]).toBeNull();
    expect(labelData.moveLabels[ROOT]?.['e4']).toBe('main');
    expect(labelData.positionLabels[A]).toBeNull();
  });

  it('explicit main label overrides alternative position label', () => {
    mockPositionCache[cacheKey('white', ALT_A)] = makePos('white', ALT_A, { d5: { toFen: ALT_B } });
    mockPositionCache[cacheKey('white', ALT_B)] = makePos('white', ALT_B, { Nf3: { toFen: C, label: 'main' } });
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      d4: { toFen: ALT_A, label: 'alternative' },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[ALT_B]).toBe('alternative');
    expect(labelData.moveLabels[ALT_B]?.['Nf3']).toBe('main');
    expect(labelData.positionLabels[C]).toBe('main');
  });
});

// ---------- Issues ----------

describe('issue detection', () => {
  const ourTurnPos = 'rnbqkbnr/pppppppp/8/8/4Pp2/8/PPPP1PPP/RNBQKBNR w KQkq -';
  const child = 'rnbqkbnr/pppppppp/8/8/4Pp2/5N2/PPPP1PPP/RNBQKB1R b KQkq -';

  it('flags non-avoid our-turn position with all-avoid children', () => {
    mockPositionCache[cacheKey('white', ourTurnPos)] = makePos('white', ourTurnPos, {
      Nf3: { toFen: child, label: 'avoid' },
    });
    mockPositionCache[cacheKey('white', child)] = makePos('white', child, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: ourTurnPos } });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.issueCount).toBe(1);
    expect(labelData.issuePositions[0].fen).toBe(ourTurnPos);
  });

  it('does not flag avoid position with all-avoid children', () => {
    const other = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -';
    mockPositionCache[cacheKey('white', ourTurnPos)] = makePos('white', ourTurnPos, {
      Nf3: { toFen: child, label: 'avoid' },
    });
    mockPositionCache[cacheKey('white', child)] = makePos('white', child, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: ourTurnPos, label: 'avoid' } });
    mockPositionCache[cacheKey('white', other)] = makePos('white', other, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      e4: { toFen: A, label: 'avoid' },
      d4: { toFen: other, label: 'main' },
    });
    recomputeLabels('white');

    expect(labelData.issueCount).toBe(0);
  });

  it('no issues for normal main line', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: B } });
    mockPositionCache[cacheKey('white', B)] = makePos('white', B, { Nf3: { toFen: C } });
    mockPositionCache[cacheKey('white', C)] = makePos('white', C, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.issueCount).toBe(0);
  });

  it('does not flag leaf positions', () => {
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.issueCount).toBe(0);
  });

  it('transposition upgrade re-processes children with corrected label', () => {
    const TRANS = fenSeq(['d4', 'e6', 'e4']);
    const CHILD_TRANS = fenSeq(['d4', 'e6', 'e4', 'Nf6']);

    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e6: { toFen: TRANS } });
    mockPositionCache[cacheKey('white', ALT_A)] = makePos('white', ALT_A, { e6: { toFen: TRANS } });
    mockPositionCache[cacheKey('white', TRANS)] = makePos('white', TRANS, { Nf6: { toFen: CHILD_TRANS } });
    mockPositionCache[cacheKey('white', CHILD_TRANS)] = makePos('white', CHILD_TRANS, {});
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, {
      d4: { toFen: ALT_A, label: 'alternative' },
      e4: { toFen: A },
    });
    recomputeLabels('white');

    expect(labelData.positionLabels[TRANS]).toBe('main');
    expect(labelData.positionLabels[CHILD_TRANS]).toBe('main');
    expect(labelData.moveLabels[TRANS]?.['Nf6']).toBe('main');
  });

  it('flags main position with only alternative children', () => {
    const child2 = 'rnbqkbnr/pppppppp/8/8/4Pp2/2P5/PPPP1PPP/RNBQKBNR b KQkq -';
    mockPositionCache[cacheKey('white', ourTurnPos)] = makePos('white', ourTurnPos, {
      Nf3: { toFen: child, label: 'avoid' },
      Bc4: { toFen: child2, label: 'alternative' },
    });
    mockPositionCache[cacheKey('white', child)] = makePos('white', child, {});
    mockPositionCache[cacheKey('white', child2)] = makePos('white', child2, {});
    mockPositionCache[cacheKey('white', A)] = makePos('white', A, { e5: { toFen: ourTurnPos } });
    mockPositionCache[cacheKey('white', ROOT)] = makePos('white', ROOT, { e4: { toFen: A } });
    recomputeLabels('white');

    expect(labelData.issueCount).toBe(1);
    expect(labelData.issuePositions[0].fen).toBe(ourTurnPos);
  });
});
