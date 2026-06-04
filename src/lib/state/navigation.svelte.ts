import type { Repertoire } from '../types';
import { getRootFen, getPosition, positionCache } from '../db/positionStore.svelte';
import { cacheKey } from '../utils/fen';

export const nav = $state({
  activeRepertoire: 'white' as Repertoire,
  currentFen: getRootFen(),
  showMoveChooser: false,
});

export function switchRepertoire(r: Repertoire): void {
  if (r === nav.activeRepertoire) return;
  nav.activeRepertoire = r;
  nav.currentFen = getRootFen();
  nav.showMoveChooser = false;
}

export function navigateTo(fen: string): void {
  if (fen === nav.currentFen) return;
  nav.currentFen = fen;
}

export function goBack(): string | undefined {
  const rootFen = getRootFen();
  if (nav.currentFen === rootFen) return undefined;
  const parent = findParent(nav.activeRepertoire, nav.currentFen);
  if (parent) {
    nav.currentFen = parent;
    return parent;
  }
  return undefined;
}

export function canGoBack(): boolean {
  return nav.currentFen !== getRootFen();
}

export function navigateToRoot(): void {
  const rootFen = getRootFen();
  if (nav.currentFen !== rootFen) {
    nav.currentFen = rootFen;
  }
}

export function getChildMoves(): { san: string; toFen: string }[] {
  const pos = getPosition(nav.activeRepertoire, nav.currentFen);
  if (!pos) return [];
  return Object.entries(pos.moves).map(([san, edge]) => ({ san, toFen: edge.toFen }));
}

export function goForward(): void {
  const children = getChildMoves();
  if (children.length === 0) return;
  if (children.length === 1) {
    nav.currentFen = children[0].toFen;
  } else {
    nav.showMoveChooser = true;
  }
}

export function chooseMove(toFen: string): void {
  nav.showMoveChooser = false;
  navigateTo(toFen);
}

export function cancelMoveChooser(): void {
  nav.showMoveChooser = false;
}

function findParent(repertoire: Repertoire, fen: string): string | null {
  const prefix = repertoire + '|';
  for (const [key, pos] of Object.entries(positionCache)) {
    if (!key.startsWith(prefix)) continue;
    for (const edge of Object.values(pos.moves)) {
      if (edge.toFen === fen) return pos.fen;
    }
  }
  return null;
}

export function handleKeyDown(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (nav.showMoveChooser) {
    if (e.key === 'Escape') {
      cancelMoveChooser();
    }
    return;
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    goBack();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goForward();
  }
}
