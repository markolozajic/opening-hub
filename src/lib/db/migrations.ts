import type { Position, Repertoire } from '../types';
import { cacheKey, getTurn } from '../utils/fen';
import { db } from './schema';
import { positionCache } from './positionStore.svelte';

const MIGRATION_KEY = 'opening-hub-label-migrated';
const COMFORT_MIGRATION_KEY = 'opening-hub-comfort-migrated';
const UNLABELED_MIGRATION_KEY = 'opening-hub-unlabeled-migrated';

function toPlain(pos: Position): Position {
  return JSON.parse(JSON.stringify(pos));
}

export async function migrateMoveLabels(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;
  const allRepertoires: Repertoire[] = ['white', 'black'];
  for (const rep of allRepertoires) {
    const ourSide = rep === 'white' ? 'w' : 'b';
    const positions = await db.positions.where('repertoire').equals(rep).toArray();
    for (const pos of positions) {
      const turn = getTurn(pos.fen);
      if (turn !== ourSide) continue;
      let changed = false;
      for (const edge of Object.values(pos.moves)) {
        if (!edge.label) {
          edge.label = 'main';
          changed = true;
        }
      }
      if (changed) {
        positionCache[cacheKey(pos.repertoire, pos.fen)] = pos;
        await db.positions.put(toPlain(pos));
      }
    }
  }
  localStorage.setItem(MIGRATION_KEY, '1');
}

export async function migrateComfortCoherence(): Promise<void> {
  if (localStorage.getItem(COMFORT_MIGRATION_KEY)) return;
  const allRepertoires: Repertoire[] = ['white', 'black'];
  for (const rep of allRepertoires) {
    const positions = await db.positions.where('repertoire').equals(rep).toArray();
    for (const pos of positions) {
      if (Object.keys(pos.moves).length > 0 && pos.comfortLevel !== undefined) {
        pos.comfortLevel = undefined;
        positionCache[cacheKey(pos.repertoire, pos.fen)] = pos;
        await db.positions.put(toPlain(pos));
      }
    }
  }
  localStorage.setItem(COMFORT_MIGRATION_KEY, '1');
}

export async function migrateUnlabeledMoves(): Promise<void> {
  if (localStorage.getItem(UNLABELED_MIGRATION_KEY)) return;
  const allRepertoires: Repertoire[] = ['white', 'black'];
  for (const rep of allRepertoires) {
    const positions = await db.positions.where('repertoire').equals(rep).toArray();
    let anyChanged = false;
    for (const pos of positions) {
      let changed = false;
      for (const edge of Object.values(pos.moves)) {
        if (edge.label === undefined) {
          edge.label = 'main';
          changed = true;
        }
      }
      if (changed) {
        positionCache[cacheKey(pos.repertoire, pos.fen)] = pos;
        await db.positions.put(toPlain(pos));
        anyChanged = true;
      }
    }
  }
  localStorage.setItem(UNLABELED_MIGRATION_KEY, '1');
}
