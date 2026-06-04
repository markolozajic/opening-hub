# Opening Hub — Agent Guide

## Project
Chess opening repertoire manager — fully **client-side SPA** (no server). Built with **Svelte 5** (runes), **Vite 8**, **TypeScript**, **Dexie.js** (IndexedDB), **chess.js**.

## Quick Commands
| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server |
| `npm test` | Run all vitest tests |
| `npm run check` | Type-check (svelte-check + tsc) |
| `npm run build` | Prod build → `dist/` |

## Key Directories
- `src/lib/components/` — 17 Svelte components (ChessBoard, MoveList, PositionEditor, etc.)
- `src/lib/db/` — IndexedDB schema (`schema.ts`), CRUD store (`positionStore.svelte.ts`), migrations
- `src/lib/state/` — Reactive state: `navigation.svelte.ts`, `comfort.svelte.ts`, `labels.svelte.ts`
- `src/lib/chess/` — Board rendering & chess.js wrappers
- `src/lib/utils/` — FEN/PGN helpers, position queries, utilities
- `src/tests/` — 6 vitest test files (helpers, comfort, detection, labels, navigation, positionQueries, store)

## Data Model
Single `positions` table keyed by `[repertoire+fen]` (repertoire = `'white' | 'black'`). Each `Position` has `moves: Record<string, MoveEdge>` mapping SAN → target FEN. No server, no auth.

## Architecture
```
App.svelte (currentPanel switches views)
  ├── NavBar (repertoire tabs, back/forward)
  ├── ChessBoard (SVG, click/drag)
  ├── MoveList (sidebar, drag-reorder, labels)
  └── Panels: PositionDisplay | PositionEditor | SearchView | ImportPanel | ExportPanel | CleanupPanel | IssuesPanel
```
- **Panel routing**: `currentPanel` state (no URL router)
- **Navigation**: `nav` object with back/forward stacks + tree fallback
- **Comfort propagation**: leaves → root (worst wins, filtered by main-line on our turn)
- **Label propagation**: root → leaves (BFS, dominance rules: main > alternative, avoid > all)
- **Auto-transposition**: detected on addMove, must be confirmed/dismissed

## Testing
Vitest + jsdom, `vi.mock()` for isolation, `fake-indexeddb` for store tests. Factories in `tests/helpers.ts`.

## Conventions
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) everywhere
- No comments in code
- `toPlain()` for JSON-safe deep clone
- `$state` cache mirrors IndexedDB for reads
- No eslint/prettier config — match existing style

After each edit, make sure that README.md and AGENTS.md is updated accordingly, if necessary.
