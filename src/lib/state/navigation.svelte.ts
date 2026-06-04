import type { Repertoire } from '../types';
import { getRootFen, getPosition } from '../db/positionStore.svelte';

export const nav = $state({
  activeRepertoire: 'white' as Repertoire,
  currentFen: getRootFen(),
  history: [] as string[],
  showMoveChooser: false,
});

export function switchRepertoire(r: Repertoire): void {
  if (r === nav.activeRepertoire) return;
  nav.activeRepertoire = r;
  nav.currentFen = getRootFen();
  nav.history = [];
  nav.showMoveChooser = false;
}

export function navigateTo(fen: string): void {
  nav.history.push(nav.currentFen);
  nav.currentFen = fen;
}

export function goBack(): string | undefined {
  if (nav.history.length === 0) return undefined;
  nav.currentFen = nav.history.pop()!;
  return nav.currentFen;
}

export function canGoBack(): boolean {
  return nav.history.length > 0;
}

export function navigateToRoot(): void {
  const rootFen = getRootFen();
  if (nav.currentFen !== rootFen) {
    nav.history.push(nav.currentFen);
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
    navigateTo(children[0].toFen);
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
