import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheKey } from '../lib/utils/fen';
import { STARTING_FEN } from '../lib/constants';
import type { Position, Repertoire } from '../lib/types';

const { mockPositionCache, mockGetRootFen, mockGetPosition } = vi.hoisted(() => {
  const cache: Record<string, Position> = {};
  return {
    mockPositionCache: cache,
    mockGetRootFen: () => STARTING_FEN,
    mockGetPosition: (repertoire: Repertoire, fen: string) =>
      cache[cacheKey(repertoire, fen)],
  };
});

vi.mock('../lib/db/positionStore.svelte', () => ({
  positionCache: mockPositionCache,
  getRootFen: mockGetRootFen,
  getPosition: mockGetPosition,
}));

vi.mock('../lib/db/schema', () => ({}));

import {
  nav,
  navigateTo,
  navigatePath,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  navigateToRoot,
  switchRepertoire,
} from '../lib/state/navigation.svelte';
import { buildMovePath } from '../lib/utils/positionQueries';
import type { MovePathStep } from '../lib/types';

function makeRoot(repertoire: Repertoire): Position {
  return {
    repertoire,
    fen: STARTING_FEN,
    moves: {},
    links: [],
    pgnAttachments: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function makePos(repertoire: Repertoire, fen: string, moves: Record<string, { toFen: string }>): Position {
  const edges: Record<string, { toFen: string }> = {};
  for (const [san, edge] of Object.entries(moves)) {
    edges[san] = { toFen: edge.toFen };
  }
  return {
    repertoire,
    fen,
    moves: edges,
    links: [],
    pgnAttachments: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

beforeEach(() => {
  for (const key of Object.keys(mockPositionCache)) {
    delete mockPositionCache[key];
  }
  mockPositionCache[cacheKey('white', STARTING_FEN)] = makeRoot('white');
  mockPositionCache[cacheKey('black', STARTING_FEN)] = makeRoot('black');

  nav.activeRepertoire = 'white';
  nav.currentFen = STARTING_FEN;
  nav.backStack = [];
  nav.forwardStack = [];
  nav.currentPath = [];
  nav.showMoveChooser = false;
});

// ---------- navigateTo ----------

describe('navigateTo', () => {
  it('sets currentFen and clears stacks', () => {
    const targetFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -';
    navigateTo(targetFen);
    expect(nav.currentFen).toBe(targetFen);
    expect(nav.backStack).toEqual([]);
    expect(nav.forwardStack).toEqual([]);
  });

  it('no-ops when navigating to the same FEN', () => {
    nav.currentFen = 'some-fen';
    nav.backStack = ['old-entry'];
    navigateTo('some-fen');
    expect(nav.backStack).toEqual(['old-entry']);
    expect(nav.currentFen).toBe('some-fen');
  });

  it('rebuilds currentPath from buildMovePath', () => {
    const childFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -';
    mockPositionCache[cacheKey('white', childFen)] = makePos('white', childFen, {});
    mockPositionCache[cacheKey('white', STARTING_FEN)] = makePos('white', STARTING_FEN, {
      e4: { toFen: childFen },
    });

    navigateTo(childFen);
    expect(nav.currentPath.length).toBe(1);
    expect(nav.currentPath[0].san).toBe('e4');
    expect(nav.currentPath[0].toFen).toBe(childFen);
  });
});

// ---------- navigatePath ----------

describe('navigatePath', () => {
  const fenA = 'fen-after-e4';
  const fenB = 'fen-after-e5';
  const fenC = 'fen-after-Nf3';
  const path: MovePathStep[] = [
    { fen: STARTING_FEN, toFen: fenA, san: 'e4' },
    { fen: fenA, toFen: fenB, san: 'e5' },
    { fen: fenB, toFen: fenC, san: 'Nf3' },
  ];

  it('walks a full path from root', () => {
    navigatePath(path, 2);
    expect(nav.currentFen).toBe(fenC);
    expect(nav.currentPath).toEqual(path);
    expect(nav.backStack).toEqual([STARTING_FEN, fenA, fenB]);
    expect(nav.forwardStack).toEqual([]);
  });

  it('walks a partial path from root up to target index', () => {
    navigatePath(path, 1);
    expect(nav.currentFen).toBe(fenB);
    expect(nav.currentPath).toEqual([path[0], path[1]]);
    expect(nav.backStack).toEqual([STARTING_FEN, fenA]);
  });

  it('resumes from current position in the path', () => {
    nav.currentFen = fenA;
    navigatePath(path, 2);
    expect(nav.currentFen).toBe(fenC);
    expect(nav.currentPath).toEqual([path[1], path[2]]);
    expect(nav.backStack).toEqual([fenA, fenB]);
  });

  it('no-ops when already at or past target', () => {
    nav.currentFen = fenC;
    navigatePath(path, 2);
    expect(nav.currentFen).toBe(fenC);
    expect(nav.currentPath).toEqual([]);
    expect(nav.backStack).toEqual([]);
  });

  it('resets currentPath instead of appending', () => {
    nav.currentPath = [{ fen: 'old', toFen: 'old', san: 'old' }];
    navigatePath(path, 0);
    expect(nav.currentPath).toEqual([path[0]]);
    expect(nav.currentPath).not.toContainEqual({ fen: 'old', toFen: 'old', san: 'old' });
  });
});

// ---------- goBack (stack path) ----------

describe('goBack from backStack', () => {
  const fenA = 'fen-a';
  const fenB = 'fen-b';
  const step: MovePathStep = { fen: fenA, toFen: fenB, san: 'Nf3' };

  beforeEach(() => {
    nav.backStack = [STARTING_FEN, fenA];
    nav.currentFen = fenB;
    nav.currentPath = [
      { fen: STARTING_FEN, toFen: fenA, san: 'e4' },
      { fen: fenA, toFen: fenB, san: 'e5' },
      step,
    ];
    nav.forwardStack = [];
  });

  it('pops backStack and pushes currentFen to forwardStack', () => {
    const result = goBack();
    expect(result).toBe(fenA);
    expect(nav.currentFen).toBe(fenA);
    expect(nav.backStack).toEqual([STARTING_FEN]);
    expect(nav.forwardStack).toEqual([step]);
  });

  it('pops currentPath and returns the undone step to forwardStack', () => {
    goBack();
    expect(nav.currentPath).toEqual([
      { fen: STARTING_FEN, toFen: fenA, san: 'e4' },
      { fen: fenA, toFen: fenB, san: 'e5' },
    ]);
    expect(nav.forwardStack[0]).toEqual(step);
    expect(nav.currentPath.length).toBe(2);
  });

  it('chains multiple backs', () => {
    goBack();
    goBack();
    expect(nav.currentFen).toBe(STARTING_FEN);
    expect(nav.backStack).toEqual([]);
    expect(nav.currentPath.length).toBe(1);
    expect(nav.forwardStack.length).toBe(2);
  });
});

// ---------- goBack (tree fallback) ----------

describe('goBack tree fallback', () => {
  const childFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -';

  beforeEach(() => {
    mockPositionCache[cacheKey('white', childFen)] = makePos('white', childFen, {});
    mockPositionCache[cacheKey('white', STARTING_FEN)] = makePos('white', STARTING_FEN, {
      e4: { toFen: childFen },
    });
    nav.backStack = [];
    nav.currentFen = childFen;
  });

  it('finds parent via findParent and navigates there', () => {
    const result = goBack();
    expect(result).toBe(STARTING_FEN);
    expect(nav.currentFen).toBe(STARTING_FEN);
    expect(nav.forwardStack).toEqual([]);
  });

  it('rebuilds currentPath from buildMovePath', () => {
    goBack();
    expect(nav.currentPath.length).toBe(0);
  });

  it('returns undefined when no parent (root with empty backStack)', () => {
    nav.currentFen = STARTING_FEN;
    const result = goBack();
    expect(result).toBeUndefined();
    expect(nav.currentFen).toBe(STARTING_FEN);
  });
});

// ---------- goForward (stack path) ----------

describe('goForward from forwardStack', () => {
  const fenA = 'fen-a';
  const fenB = 'fen-b';
  const step: MovePathStep = { fen: fenA, toFen: fenB, san: 'Nf3' };

  beforeEach(() => {
    nav.forwardStack = [step];
    nav.currentFen = fenA;
    nav.backStack = [STARTING_FEN];
    nav.currentPath = [{ fen: STARTING_FEN, toFen: fenA, san: 'e4' }];
  });

  it('pops forwardStack and pushes currentFen to backStack', () => {
    goForward();
    expect(nav.currentFen).toBe(fenB);
    expect(nav.backStack).toEqual([STARTING_FEN, fenA]);
    expect(nav.forwardStack).toEqual([]);
  });

  it('appends the step to currentPath', () => {
    goForward();
    expect(nav.currentPath).toEqual([
      { fen: STARTING_FEN, toFen: fenA, san: 'e4' },
      step,
    ]);
  });
});

// ---------- goForward (child navigation) ----------

describe('goForward child navigation', () => {
  const childFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -';
  const childFen2 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -';

  beforeEach(() => {
    nav.forwardStack = [];
    nav.currentFen = STARTING_FEN;
  });

  it('navigates to single child', () => {
    mockPositionCache[cacheKey('white', STARTING_FEN)] = makePos('white', STARTING_FEN, {
      e4: { toFen: childFen },
    });
    nav.currentFen = STARTING_FEN;
    goForward();
    expect(nav.currentFen).toBe(childFen);
    expect(nav.backStack).toEqual([]);
    expect(nav.forwardStack).toEqual([]);
  });

  it('shows move chooser for multiple children', () => {
    mockPositionCache[cacheKey('white', STARTING_FEN)] = makePos('white', STARTING_FEN, {
      e4: { toFen: childFen },
      d4: { toFen: childFen2 },
    });
    goForward();
    expect(nav.showMoveChooser).toBe(true);
    expect(nav.currentFen).toBe(STARTING_FEN);
  });

  it('does nothing when no children', () => {
    goForward();
    expect(nav.currentFen).toBe(STARTING_FEN);
  });
});

// ---------- canGoBack / canGoForward ----------

describe('canGoBack', () => {
  it('returns true when backStack is non-empty', () => {
    nav.backStack = ['some-entry'];
    expect(canGoBack()).toBe(true);
  });

  it('returns true at non-root position with empty backStack', () => {
    nav.currentFen = 'non-root-fen';
    expect(canGoBack()).toBe(true);
  });

  it('returns false at root with empty backStack', () => {
    expect(canGoBack()).toBe(false);
  });
});

describe('canGoForward', () => {
  it('returns true when forwardStack is non-empty', () => {
    nav.forwardStack = [{ fen: 'a', toFen: 'b', san: 'e4' }];
    expect(canGoForward()).toBe(true);
  });

  it('returns false when forwardStack is empty', () => {
    expect(canGoForward()).toBe(false);
  });
});

// ---------- navigateToRoot ----------

describe('navigateToRoot', () => {
  it('clears stacks and path, goes to root', () => {
    nav.currentFen = 'some-fen';
    nav.backStack = ['a'];
    nav.forwardStack = [{ fen: 'a', toFen: 'b', san: 'e4' }];
    nav.currentPath = [{ fen: 'a', toFen: 'b', san: 'e4' }];
    navigateToRoot();
    expect(nav.currentFen).toBe(STARTING_FEN);
    expect(nav.backStack).toEqual([]);
    expect(nav.forwardStack).toEqual([]);
    expect(nav.currentPath).toEqual([]);
  });

  it('no-ops when already at root', () => {
    nav.currentFen = STARTING_FEN;
    navigateToRoot();
    expect(nav.currentFen).toBe(STARTING_FEN);
  });
});

// ---------- switchRepertoire ----------

describe('switchRepertoire', () => {
  it('clears everything and resets to new repertoire', () => {
    nav.currentFen = 'some-fen';
    nav.backStack = ['a'];
    nav.forwardStack = [{ fen: 'a', toFen: 'b', san: 'e4' }];
    nav.currentPath = [{ fen: 'a', toFen: 'b', san: 'e4' }];
    switchRepertoire('black');
    expect(nav.activeRepertoire).toBe('black');
    expect(nav.currentFen).toBe(STARTING_FEN);
    expect(nav.backStack).toEqual([]);
    expect(nav.forwardStack).toEqual([]);
    expect(nav.currentPath).toEqual([]);
    expect(nav.showMoveChooser).toBe(false);
  });

  it('no-ops when switching to the current repertoire', () => {
    nav.currentFen = 'some-fen';
    switchRepertoire('white');
    expect(nav.currentFen).toBe('some-fen');
  });
});
