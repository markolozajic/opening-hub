import type { Repertoire } from '../types';
import { positionCache, getPosition } from '../db/positionStore.svelte';
import { db } from '../db/schema';
import { STARTING_FEN } from '../constants';
import { nav } from './navigation.svelte';

export const prepState = $state({
  selectedPlayer: null as string | null,
  playerNames: [] as string[],
});

const taggedFens: Record<string, Set<string>> = {};
const playerDates: Record<string, string> = {};

function repKey(repertoire: Repertoire, player: string): string {
  return `${repertoire}|${player}`;
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

function getTaggedChildren(repertoire: Repertoire, parentFen: string, player: string): string[] {
  const rk = repKey(repertoire, player);
  const tSet = taggedFens[rk];
  if (!tSet) return [];

  const pos = getPosition(repertoire, parentFen);
  if (!pos) return [];

  return Object.entries(pos.moves)
    .filter(([, edge]) => tSet.has(edge.toFen))
    .map(([san]) => san);
}

function syncPlayerNames(): void {
  const players = new Set<string>();
  for (const key of Object.keys(taggedFens)) {
    players.add(key.split('|')[1]);
  }
  prepState.playerNames = Array.from(players).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function addPlayer(repertoire: Repertoire, player: string): Promise<void> {
  const rk = repKey(repertoire, player);
  if (taggedFens[rk]) return Promise.resolve();
  taggedFens[rk] = new Set();
  playerDates[rk] = new Date().toISOString().slice(0, 10);
  return db.preparation.put({ repertoire, player, taggedFens: [], updatedAt: playerDates[rk] }).then(syncPlayerNames);
}

export async function loadFromDb(repertoire: Repertoire): Promise<void> {
  const records = await db.preparation.where('repertoire').equals(repertoire).toArray();
  const prefix = repertoire + '|';
  for (const key of Object.keys(taggedFens)) {
    if (key.startsWith(prefix)) delete taggedFens[key];
  }
  for (const key of Object.keys(playerDates)) {
    if (key.startsWith(prefix)) delete playerDates[key];
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const rec of records) {
    taggedFens[repKey(repertoire, rec.player)] = new Set(rec.taggedFens);
    playerDates[repKey(repertoire, rec.player)] = rec.updatedAt || today;
  }
  syncPlayerNames();
}

export async function tagPosition(repertoire: Repertoire, fen: string, player: string): Promise<void> {
  const rk = repKey(repertoire, player);
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

  await db.preparation.put({ repertoire, player, taggedFens: Array.from(taggedFens[rk]), updatedAt: playerDates[rk] });
  syncPlayerNames();
}

export async function untagPosition(repertoire: Repertoire, fen: string, player: string): Promise<void> {
  const rk = repKey(repertoire, player);
  if (!taggedFens[rk]) return;
  taggedFens[rk].delete(fen);
  const descendants = getDescendants(repertoire, fen);
  for (const d of descendants) {
    taggedFens[rk].delete(d);
  }
  if (taggedFens[rk].size === 0) {
    delete taggedFens[rk];
    delete playerDates[rk];
    await db.preparation.delete([repertoire, player]);
  } else {
    await db.preparation.put({ repertoire, player, taggedFens: Array.from(taggedFens[rk]), updatedAt: playerDates[rk] });
  }
  syncPlayerNames();
}

export async function purgePlayer(repertoire: Repertoire, player: string): Promise<void> {
  const rk = repKey(repertoire, player);
  delete taggedFens[rk];
  delete playerDates[rk];
  await db.preparation.delete([repertoire, player]);
  if (prepState.selectedPlayer === player) {
    prepState.selectedPlayer = null;
  }
  syncPlayerNames();
}

function isConnected(repertoire: Repertoire, fen: string, player: string): boolean {
  const rk = repKey(repertoire, player);
  const tSet = taggedFens[rk];
  if (!tSet || tSet.size === 0) return false;
  for (const t of tSet) {
    if (isConnectedBetween(repertoire, t, fen)) return true;
  }
  return false;
}

export function getPlayersAt(repertoire: Repertoire, fen: string): { name: string; certain: boolean }[] {
  void prepState.playerNames;
  const prefix = repertoire + '|';
  const direct: string[] = [];
  const candidates: string[] = [];

  for (const rk of Object.keys(taggedFens)) {
    if (!rk.startsWith(prefix)) continue;
    const player = rk.split('|')[1];
    const tSet = taggedFens[rk];
    if (!tSet || tSet.size === 0) continue;
    if (tSet.has(fen)) {
      direct.push(player);
    } else {
      candidates.push(player);
    }
  }

  const result: { name: string; certain: boolean }[] = direct.map(p => ({ name: p, certain: true }));

  if (candidates.length > 0 && fen !== STARTING_FEN) {
    const ancestors = getAncestors(repertoire, fen);
    for (const player of candidates) {
      const rk = repKey(repertoire, player);
      for (const t of taggedFens[rk]!) {
        if (ancestors.includes(t)) {
          result.push({ name: player, certain: false });
          break;
        }
      }
    }
  }

  return result.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export function getDirectlyTaggedPlayers(repertoire: Repertoire, fen: string): string[] {
  void prepState.playerNames;
  const result: string[] = [];
  const prefix = repertoire + '|';
  for (const rk of Object.keys(taggedFens)) {
    if (!rk.startsWith(prefix)) continue;
    const player = rk.split('|')[1];
    if (taggedFens[rk]!.has(fen)) {
      result.push(player);
    }
  }
  return result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function nextSansForPath(repertoire: Repertoire, navPath: string[], player: string): string[] | null {
  void prepState.playerNames;
  const rk = repKey(repertoire, player);
  const tSet = taggedFens[rk];
  if (!tSet || tSet.size === 0) return [];

  const fen = navPath.length > 0 ? navByPath(repertoire, navPath) : STARTING_FEN;
  if (!fen) return [];

  if (!isConnected(repertoire, fen, player)) return [];

  const evenLen = navPath.length % 2 === 0;
  const ourTurn = (repertoire === 'white' && evenLen) || (repertoire === 'black' && !evenLen);
  if (ourTurn) return null;

  const childSans = getTaggedChildren(repertoire, fen, player);
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

export function getPlayers(): string[] {
  return prepState.playerNames;
}

export function getPlayerDate(repertoire: Repertoire, player: string): string | undefined {
  return playerDates[repKey(repertoire, player)];
}

export async function refreshPlayerDate(repertoire: Repertoire, player: string): Promise<void> {
  const rk = repKey(repertoire, player);
  if (!taggedFens[rk]) return;
  playerDates[rk] = new Date().toISOString().slice(0, 10);
  await db.preparation.put({ repertoire, player, taggedFens: Array.from(taggedFens[rk]), updatedAt: playerDates[rk] });
}

export function selectPlayer(player: string | null): void {
  prepState.selectedPlayer = player;
}

export function isPlayerSelected(): boolean {
  return prepState.selectedPlayer !== null;
}

export function formatPlayerName(name: string): string {
  const comma = name.indexOf(', ');
  if (comma === -1) return name;
  return name.slice(comma + 2) + ' ' + name.slice(0, comma);
}
