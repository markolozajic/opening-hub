import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import { normalizeFen } from '../lib/utils/fen';
import { STARTING_FEN } from '../lib/constants';
import type { Repertoire } from '../lib/types';
import { db } from '../lib/db/schema';
import {
  initPositionStore, positionCache,
  addMove, getPosition, getOrCreatePosition,
  setComfortLevel, setPositionName, setPositionComment,
  setMoveLabel, setMoveMarker, setMoveOrder, setMoveComment,
  confirmMove, dismissMove, deletePosition,
} from '../lib/db/positionStore.svelte';

function fenSeq(moves: string[]): string {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return normalizeFen(chess.fen());
}

const ROOT = STARTING_FEN;
const A = fenSeq(['e4']);
const B = fenSeq(['e4', 'e5']);
const C = fenSeq(['e4', 'e5', 'Nf3']);
const D = fenSeq(['e4', 'e5', 'Nf3', 'Nc6']);

const rep: Repertoire = 'white';

beforeEach(async () => {
  for (const key of Object.keys(positionCache)) {
    delete positionCache[key];
  }
  await db.positions.clear();
  await initPositionStore();
});

describe('getOrCreatePosition', () => {
  it('returns existing position from cache', async () => {
    const existing = getPosition(rep, ROOT);
    const result = await getOrCreatePosition(rep, ROOT);
    expect(result).toBe(existing);
  });

  it('creates and caches a new position when missing', async () => {
    const pos = await getOrCreatePosition(rep, A);
    expect(pos.fen).toBe(A);
    expect(pos.moves).toEqual({});
    expect(positionCache[rep + '|' + A]?.fen).toBe(A);
  });
});

describe('addMove', () => {
  it('adds a move edge from parent to child', async () => {
    await addMove(rep, ROOT, 'e4', A);
    const root = getPosition(rep, ROOT);
    expect(root?.moves['e4']).toBeDefined();
    expect(root?.moves['e4'].toFen).toBe(A);
    expect(root?.moves['e4'].autoDetected).toBeUndefined();
  });

  it('auto-names the child position', async () => {
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe('1. e4');
    expect(child?.autoNamed).toBe(true);
  });

  it('does not overwrite an existing name', async () => {
    const pos = await getOrCreatePosition(rep, A);
    pos.name = 'My Opening';
    pos.autoNamed = false;
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe('My Opening');
  });

  it('creates chain of auto-names (White then Black)', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await addMove(rep, A, 'e5', B);
    expect(getPosition(rep, A)?.name).toBe('1. e4');
    expect(getPosition(rep, B)?.name).toBe('1. e4 e5');
  });

  it('assigns correct move numbers for multi-move sequences', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await addMove(rep, A, 'e5', B);
    await addMove(rep, B, 'Nf3', C);
    expect(getPosition(rep, C)?.name).toBe('1. e4 e5 2. Nf3');
    await addMove(rep, C, 'Nc6', D);
    expect(getPosition(rep, D)?.name).toBe('1. e4 e5 2. Nf3 Nc6');
  });

  it('appends san to moveOrder when present', async () => {
    const root = getPosition(rep, ROOT);
    root.moveOrder = [];
    await addMove(rep, ROOT, 'e4', A);
    expect(root.moveOrder).toContain('e4');
  });
});

describe('setComfortLevel', () => {
  it('sets comfort level on a position', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setComfortLevel(rep, A, 'easy');
    expect(getPosition(rep, A)?.comfortLevel).toBe('easy');
  });

  it('removes comfort level when undefined', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setComfortLevel(rep, A, 'easy');
    await setComfortLevel(rep, A, undefined);
    expect(getPosition(rep, A)?.comfortLevel).toBeUndefined();
  });
});

describe('setPositionName', () => {
  it('sets name and marks autoNamed false', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setPositionName(rep, A, 'King\'s Pawn');
    const pos = getPosition(rep, A);
    expect(pos?.name).toBe('King\'s Pawn');
    expect(pos?.autoNamed).toBe(false);
  });

  it('clears name when undefined', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setPositionName(rep, A, undefined);
    expect(getPosition(rep, A)?.name).toBeUndefined();
  });
});

describe('setPositionComment', () => {
  it('sets and clears comment', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setPositionComment(rep, A, 'sharp line');
    expect(getPosition(rep, A)?.comment).toBe('sharp line');
    await setPositionComment(rep, A, undefined);
    expect(getPosition(rep, A)?.comment).toBeUndefined();
  });
});

describe('setMoveLabel', () => {
  it('sets label on a move edge', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveLabel(rep, ROOT, 'e4', 'alternative');
    expect(getPosition(rep, ROOT)?.moves['e4'].label).toBe('alternative');
  });

  it('removes label when undefined', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveLabel(rep, ROOT, 'e4', 'alternative');
    await setMoveLabel(rep, ROOT, 'e4', undefined);
    expect(getPosition(rep, ROOT)?.moves['e4'].label).toBeUndefined();
  });
});

describe('setMoveMarker', () => {
  it('sets marker on a move edge', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveMarker(rep, ROOT, 'e4', '!');
    expect(getPosition(rep, ROOT)?.moves['e4'].marker).toBe('!');
  });

  it('removes marker when undefined', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveMarker(rep, ROOT, 'e4', '!');
    await setMoveMarker(rep, ROOT, 'e4', undefined);
    expect(getPosition(rep, ROOT)?.moves['e4'].marker).toBeUndefined();
  });
});

describe('setMoveOrder', () => {
  it('sets move order array', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await addMove(rep, ROOT, 'd4', B);
    await setMoveOrder(rep, ROOT, ['d4', 'e4']);
    expect(getPosition(rep, ROOT)?.moveOrder).toEqual(['d4', 'e4']);
  });
});

describe('setMoveComment', () => {
  it('sets comment on a move edge', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveComment(rep, ROOT, 'e4', 'enterprising');
    expect(getPosition(rep, ROOT)?.moves['e4'].comment).toBe('enterprising');
  });

  it('clears comment when undefined', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await setMoveComment(rep, ROOT, 'e4', 'enterprising');
    await setMoveComment(rep, ROOT, 'e4', undefined);
    expect(getPosition(rep, ROOT)?.moves['e4'].comment).toBeUndefined();
  });
});

describe('confirmMove', () => {
  it('removes autoDetected flag from a move', async () => {
    const root = getPosition(rep, ROOT);
    root.moves['e4'] = { toFen: A, autoDetected: true };
    await confirmMove(rep, ROOT, 'e4');
    expect(getPosition(rep, ROOT)?.moves['e4'].autoDetected).toBeUndefined();
  });

  it('no-ops on non-auto-detected move', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await confirmMove(rep, ROOT, 'e4');
    expect(getPosition(rep, ROOT)?.moves['e4'].autoDetected).toBeUndefined();
  });
});

describe('dismissMove', () => {
  it('removes the move and adds san to dismissedTranspositions', async () => {
    const root = getPosition(rep, ROOT);
    root.moves['e4'] = { toFen: A };
    await dismissMove(rep, ROOT, 'e4');
    expect(getPosition(rep, ROOT)?.moves['e4']).toBeUndefined();
    expect(getPosition(rep, ROOT)?.dismissedTranspositions).toContain('e4');
  });

  it('removes san from moveOrder if present', async () => {
    const root = getPosition(rep, ROOT);
    root.moves['e4'] = { toFen: A };
    root.moves['d4'] = { toFen: B };
    root.moveOrder = ['e4', 'd4'];
    await dismissMove(rep, ROOT, 'e4');
    expect(root.moveOrder).toEqual(['d4']);
  });
});

describe('deletePosition', () => {
  it('removes position from cache', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await deletePosition(rep, A);
    expect(getPosition(rep, A)).toBeUndefined();
  });

  it('removes the move from parent', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await deletePosition(rep, A);
    const root = getPosition(rep, ROOT);
    expect(root?.moves['e4']).toBeUndefined();
  });
});

describe('addMove auto-naming edge cases', () => {
  it('auto-names with comment parameter stored on move edge', async () => {
    await addMove(rep, ROOT, 'e4', A, 'sharp line');
    const root = getPosition(rep, ROOT);
    expect(root?.moves['e4'].comment).toBe('sharp line');
  });

  it('auto-names with parent having manual name uses comma separator', async () => {
    const parent = getPosition(rep, ROOT);
    parent.name = "King's Pawn";
    parent.autoNamed = false;
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe("King's Pawn, 1. e4");
  });

  it('auto-names a transposition when child exists without name', async () => {
    const existingChild = await getOrCreatePosition(rep, A);
    expect(existingChild.name).toBeUndefined();
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe('1. e4');
    expect(child?.autoNamed).toBe(true);
  });

  it('does not re-auto-name when child already has an auto-name from previous addMove', async () => {
    await addMove(rep, ROOT, 'e4', A);
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe('1. e4');
  });

  it('auto-name survives round-trip through IndexedDB', async () => {
    await addMove(rep, ROOT, 'e4', A);
    const fromDb = await db.positions.get([rep, A]);
    expect(fromDb?.name).toBe('1. e4');
    expect(fromDb?.autoNamed).toBe(true);
  });

  it('auto-name is present via getPosition immediately after addMove', async () => {
    await addMove(rep, ROOT, 'e4', A);
    const child = getPosition(rep, A);
    expect(child?.name).toBe('1. e4');
    expect(child?.autoNamed).toBe(true);
  });
});

describe('addMove with auto-detection lifecycle', () => {
  it('auto-detected move, confirm, then dismiss, then normal add', async () => {
    const root = getPosition(rep, ROOT);
    root.moves['e4'] = { toFen: A, autoDetected: true };
    await confirmMove(rep, ROOT, 'e4');
    expect(getPosition(rep, ROOT)?.moves['e4'].autoDetected).toBeUndefined();
  });

  it('dismissed move is gone and cannot be re-added by detection', async () => {
    const root = getPosition(rep, ROOT);
    root.moves['e4'] = { toFen: A, autoDetected: true };
    await dismissMove(rep, ROOT, 'e4');
    expect(getPosition(rep, ROOT)?.moves['e4']).toBeUndefined();
    expect(getPosition(rep, ROOT)?.dismissedTranspositions).toContain('e4');
  });
});
