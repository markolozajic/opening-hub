import { Chess } from 'chess.js';
import { db } from './schema';
import type { Position, Repertoire, ComfortLevel, Link, PgnAttachment, MoveLabel, MoveMarker, PreparationRecord } from '../types';
import { cacheKey, toChessJsFen, getTurn, normalizeFen } from '../utils/fen';
import { invalidateNoveltyCache, invalidateOnlineNoveltyCache } from '../state/novelty.svelte';
import { STARTING_FEN, STARTING_POSITION_COMMENT } from '../constants';
import { findMoveNumber } from '../utils/positionQueries';
import { formatNumberedSan } from '../utils/positionUtils';
import { toPlain } from '../utils/helpers';

export const positionCache: Record<string, Position> = $state({});

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
  {
    const last = parentName.split(/[, ]+/).pop()?.trim() ?? '';
    const stripped = last.replace(/^(?:\d+\.\.\.?\s*)/, '').replace(/[!?]+$/, '');
    const isMove = /^(?:[NBKRQO]?x?[a-h][1-8](?:=[NBKRQO])?[+#]?|O-O(?:-O)?[+#]?)$/.test(stripped)
      || /^[a-h][1-8](?:=[NBKRQO])?[+#]?$/.test(stripped);
    if (isMove) return parentName + ' ' + (turn === 'b' ? san : labeledSan);
  }
  return parentName + ', ' + labeledSan;
}

async function ensureRoot(repertoire: Repertoire): Promise<void> {
  const key = cacheKey(repertoire, STARTING_FEN);
  if (positionCache[key]) return;
  const now = Date.now();
  const root: Position = {
    repertoire,
    fen: STARTING_FEN,
    comment: STARTING_POSITION_COMMENT,
    moves: {},
    links: [],
    pgnAttachments: [],
    createdAt: now,
    updatedAt: now,
  };
  positionCache[key] = root;
  await db.positions.put(toPlain(root));
}

export async function initPositionStore(): Promise<void> {
  const all = await db.positions.toArray();
  for (const p of all) {
    positionCache[cacheKey(p.repertoire, p.fen)] = p;
  }
  ensureRoot('white');
  ensureRoot('black');

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
  invalidateNoveltyCache(repertoire);
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
  invalidateNoveltyCache(repertoire);
}

export async function setComfortLevel(repertoire: Repertoire, fen: string, level: ComfortLevel | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.comfortLevel = level;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setForcedDraw(repertoire: Repertoire, fen: string, value: boolean): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.forcedDraw = value || undefined;
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
}

export async function setPracticalDraw(repertoire: Repertoire, fen: string, value: boolean): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos) return;
  pos.practicalDraw = value || undefined;
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

async function autoNameChild(
  repertoire: Repertoire,
  fromFen: string,
  san: string,
  from: Position,
  to: Position,
): Promise<void> {
  if (to.name || to.autoNamed === false) return;
  const depth = findMoveNumber(repertoire, fromFen);
  const turn = getTurn(fromFen) as 'w' | 'b';
  const labeledSan = depth !== null
    ? formatNumberedSan(depth, turn, san) + (from.moves[san].marker ?? '')
    : san;
  to.name = computeAutoName(from.name, from.autoNamed ?? false, san, labeledSan, turn);
  to.autoNamed = true;
  to.updatedAt = Date.now();
  await db.positions.put(toPlain(to));
}

export async function addMove(repertoire: Repertoire, fromFen: string, san: string, toFen: string, comment?: string): Promise<void> {
  await getOrCreatePosition(repertoire, fromFen);
  await getOrCreatePosition(repertoire, toFen);
  const from = getPosition(repertoire, fromFen)!;
  const to = getPosition(repertoire, toFen)!;

  if (from.moveOrder) {
    from.moveOrder.push(san);
  }
  from.moves[san] = { toFen, comment };

  await autoNameChild(repertoire, fromFen, san, from, to);

  from.updatedAt = Date.now();
  await db.positions.put(toPlain(from));
  invalidateNoveltyCache(repertoire);
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

export async function setMoveMarker(repertoire: Repertoire, fen: string, san: string, marker: MoveMarker | undefined): Promise<void> {
  const pos = getPosition(repertoire, fen);
  if (!pos || !pos.moves[san]) return;
  if (marker) {
    pos.moves[san].marker = marker;
  } else {
    delete pos.moves[san].marker;
  }
  pos.updatedAt = Date.now();
  await db.positions.put(toPlain(pos));
  invalidateNoveltyCache(repertoire);
  invalidateOnlineNoveltyCache(repertoire);
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
  const prefix = repertoire + '|';
  for (const [key, pos] of Object.entries(positionCache)) {
    if (!key.startsWith(prefix)) continue;
    for (const [san, edge] of Object.entries(pos.moves)) {
      if (edge.toFen === fen) {
        delete pos.moves[san];
        if (pos.moveOrder) {
          pos.moveOrder = pos.moveOrder.filter(s => s !== san);
        }
        pos.updatedAt = Date.now();
        await db.positions.put(toPlain(pos));
      }
    }
  }
  delete positionCache[cacheKey(repertoire, fen)];
  await db.positions.delete([repertoire, fen]);
}

export async function exportPositionsJson(repertoire?: Repertoire): Promise<string> {
  const positions = repertoire
    ? await db.positions.where('repertoire').equals(repertoire).toArray()
    : await db.positions.toArray();
  const preparation = repertoire
    ? await db.preparation.where('repertoire').equals(repertoire).toArray()
    : await db.preparation.toArray();
  return JSON.stringify({ positions, preparation }, null, 2);
}

export async function importPositionsJson(json: string): Promise<Repertoire[]> {
  const data = JSON.parse(json);

  let positions: Position[];
  let preparation: PreparationRecord[] = [];

  if (Array.isArray(data)) {
    positions = data;
  } else {
    positions = (data as { positions: Position[]; preparation?: PreparationRecord[] }).positions || [];
    preparation = (data as { positions: Position[]; preparation?: PreparationRecord[] }).preparation || [];
  }

  const repertoireSet = new Set<Repertoire>();
  for (const p of positions) {
    if (p.repertoire === 'white' || p.repertoire === 'black') repertoireSet.add(p.repertoire);
  }
  const repertoires = Array.from(repertoireSet);

  await db.transaction('rw', db.positions, db.preparation, async () => {
    for (const p of positions) {
      const key = cacheKey(p.repertoire, p.fen);
      positionCache[key] = p;
      await db.positions.put(toPlain(p));
    }

    if (preparation.length > 0) {
      for (const rep of repertoires) {
        await db.preparation.where('repertoire').equals(rep).delete();
      }
      for (const pr of preparation) {
        await db.preparation.put(pr);
      }
    }
  });

  return repertoires;
}

export async function getOrCreatePosition(repertoire: Repertoire, fen: string): Promise<Position> {
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
  await db.positions.put(toPlain(pos));
  return pos;
}
