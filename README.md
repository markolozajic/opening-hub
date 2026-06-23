# Opening Hub

A client-side chess opening repertoire manager. Build and maintain your opening repertoires interactively — no server required.

## Features

- **Chess board** — click or drag pieces to make moves
- **Dual repertoires** — manage separate White and Black repertoires side by side
- **Position tree** — navigate through your repertoire with back/forward/root controls and a clickable move path
- **Move labels** — mark moves as Main, Alternative, or Avoid to organize your lines
- **Comfort levels** — rate positions from Easy to Struggling; comfort automatically propagates up from leaf positions
- **Transposition detection** — when a move leads to an existing position, it's auto-detected and offered as a link
- **Comments** — rich notes per position with Markdown support and internal links to other positions
- **Links** — attach YouTube, Chessable, Lichess, or custom URLs per position
- **PGN attachments** — store example games per position
- **Move markers** — annotate moves with `!!`, `!`, `!?`, `?!`, `?`, `??`
- **Drag-to-reorder** — reorder moves at any position
- **Search** — search positions by name, comment, or FEN; filter by comfort level or leaf positions only
- **Issues panel** — detects positions where a non-avoid line only has avoid children
- **Import** — import from PGN or JSON backup
- **Export** — export main line as PGN or full repertoire as JSON backup
- **Cleanup** — find and remove positions no longer reachable from the root
- **Fully client-side** — all data stored in IndexedDB via Dexie
- **Player tagging** — assign players to positions; shown as certain on the path to a tagged position, uncertain (with `?`) beyond tagged territory, and hidden if the player deviated at any of their moves along the path. Filter the move list to a single player's repertoire. "Played by: everybody" shown at root and after the first move (before any opponent response).

## Tech Stack

- [Svelte 5](https://svelte.dev/) with runes (`$state`, `$derived`, `$effect`)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Dexie](https://dexie.org/) — IndexedDB wrapper for persistent storage
- [chess.js](https://github.com/jhlywa/chess.js) — chess move validation and FEN/PGN handling
- [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) — comment rendering
- [Lucide](https://lucide.dev/) — icons
- [Vitest](https://vitest.dev/) — testing

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:5173`).

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run check` | Type-check with `svelte-check` and `tsc` |
| `npm test` | Run tests with Vitest |

## Usage

1. **Start** — the app opens at the starting position for White.
2. **Make moves** — click a piece, then click a highlighted square, or drag a piece.
3. **Navigate** — use the navigation bar (←, Home, →) or click positions in the move path below the board.
4. **Switch sides** — toggle between White and Black repertoires.
5. **Edit a position** — click Edit to name it, set comfort, add comments/links/games, and assign move labels.
6. **Search** — find positions by name, comment, or FEN.
7. **Import/Export** — bring in PGN games or export your repertoire as PGN or JSON.

## Data Persistence

All repertoire data is stored in your browser's IndexedDB. Nothing is sent to a server. To back up or transfer your repertoire, use the Export panel to download a JSON backup, and the Import panel to restore it.

## License

MIT
