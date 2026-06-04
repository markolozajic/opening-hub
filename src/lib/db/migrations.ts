import type { Position, Repertoire } from '../types';
import { cacheKey, getTurn } from '../utils/fen';
import { STARTING_FEN, STARTING_POSITION_COMMENT } from '../constants';
import { db } from './schema';
import { positionCache } from './positionStore.svelte';
import { toPlain } from '../utils/helpers';

const MIGRATION_KEY = 'opening-hub-label-migrated';
const COMFORT_MIGRATION_KEY = 'opening-hub-comfort-migrated';
const ROOT_COMMENT_MIGRATION_KEY = 'opening-hub-root-comment-migrated';

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

export async function migrateRootComment(): Promise<void> {
  if (localStorage.getItem(ROOT_COMMENT_MIGRATION_KEY)) return;
  const allRepertoires: Repertoire[] = ['white', 'black'];
  for (const rep of allRepertoires) {
    const root = await db.positions.get([rep, STARTING_FEN]);
    if (root && !root.comment) {
      root.comment = STARTING_POSITION_COMMENT;
      root.updatedAt = Date.now();
      positionCache[cacheKey(rep, STARTING_FEN)] = root;
      await db.positions.put(toPlain(root));
    }
  }
  localStorage.setItem(ROOT_COMMENT_MIGRATION_KEY, '1');
}

