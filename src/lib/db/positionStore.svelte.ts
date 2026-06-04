import { Chess } from 'chess.js';
import { db } from './schema';
import type { Position, Repertoire, ComfortLevel, Link, PgnAttachment, MoveLabel } from '../types';
import { cacheKey, toChessJsFen, getTurn, normalizeFen } from '../utils/fen';

export const positionCache: Record<string, Position> = $state({});

export function formatSanWithNumber(san: string, parentFen: string): string {
  try {
    const chess = new Chess(toChessJsFen(parentFen));
    chess.move(san);
    const halfMoves = chess.history().length;
    const moveNum = Math.ceil(halfMoves / 2);
    const turn = chess.turn();
    return turn === 'b' ? `${moveNum}. ${san}` : `${moveNum}... ${san}`;
  } catch {
    return san;
  }
}

export function findMoveNumber(repertoire: Repertoire, fen: string): number | null {
  const rootFen = getRootFen();
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

function endsWithMove(name: string): boolean {
  const last = name.split(/[, ]+/).pop()?.trim() ?? '';
  const movePart = last.replace(/^(?:\d+\.\.\.?\s*)/, '');
  return /^(?:[NBKRQO]?x?[a-h][1-8](?:=[NBKRQO])?[+#]?|O-O(?:-O)?[+#]?)$/.test(movePart)
    || /^[a-h][1-8](?:=[NBKRQO])?[+#]?$/.test(movePart);
}

function computeAutoName(
  parentName: string | undefined,
  parentIsAutoNamed: boolean,
  san: string,
  parentFen: string,
  labeledSan?: string,
): string {
  const fallbackLabeled = labeledSan ?? formatSanWithNumber(san, parentFen);
  if (!parentName) return fallbackLabeled;
  if (parentIsAutoNamed) {
    const turn = getTurn(parentFen);
    return parentName + ' ' + (turn === 'b' ? san : fallbackLabeled);
  }
  if (endsWithMove(parentName)) {
    const turn = getTurn(parentFen);
    return parentName + ' ' + (turn === 'b' ? san : fallbackLabeled);
  }
  return parentName + ', ' + fallbackLabeled;
}

function toPlain(pos: Position): Position {
  return JSON.parse(JSON.stringify(pos));
}

function ensureRoot(repertoire: Repertoire): void {
  const rootFen = getRootFen();
  const key = cacheKey(repertoire, rootFen);
  if (positionCache[key]) return;
  const now = Date.now();
  const root: Position = {
    repertoire,
    fen: rootFen,
    moves: {},
    links: [],
    pgnAttachments: [],
    createdAt: now,
    updatedAt: now,
  };
  positionCache[key] = root;
  db.positions.put(toPlain(root));
}

export async function initPositionStore(): Promise<void> {
  const all = await db.positions.toArray();
  for (const p of all) {
    positionCache[cacheKey(p.repertoire, p.fen)] = p;
  }
  ensureRoot('white');
  ensureRoot('black');
  await migrateMoveLabels();
  await migrateComfortCoherence();
}

const MIGRATION_KEY = 'opening-hub-label-migrated';

async function migrateMoveLabels(): Promise<void> {
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

const COMFORT_MIGRATION_KEY = 'opening-hub-comfort-migrated';

async function migrateComfortCoherence(): Promise<void> {
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

export function getRootFen(): string {
  return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
}

export function getPosition(repertoire: Repertoire, fen: string): Position | undefined {
  return positionCache[cacheKey(repertoire, fen)];
}

export function getRepertoirePositions(repertoire: Repertoire): Position[] {
  const prefix = `${repertoire}|`;
  return Object.entries(positionCache)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getUnreachablePositions(repertoire: Repertoire): Position[] {
  const rootFen = getRootFen();
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

export interface MovePathStep {
  fen: string;
  toFen: string;
  san: string;
}

export function buildMovePath(repertoire: Repertoire, targetFen: string): MovePathStep[] {
  const rootFen = getRootFen();
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
    path.unshift({ fen: entry.parentFen, toFen: current, san: entry.san });
    current = entry.parentFen;
  }
  return path;
}

export function findAllTranspositionPaths(repertoire: Repertoire, targetFen: string): MovePathStep[][] {
  const rootFen = getRootFen();
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
      path.push({ fen, toFen: edge.toFen, san });
      dfs(edge.toFen, path);
      path.pop();
      visited.delete(edge.toFen);
    }
  }

  visited.add(rootFen);
  dfs(rootFen, []);
  return paths;
}

export function getOrCreatePosition(repertoire: Repertoire, fen: string): Position {
  const key = cacheKey(repertoire, fen);
  if (positionCache[key]) return positionCache[key];
  const now = Date.now();
  const pos: Position = {
    repertoire,
    fen,
    moves: {},
    links: [],
    pgnAttachments: [],
    createdAt: now,
    updatedAt: now,
  };
  positionCache[key] = pos;
  db.positions.put(toPlain(pos));
  return pos;
}

export async function detectTranspositions(repertoire: Repertoire, fen: string): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  const chess = new Chess(toChessJsFen(fen));
  const legalMoves = chess.moves({ verbose: true });
  let changed = false;
  for (const move of legalMoves) {
    const san = move.san;
    if (pos.moves[san]) continue;
    if (pos.dismissedTranspositions?.includes(san)) continue;
    chess.move(san);
    const targetFen = normalizeFen(chess.fen());
    chess.undo();
    const target = getPosition(repertoire, targetFen);
    if (target) {
      pos.moves[san] = { toFen: targetFen, autoDetected: true };
      changed = true;
    }
  }
  if (changed) {
    pos.updatedAt = Date.now();
    await db.positions.put(toPlain(pos));
  }
}

export async function confirmMove(repertoire: Repertoire, fen: string, san: string): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos || !pos.moves[san]?.autoDetected) return;
  delete pos.moves[san].autoDetected;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function dismissMove(repertoire: Repertoire, fen: string, san: string): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.dismissedTranspositions ??= [];
  if (!pos.dismissedTranspositions.includes(san)) {
    pos.dismissedTranspositions.push(san);
  }
  if (pos.moveOrder) {
    pos.moveOrder = pos.moveOrder.filter(s => s !== san);
  }
  delete pos.moves[san];
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setComfortLevel(repertoire: Repertoire, fen: string, level: ComfortLevel | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.comfortLevel = level;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setPositionName(repertoire: Repertoire, fen: string, name: string | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.name = name;
  pos.autoNamed = false;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setPositionComment(repertoire: Repertoire, fen: string, comment: string | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.comment = comment;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function addMove(repertoire: Repertoire, fromFen: string, san: string, toFen: string, comment?: string): Promise<void> {
  const from = getOrCreatePosition(repertoire, fromFen);
  const to = getOrCreatePosition(repertoire, toFen);

  if (!to.name && to.autoNamed !== false) {
    const depth = findMoveNumber(repertoire, fromFen);
    let labeledSan: string | undefined;
    if (depth !== null) {
      const moveNum = Math.floor(depth / 2) + 1;
      const turn = getTurn(fromFen);
      labeledSan = turn === 'w' ? `${moveNum}. ${san}` : `${moveNum}... ${san}`;
    }
    to.name = computeAutoName(from.name, from.autoNamed ?? false, san, fromFen, labeledSan);
    to.autoNamed = true;
    to.updatedAt = Date.now();
    await db.positions.put(toPlain(to));
  }

  if (from.moveOrder) {
    from.moveOrder.push(san);
  }
  from.moves[san] = { toFen, comment };
  from.updatedAt = Date.now();
  await db.positions.put(toPlain(from));
}

export async function removeMove(repertoire: Repertoire, fromFen: string, san: string): Promise<void> {
  const from = getPosition(repertoire, fromFen);
  if (!from) return;
  if (from.moveOrder) {
    from.moveOrder = from.moveOrder.filter(s => s !== san);
  }
  delete from.moves[san];
  from.updatedAt = Date.now();
  await db.positions.put(toPlain(from));
}

export async function setMoveOrder(repertoire: Repertoire, fen: string, order: string[]): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.moveOrder = order;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setMoveComment(repertoire: Repertoire, fromFen: string, san: string, comment: string | undefined): Promise<void> {
  const from = getPosition(repertoire, fromFen);
  if (!from || !from.moves[san]) return;
  from.moves[san].comment = comment;
  from.updatedAt = Date.now();
  await db.positions.put(toPlain(from));
}

export async function setMoveLabel(repertoire: Repertoire, fen: string, san: string, label: MoveLabel | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos || !pos.moves[san]) return;
  if (label) {
    pos.moves[san].label = label;
  } else {
    delete pos.moves[san].label;
  }
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function addLink(repertoire: Repertoire, fen: string, link: Link): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.links = [...pos.links, link];
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function removeLink(repertoire: Repertoire, fen: string, linkId: string): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.links = pos.links.filter(l => l.id !== linkId);
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function updateLink(repertoire: Repertoire, fen: string, linkId: string, updates: Partial<Link>): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  const idx = pos.links.findIndex(l => l.id === linkId);
  if (idx === -1) return;
  pos.links[idx] = { ...pos.links[idx], ...updates };
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function addPgnAttachment(repertoire: Repertoire, fen: string, attachment: PgnAttachment): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.pgnAttachments = [...pos.pgnAttachments, attachment];
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function removePgnAttachment(repertoire: Repertoire, fen: string, attachmentId: string): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.pgnAttachments = pos.pgnAttachments.filter(a => a.id !== attachmentId);
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function deletePosition(repertoire: Repertoire, fen: string): Promise<void> {
  const children = await db.positions
    .filter(p => p.repertoire === repertoire && Object.values(p.moves).some(m => m.toFen === fen))
    .toArray();
  for (const parent of children) {
    const toRemove = Object.entries(parent.moves)
      .filter(([, m]) => m.toFen === fen)
      .map(([san]) => san);
    for (const san of toRemove) {
      delete parent.moves[san];
    }
    parent.updatedAt = Date.now();
    await db.positions.put(toPlain(parent));
  }
  delete positionCache[cacheKey(repertoire, fen)];
  await db.positions.delete([repertoire, fen]);
}

export async function exportPositionsJson(repertoire?: Repertoire): Promise<string> {
  const all = repertoire
    ? await db.positions.where('repertoire').equals(repertoire).toArray()
    : await db.positions.toArray();
  return JSON.stringify(all, null, 2);
}

export async function importPositionsJson(json: string): Promise<void> {
  const data: Position[] = JSON.parse(json);
  await db.transaction('rw', db.positions, async () => {
    for (const p of data) {
      const key = cacheKey(p.repertoire, p.fen);
      positionCache[key] = p;
      await db.positions.put(toPlain(p));
    }
  });
}
