import type { Position, Repertoire, MovePathStep } from '../types';
import { cacheKey } from './fen';
import { positionCache, getPosition } from '../db/positionStore.svelte';
import { STARTING_FEN } from '../constants';

export function findMoveNumber(repertoire: Repertoire, fen: string): number | null {
  const rootFen = STARTING_FEN;
  if (fen === rootFen) return 0;
  const visited = new Set<string>();
  const queue: { f: string; depth: number }[] = [{ f: rootFen, depth: 0 }];
  while (queue.length > 0) {
    const { f, depth } = queue.shift()!;
    if (visited.has(f)) continue;
    visited.add(f);
    if (f === fen) return depth;
    const pos = positionCache[cacheKey(repertoire, f)];
    if (pos) {
      for (const edge of Object.values(pos.moves)) {
        if (!visited.has(edge.toFen)) {
          queue.push({ f: edge.toFen, depth: depth + 1 });
        }
      }
    }
  }
  return null;
}

export function getUnreachablePositions(repertoire: Repertoire): Position[] {
  const rootFen = STARTING_FEN;
  const reachable = new Set<string>();

  const stack = [rootFen];
  while (stack.length > 0) {
    const fen = stack.pop()!;
    if (reachable.has(fen)) continue;
    reachable.add(fen);
    const pos = positionCache[cacheKey(repertoire, fen)];
    if (pos) {
      for (const edge of Object.values(pos.moves)) {
        stack.push(edge.toFen);
      }
    }
  }

  const prefix = `${repertoire}|`;
  return Object.entries(positionCache)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v)
    .filter(p => !reachable.has(p.fen));
}

export function buildMovePath(repertoire: Repertoire, targetFen: string): MovePathStep[] {
  const rootFen = STARTING_FEN;
  if (targetFen === rootFen) return [];

  const parentMap = new Map<string, { parentFen: string; san: string }>();
  const prefix = `${repertoire}|`;
  for (const [key, pos] of Object.entries(positionCache)) {
    if (!key.startsWith(prefix)) continue;
    for (const [san, edge] of Object.entries(pos.moves)) {
      if (!parentMap.has(edge.toFen)) {
        parentMap.set(edge.toFen, { parentFen: pos.fen, san });
      }
    }
  }

  const path: MovePathStep[] = [];
  let current = targetFen;
  while (current !== rootFen) {
    const entry = parentMap.get(current);
    if (!entry) break;
    const parentPos = positionCache[cacheKey(repertoire, entry.parentFen)];
    const marker = parentPos?.moves[entry.san]?.marker;
    path.unshift({ fen: entry.parentFen, toFen: current, san: entry.san, marker });
    current = entry.parentFen;
  }
  return path;
}

export function findAllTranspositionPaths(repertoire: Repertoire, targetFen: string): MovePathStep[][] {
  const rootFen = STARTING_FEN;
  if (targetFen === rootFen) return [];

  const paths: MovePathStep[][] = [];
  const visited = new Set<string>();

  function dfs(fen: string, path: MovePathStep[]) {
    if (fen === targetFen) {
      paths.push([...path]);
      return;
    }
    const pos = getPosition(repertoire, fen);
    if (!pos) return;
    for (const [san, edge] of Object.entries(pos.moves)) {
      if (visited.has(edge.toFen)) continue;
      visited.add(edge.toFen);
      path.push({ fen, toFen: edge.toFen, san, marker: edge.marker });
      dfs(edge.toFen, path);
      path.pop();
      visited.delete(edge.toFen);
    }
  }

  visited.add(rootFen);
  dfs(rootFen, []);
  return paths;
}
