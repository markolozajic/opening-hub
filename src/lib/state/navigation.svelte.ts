import type { Repertoire, SortMode } from '../types';
import { getRootFen, getPosition, positionCache } from '../db/positionStore.svelte';
import { buildMovePath } from '../utils/positionQueries';
import type { MovePathStep } from '../types';
import { cacheKey } from '../utils/fen';

export const nav = $state({
  activeRepertoire: 'white' as Repertoire,
  currentFen: getRootFen(),
  backStack: [] as string[],
  forwardStack: [] as MovePathStep[],
  currentPath: [] as MovePathStep[],
  showMoveChooser: false,
  sortMode: 'manual' as SortMode,
});

const parentIndex = $derived.by(() => {
  const index = new Map<string, string>();
  const prefix = nav.activeRepertoire + '|';
  for (const [key, pos] of Object.entries(positionCache)) {
    if (!key.startsWith(prefix)) continue;
    for (const edge of Object.values(pos.moves)) {
      index.set(edge.toFen, pos.fen);
    }
  }
  return index;
});

export function switchRepertoire(r: Repertoire): void {
  if (r === nav.activeRepertoire) return;
  nav.activeRepertoire = r;
  const rootFen = getRootFen();
  nav.currentFen = rootFen;
  nav.backStack = [];
  nav.forwardStack = [];
  nav.currentPath = [];
  nav.showMoveChooser = false;
}

export function navigateTo(fen: string): void {
  if (fen === nav.currentFen) return;
  nav.backStack = [];
  nav.forwardStack = [];
  nav.currentPath = buildMovePath(nav.activeRepertoire, fen);
  nav.currentFen = fen;
}

export function navigatePath(path: MovePathStep[], targetIndex: number): void {
  nav.backStack = [];
  nav.forwardStack = [];
  nav.currentPath = [];
  let start = 0;
  for (let i = 0; i <= targetIndex; i++) {
    if (path[i].toFen === nav.currentFen) {
      start = i + 1;
      break;
    }
  }
  if (start > targetIndex) return;
  for (let i = start; i <= targetIndex; i++) {
    nav.backStack.push(nav.currentFen);
    nav.currentPath.push({ fen: path[i].fen, toFen: path[i].toFen, san: path[i].san, marker: path[i].marker });
    nav.currentFen = path[i].toFen;
  }
}

export function goBack(): string | undefined {
  if (nav.backStack.length > 0) {
    nav.forwardStack.push(nav.currentPath.pop()!);
    nav.currentFen = nav.backStack.pop()!;
    return nav.currentFen;
  }
  const parent = findParent(nav.activeRepertoire, nav.currentFen);
  if (parent) {
    nav.forwardStack = [];
    nav.currentPath = buildMovePath(nav.activeRepertoire, parent);
    nav.currentFen = parent;
    return parent;
  }
  return undefined;
}

export function canGoBack(): boolean {
  return nav.backStack.length > 0 || nav.currentFen !== getRootFen();
}

export function canGoForward(): boolean {
  return nav.forwardStack.length > 0;
}

export function navigateToRoot(): void {
  const rootFen = getRootFen();
  if (nav.currentFen !== rootFen) {
    nav.backStack = [];
    nav.forwardStack = [];
    nav.currentPath = [];
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
    const step = nav.forwardStack.pop()!;
    nav.backStack.push(nav.currentFen);
    nav.currentPath.push(step);
    nav.currentFen = step.toFen;
    return;
  }
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

function findParent(repertoire: Repertoire, fen: string): string | null {
  return parentIndex.get(fen) ?? null;
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
