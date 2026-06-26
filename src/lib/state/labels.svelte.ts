import type { MoveLabel, Repertoire } from '../types';
import { getPosition } from '../db/positionStore.svelte';
import { getTurn } from '../utils/fen';
import { STARTING_FEN } from '../constants';

export const labelData = $state<{
  positionLabels: Record<string, MoveLabel | null>;
  moveLabels: Record<string, Record<string, MoveLabel>>;
  issueCount: number;
  issuePositions: Array<{ fen: string; name?: string }>;
}>({
  positionLabels: {},
  moveLabels: {},
  issueCount: 0,
  issuePositions: [],
});

function detectIssues(
  repertoire: Repertoire,
  positionLabels: Record<string, MoveLabel | null>,
  moveLabels: Record<string, Record<string, MoveLabel>>,
): Array<{ fen: string; name?: string }> {
  const issues: Array<{ fen: string; name?: string }> = [];
  for (const [fen, label] of Object.entries(positionLabels)) {
    const pos = getPosition(repertoire, fen);
    if (!pos || Object.keys(pos.moves).length === 0) continue;
    if (label === 'avoid') continue;
    const ml = moveLabels[fen];
    if (!ml) continue;
    const vals = Object.values(ml);
    if (label === 'main') {
      if (!vals.some(l => l === 'main')) {
        issues.push({ fen, name: pos.name });
      }
    } else {
      if (vals.every(l => l === 'avoid')) {
        issues.push({ fen, name: pos.name });
      }
    }
  }
  return issues;
}

export function recomputeLabels(repertoire: Repertoire): void {
  const rootFen = STARTING_FEN;
  const newPositionLabels: Record<string, MoveLabel | null> = {};
  const newMoveLabels: Record<string, Record<string, MoveLabel>> = {};
  const queue: Array<[string, MoveLabel | null]> = [[rootFen, null]];

  while (queue.length > 0) {
    const [fen, pathLabel] = queue.shift()!;
    const pos = getPosition(repertoire, fen);
    if (!pos) continue;

    const existing = newPositionLabels[fen];
    if (existing === undefined) {
      newPositionLabels[fen] = pathLabel;
    } else if (pathLabel !== null) {
      if (pathLabel === 'avoid' || existing === 'avoid') {
        newPositionLabels[fen] = 'avoid';
      } else if (pathLabel === 'main' || existing === 'main') {
        newPositionLabels[fen] = 'main';
      } else if (pathLabel === 'alternative' && existing === null) {
        newPositionLabels[fen] = 'alternative';
      }
    }

    const currentPositionLabel = newPositionLabels[fen];

    for (const [san, edge] of Object.entries(pos.moves)) {
      const isOurTurn = getTurn(fen) === (repertoire === 'white' ? 'w' : 'b');
      let effectiveLabel: MoveLabel;

      if (isOurTurn) {
        effectiveLabel = edge.label ?? (currentPositionLabel ?? 'main');
      } else {
        effectiveLabel = currentPositionLabel ?? 'main';
      }

      if (!newMoveLabels[fen]) newMoveLabels[fen] = {};
      newMoveLabels[fen][san] = effectiveLabel;

      if (isOurTurn) {
        queue.push([edge.toFen, effectiveLabel]);
      } else {
        queue.push([edge.toFen, currentPositionLabel]);
      }
    }
  }

  const issues = detectIssues(repertoire, newPositionLabels, newMoveLabels);

  labelData.positionLabels = newPositionLabels;
  labelData.moveLabels = newMoveLabels;
  labelData.issuePositions = issues;
  labelData.issueCount = issues.length;
}
