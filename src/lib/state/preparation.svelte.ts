import type { Repertoire } from '../types';
import { positionCache, getPosition } from '../db/positionStore.svelte';
import { db } from '../db/schema';
import { STARTING_FEN } from '../constants';
import { nav } from './navigation.svelte';

export const prepState = $state({
  selectedOpponent: null as string | null,
  opponentNames: [] as string[],
});

const taggedFens: Record<string, Set<string>> = {};
const opponentDates: Record<string, string> = {};

function repKey(repertoire: Repertoire, opponent: string): string {
  return `${repertoire}|${opponent}`;
}

function getAncestors(repertoire: Repertoire, fen: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([fen]);
  const prefix = repertoire + '|';
  let current = fen;
  while (current !== STARTING_FEN) {
    let found = false;
    for (const [key, pos] of Object.entries(positionCache)) {
      if (!key.startsWith(prefix)) continue;
      for (const edge of Object.values(pos.moves)) {
        if (edge.toFen === current && !visited.has(pos.fen)) {
          visited.add(pos.fen);
          result.push(pos.fen);
          current = pos.fen;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) break;
  }
  return result;
}

function getDescendants(repertoire: Repertoire, fen: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([fen]);
  const stack = [fen];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const pos = getPosition(repertoire, current);
    if (!pos) continue;
    for (const edge of Object.values(pos.moves)) {
      if (!visited.has(edge.toFen)) {
        visited.add(edge.toFen);
        result.push(edge.toFen);
        stack.push(edge.toFen);
      }
    }
  }
  return result;
}

function isConnectedBetween(repertoire: Repertoire, a: string, b: string): boolean {
  if (a === b) return true;
  const ancestors = getAncestors(repertoire, b);
  if (ancestors.includes(a)) return true;
  const descendants = getDescendants(repertoire, b);
  if (descendants.includes(a)) return true;
  return false;
}

function isEverybodyPly(repertoire: Repertoire, ply: number): boolean {
  return (repertoire === 'white' && ply <= 1) || (repertoire === 'black' && ply === 0);
}

function getTaggedChildren(repertoire: Repertoire, parentFen: string, opponent: string): string[] {
  const rk = repKey(repertoire, opponent);
  const tSet = taggedFens[rk];
  if (!tSet) return [];

  const pos = getPosition(repertoire, parentFen);
  if (!pos) return [];

  return Object.entries(pos.moves)
    .filter(([, edge]) => tSet.has(edge.toFen))
    .map(([san]) => san);
}

function syncOpponentNames(): void {
  const names = new Set<string>();
  for (const key of Object.keys(taggedFens)) {
    names.add(key.split('|')[1]);
  }
  prepState.opponentNames = Array.from(names).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function addOpponent(repertoire: Repertoire, opponent: string): Promise<void> {
  const rk = repKey(repertoire, opponent);
  if (taggedFens[rk]) return Promise.resolve();
  taggedFens[rk] = new Set();
  opponentDates[rk] = new Date().toISOString().slice(0, 10);
  return db.preparation.put({ repertoire, player: opponent, taggedFens: [], updatedAt: opponentDates[rk] }).then(syncOpponentNames);
}

export async function loadFromDb(repertoire: Repertoire): Promise<void> {
  const records = await db.preparation.where('repertoire').equals(repertoire).toArray();
  const prefix = repertoire + '|';
  for (const key of Object.keys(taggedFens)) {
    if (key.startsWith(prefix)) delete taggedFens[key];
  }
  for (const key of Object.keys(opponentDates)) {
    if (key.startsWith(prefix)) delete opponentDates[key];
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const rec of records) {
    taggedFens[repKey(repertoire, rec.player)] = new Set(rec.taggedFens);
    opponentDates[repKey(repertoire, rec.player)] = rec.updatedAt || today;
  }
  syncOpponentNames();
}

export async function tagPosition(repertoire: Repertoire, fen: string, opponent: string): Promise<void> {
  const rk = repKey(repertoire, opponent);
  if (!taggedFens[rk]) taggedFens[rk] = new Set();
  if (taggedFens[rk].has(fen)) return;

  const fenOnPath = nav.currentPath.findIndex(s => s.toFen === fen);
  const fenPly = fenOnPath !== -1 ? fenOnPath + 1 : nav.currentPath.length + 1;
  if (!isEverybodyPly(repertoire, fenPly)) {
    taggedFens[rk].add(fen);
  }

  for (let i = 0; i < nav.currentPath.length; i++) {
    const step = nav.currentPath[i];
    if (step.toFen === fen) break;
    if (!isEverybodyPly(repertoire, i + 1)) {
      taggedFens[rk].add(step.toFen);
    }
  }

  await db.preparation.put({ repertoire, player: opponent, taggedFens: Array.from(taggedFens[rk]), updatedAt: opponentDates[rk] });
  syncOpponentNames();
}

export async function untagPosition(repertoire: Repertoire, fen: string, opponent: string): Promise<void> {
  const rk = repKey(repertoire, opponent);
  if (!taggedFens[rk]) return;
  taggedFens[rk].delete(fen);
  const descendants = getDescendants(repertoire, fen);
  for (const d of descendants) {
    taggedFens[rk].delete(d);
  }
  if (taggedFens[rk].size === 0) {
    delete taggedFens[rk];
    delete opponentDates[rk];
    await db.preparation.delete([repertoire, opponent]);
  } else {
  await db.preparation.put({ repertoire, player: opponent, taggedFens: Array.from(taggedFens[rk]), updatedAt: opponentDates[rk] });
  }
  syncOpponentNames();
}

export async function purgeOpponent(repertoire: Repertoire, opponent: string): Promise<void> {
  const rk = repKey(repertoire, opponent);
  delete taggedFens[rk];
  delete opponentDates[rk];
  await db.preparation.delete([repertoire, opponent]);
  if (prepState.selectedOpponent === opponent) {
    prepState.selectedOpponent = null;
  }
  syncOpponentNames();
}

function isConnected(repertoire: Repertoire, fen: string, opponent: string): boolean {
  const rk = repKey(repertoire, opponent);
  const tSet = taggedFens[rk];
  if (!tSet || tSet.size === 0) return false;
  for (const t of tSet) {
    if (isConnectedBetween(repertoire, t, fen)) return true;
  }
  return false;
}

export function getOpponentsAt(repertoire: Repertoire, fen: string): { name: string; certain: boolean }[] {
  void prepState.opponentNames;
  const prefix = repertoire + '|';
  const result: { name: string; certain: boolean }[] = [];

  if (fen === STARTING_FEN) return result;

  // Build path from nav.currentPath — the exact sequence the user navigated,
  // avoiding transposition ambiguities from tree-based getAncestors
  const path = [STARTING_FEN];
  for (const step of nav.currentPath) {
    path.push(step.toFen);
  }
  if (path[path.length - 1] !== fen) {
    const ancestors = getAncestors(repertoire, fen);
    ancestors.reverse();
    path.length = 0;
    path.push(...ancestors, fen);
  }

  const descendants = getDescendants(repertoire, fen);
  const descendantSet = new Set(descendants);

  for (const rk of Object.keys(taggedFens)) {
    if (!rk.startsWith(prefix)) continue;
    const opponent = rk.split('|')[1];
    const tSet = taggedFens[rk];
    if (!tSet || tSet.size === 0) continue;

    // 1. Direct tag at this FEN
    if (tSet.has(fen)) {
      result.push({ name: opponent, certain: true });
      continue;
    }

    // 2. Deviation check: walk every step of the path. When a position has any
    //    child in the opponent's taggedFens but the actual child isn't one of them:
    //    - player's turn → player deviated (uncertain, but still reachable)
    //    - opponent's turn → opponent deviated (not reachable at all)
    let playerDeviated = false;
    let opponentDeviated = false;
    for (let i = 0; i < path.length - 1; i++) {
      const pos = getPosition(repertoire, path[i]);
      if (!pos) continue;

      const hasTaggedChild = Object.values(pos.moves).some(edge => tSet.has(edge.toFen));
      if (!hasTaggedChild) continue;

      if (!tSet.has(path[i + 1])) {
        const isPlayerTurn = (repertoire === 'white' && i % 2 === 0) || (repertoire === 'black' && i % 2 === 1);
        if (isPlayerTurn) {
          playerDeviated = true;
        } else {
          opponentDeviated = true;
          break;
        }
      }
    }
    if (opponentDeviated) continue;

    const certain = !playerDeviated && Array.from(tSet).some(t => descendantSet.has(t));
    result.push({ name: opponent, certain });
  }

  return result.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export function getDirectlyTaggedOpponents(repertoire: Repertoire, fen: string): string[] {
  void prepState.opponentNames;
  const result: string[] = [];
  const prefix = repertoire + '|';
  for (const rk of Object.keys(taggedFens)) {
    if (!rk.startsWith(prefix)) continue;
    const opponent = rk.split('|')[1];
    if (taggedFens[rk]!.has(fen)) {
      result.push(opponent);
    }
  }
  return result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function nextSansForPath(repertoire: Repertoire, navPath: string[], opponent: string): string[] | null {
  void prepState.opponentNames;
  const rk = repKey(repertoire, opponent);
  const tSet = taggedFens[rk];
  if (!tSet || tSet.size === 0) return [];

  const fen = navPath.length > 0 ? navByPath(repertoire, navPath) : STARTING_FEN;
  if (!fen) return [];

  if (!isConnected(repertoire, fen, opponent)) return [];

  const evenLen = navPath.length % 2 === 0;
  const ourTurn = (repertoire === 'white' && evenLen) || (repertoire === 'black' && !evenLen);
  if (ourTurn) return null;

  const childSans = getTaggedChildren(repertoire, fen, opponent);
  if (childSans.length > 0) return childSans;

  const pos = getPosition(repertoire, fen);
  if (pos) {
    const children = Object.keys(pos.moves);
    if (children.length === 1) return children;
  }
  return null;
}

function navByPath(repertoire: Repertoire, navPath: string[]): string | null {
  let fen = STARTING_FEN;
  for (const san of navPath) {
    const pos = getPosition(repertoire, fen);
    if (!pos || !pos.moves[san]) return null;
    fen = pos.moves[san].toFen;
  }
  return fen;
}

export function getOpponentNames(): string[] {
  return prepState.opponentNames;
}

export function getOpponentDate(repertoire: Repertoire, opponent: string): string | undefined {
  return opponentDates[repKey(repertoire, opponent)];
}

export async function refreshOpponentDate(repertoire: Repertoire, opponent: string): Promise<void> {
  const rk = repKey(repertoire, opponent);
  if (!taggedFens[rk]) return;
  opponentDates[rk] = new Date().toISOString().slice(0, 10);
  await db.preparation.put({ repertoire, player: opponent, taggedFens: Array.from(taggedFens[rk]), updatedAt: opponentDates[rk] });
}

export function selectOpponent(opponent: string | null): void {
  prepState.selectedOpponent = opponent;
}


