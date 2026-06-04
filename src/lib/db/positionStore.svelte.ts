import { Chess } from 'chess.js';
import { db } from './schema';
import type { Position, Repertoire, ComfortLevel, Link, PgnAttachment, MoveLabel } from '../types';
import { cacheKey, toChessJsFen, getTurn, normalizeFen } from '../utils/fen';
import { STARTING_FEN } from '../constants';
  import { migrateMoveLabels, migrateComfortCoherence, migrateUnlabeledMoves } from './migrations';
import { findMoveNumber } from '../utils/positionQueries';

export const positionCache: Record<string, Position> = $state({});

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
  labeledSan: string,
  turn: 'w' | 'b',
): string {
  if (!parentName) return labeledSan;
  if (parentIsAutoNamed) {
    return parentName + ' ' + (turn === 'b' ? san : labeledSan);
  }
  if (endsWithMove(parentName)) {
    return parentName + ' ' + (turn === 'b' ? san : labeledSan);
  }
  return parentName + ', ' + labeledSan;
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
  await migrateUnlabeledMoves();
}

export function getRootFen(): string {
  return STARTING_FEN;
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
    to.name = computeAutoName(from.name, from.autoNamed ?? false, san, labeledSan || san, getTurn(fromFen) as 'w' | 'b');
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
