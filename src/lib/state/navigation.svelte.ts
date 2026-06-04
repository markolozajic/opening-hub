import type { Repertoire } from '../types';
import { getRootFen, getPosition } from '../db/positionStore.svelte';

export const nav = $state({
  activeRepertoire: 'white' as Repertoire,
  currentFen: getRootFen(),
  backStack: [] as string[],
  forwardStack: [] as string[],
  showMoveChooser: false,
});

export function switchRepertoire(r: Repertoire): void {
  if (r === nav.activeRepertoire) return;
  nav.activeRepertoire = r;
  nav.currentFen = getRootFen();
  nav.backStack = [];
  nav.forwardStack = [];
  nav.showMoveChooser = false;
}

export function navigateTo(fen: string): void {
  if (fen === nav.currentFen) return;
  nav.backStack.push(nav.currentFen);
  nav.forwardStack = [];
  nav.currentFen = fen;
}

export function goBack(): string | undefined {
  if (nav.backStack.length === 0) return undefined;
  nav.forwardStack.push(nav.currentFen);
  nav.currentFen = nav.backStack.pop()!;
  return nav.currentFen;
}

export function canGoBack(): boolean {
  return nav.backStack.length > 0;
}

export function canGoForward(): boolean {
  return nav.forwardStack.length > 0;
}

export function navigateToRoot(): void {
  const rootFen = getRootFen();
  if (nav.currentFen !== rootFen) {
    nav.backStack.push(nav.currentFen);
    nav.forwardStack = [];
    nav.currentFen = rootFen;
  }
}

export function getChildMoves(): { san: string; toFen: string }[] {
  const pos = getPosition(nav.activeRepertoire, nav.currentFen);
  if (!pos) return [];
  return Object.entries(pos.moves).map(([san, edge]) => ({ san, toFen: edge.toFen }));
}

export function goForward(): void {
  if (nav.forwardStack.length > 0) {
    nav.backStack.push(nav.currentFen);
    nav.currentFen = nav.forwardStack.pop()!;
    return;
  }
  const children = getChildMoves();
  if (children.length === 0) return;
  if (children.length === 1) {
    nav.backStack.push(nav.currentFen);
    nav.forwardStack = [];
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
