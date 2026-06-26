import type { Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { clearPrefix } from '../utils/helpers';
import { STARTING_FEN } from '../constants';

let invalidationToken = $state(0);
const noveltyCache: Record<string, boolean> = {};

function computeNoveltyFor(repertoire: Repertoire, fen: string): boolean {
  if (fen === STARTING_FEN) return false;

  const familiar = new Set<string>();
  const queueFamiliar = [STARTING_FEN];
  familiar.add(STARTING_FEN);

  while (queueFamiliar.length > 0) {
    const f = queueFamiliar.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (edge.marker !== 'N' && !familiar.has(edge.toFen)) {
        familiar.add(edge.toFen);
        queueFamiliar.push(edge.toFen);
      }
    }
  }

  if (familiar.has(fen)) return false;

  const reachable = new Set<string>();
  const queueAll = [STARTING_FEN];
  reachable.add(STARTING_FEN);

  while (queueAll.length > 0) {
    const f = queueAll.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (!reachable.has(edge.toFen)) {
        reachable.add(edge.toFen);
        queueAll.push(edge.toFen);
      }
    }
  }

  return reachable.has(fen);
}

export function getNovelty(repertoire: Repertoire, fen: string): boolean {
  invalidationToken;
  const key = `${repertoire}|${fen}`;
  const cached = noveltyCache[key];
  if (cached !== undefined) return cached;
  const result = computeNoveltyFor(repertoire, fen);
  noveltyCache[key] = result;
  return result;
}

export function invalidateNoveltyCache(repertoire?: string): void {
  clearPrefix(noveltyCache as Record<string, unknown>, repertoire);
  invalidationToken++;
}

// ── Online novelty (ON) ──────────────────────────────────────────────

let onlineInvalidationToken = $state(0);
const onlineNoveltyCache: Record<string, boolean> = {};

function computeOnlineNoveltyFor(repertoire: Repertoire, fen: string): boolean {
  if (fen === STARTING_FEN) return false;

  const familiar = new Set<string>();
  const queueFamiliar = [STARTING_FEN];
  familiar.add(STARTING_FEN);

  while (queueFamiliar.length > 0) {
    const f = queueFamiliar.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (edge.marker !== 'ON' && !familiar.has(edge.toFen)) {
        familiar.add(edge.toFen);
        queueFamiliar.push(edge.toFen);
      }
    }
  }

  if (familiar.has(fen)) return false;

  const reachable = new Set<string>();
  const queueAll = [STARTING_FEN];
  reachable.add(STARTING_FEN);

  while (queueAll.length > 0) {
    const f = queueAll.shift()!;
    const pos = getPosition(repertoire, f);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (!reachable.has(edge.toFen)) {
        reachable.add(edge.toFen);
        queueAll.push(edge.toFen);
      }
    }
  }

  return reachable.has(fen);
}

export function getOnlineNovelty(repertoire: Repertoire, fen: string): boolean {
  onlineInvalidationToken;
  const key = `${repertoire}|${fen}`;
  const cached = onlineNoveltyCache[key];
  if (cached !== undefined) return cached;
  const result = computeOnlineNoveltyFor(repertoire, fen);
  onlineNoveltyCache[key] = result;
  return result;
}

export function invalidateOnlineNoveltyCache(repertoire?: string): void {
  clearPrefix(onlineNoveltyCache as Record<string, unknown>, repertoire);
  onlineInvalidationToken++;
}
