<script lang="ts">
  import { onMount } from 'svelte';
  import { Chess } from 'chess.js';
  import { initPositionStore, getPosition, addMove, setMoveOrder, getRepertoirePositions, detectTranspositions, confirmMove, dismissMove } from './lib/db/positionStore.svelte';
  import { findMoveNumber } from './lib/utils/positionQueries';
  import { nav, handleKeyDown, navigateTo } from './lib/state/navigation.svelte';
  import { invalidateComfortCache } from './lib/state/comfort.svelte';
  import { labelData, recomputeLabels } from './lib/state/labels.svelte';
  import { getLegalMoves, findMoveBySquares, getPieceAt } from './lib/chess/boardUtils';
  import { getTurn, normalizeFen, toChessJsFen } from './lib/utils/fen';
  import { formatNumberedSan } from './lib/utils/positionUtils';
  import ChessBoard from './lib/components/ChessBoard.svelte';
  import PositionDisplay from './lib/components/PositionDisplay.svelte';
  import PositionEditor from './lib/components/PositionEditor.svelte';
  import MoveList from './lib/components/MoveList.svelte';
  import NavBar from './lib/components/NavBar.svelte';
  import MoveChooser from './lib/components/MoveChooser.svelte';
  import Resizer from './lib/components/Resizer.svelte';
  import SearchView from './lib/components/SearchView.svelte';
  import IssuesPanel from './lib/components/IssuesPanel.svelte';
  import ImportPanel from './lib/components/ImportPanel.svelte';
  import ExportPanel from './lib/components/ExportPanel.svelte';
  import CleanupPanel from './lib/components/CleanupPanel.svelte';
  import { Search, Upload, Download, BookOpen, Trash2, AlertTriangle } from '@lucide/svelte';

  let initialized = $state(false);
  let selectedSquare = $state<string | null>(null);
  let highlightedSquares = $state<string[]>([]);
  let currentPanel = $state<'main' | 'edit' | 'search' | 'import' | 'export' | 'cleanup' | 'issues'>('main');
  let pendingMoveInsert = $state<{ san: string; fen: string } | null>(null);

  let boardWidth = $state(720);
  let movesWidth = $state(300);
  let isFlipped = $derived(nav.activeRepertoire === 'black');

  let currentPosition = $derived(getPosition(nav.activeRepertoire, nav.currentFen));
  let totalPositions = $derived(getRepertoirePositions(nav.activeRepertoire).length);
  let movePath = $derived(nav.currentPath);
  let editBoardFen = $state<string | null>(null);
  let lastInsertToFen = $state<string | null>(null);
  let displayFen = $derived(editBoardFen ?? nav.currentFen);

  onMount(async () => {
    await initPositionStore();
    initialized = true;
  });

  $effect(() => {
    nav.currentFen;
    selectedSquare = null;
    highlightedSquares = [];
  });

  $effect(() => {
    if (!initialized) return;
    const fen = nav.currentFen;
    const rep = nav.activeRepertoire;
    detectTranspositions(rep, fen);
  });

  $effect(() => {
    if (!initialized) return;
    const rep = nav.activeRepertoire;
    const positions = getRepertoirePositions(rep);
    for (const p of positions) void p.updatedAt;
    recomputeLabels(rep);
  });

  $effect(() => {
    if (currentPanel === 'edit') {
      editBoardFen = nav.currentFen;
      lastInsertToFen = null;
    } else {
      editBoardFen = null;
      lastInsertToFen = null;
    }
  });

  function handleSquareClick(sq: string) {
    const turn = getTurn(displayFen);
    const moves = getLegalMoves(displayFen);

    if (selectedSquare === null) {
      const piece = getPieceAt(displayFen, sq);
      if (piece && piece.color === turn) {
        selectedSquare = sq;
        highlightedSquares = moves.filter(m => m.from === sq).map(m => m.to);
      }
    } else if (highlightedSquares.includes(sq)) {
      const move = findMoveBySquares(displayFen, selectedSquare, sq);
      if (move) {
        selectedSquare = null;
        highlightedSquares = [];
        handleMove(move.san);
        return;
      }
      selectedSquare = null;
      highlightedSquares = [];
    } else {
      if (sq === selectedSquare) {
        selectedSquare = null;
        highlightedSquares = [];
        return;
      }
      const piece = getPieceAt(displayFen, sq);
      if (piece && piece.color === turn) {
        selectedSquare = sq;
        highlightedSquares = moves.filter(m => m.from === sq).map(m => m.to);
      } else {
        selectedSquare = null;
        highlightedSquares = [];
      }
    }
  }

  function handleSquareDrag(sq: string) {
    const turn = getTurn(displayFen);
    const piece = getPieceAt(displayFen, sq);
    if (piece && piece.color === turn) {
      selectedSquare = sq;
      const moves = getLegalMoves(displayFen);
      highlightedSquares = moves.filter(m => m.from === sq).map(m => m.to);
    }
  }

  function handleDrop(from: string, to: string) {
    const moves = getLegalMoves(displayFen);
    const move = moves.find(m => m.from === from && m.to === to);
    if (move) {
      selectedSquare = null;
      highlightedSquares = [];
      handleMove(move.san);
    }
  }

  async function handleMove(san: string) {
    const chess = new Chess(toChessJsFen(displayFen));
    try {
      chess.move(san);
    } catch {
      return;
    }
    const afterFen = normalizeFen(chess.fen());

    const current = getPosition(nav.activeRepertoire, displayFen);

    if (currentPanel === 'edit') {
      if (current && current.moves[san]) {
        if (current.moves[san].autoDetected) {
          await confirmMove(nav.activeRepertoire, displayFen, san);
        }
      } else {
        await addMove(nav.activeRepertoire, displayFen, san, afterFen);
        invalidateComfortCache(nav.activeRepertoire, displayFen);
      }
      const turn = getTurn(displayFen);
      const depth = findMoveNumber(nav.activeRepertoire, displayFen);
      const isSequenceContinuation = turn === 'b' && displayFen === lastInsertToFen;
      const baseText = isSequenceContinuation ? san : formatNumberedSan(depth, turn as 'w' | 'b', san);
      const moveText = baseText + (current?.moves[san]?.marker ?? '');
      pendingMoveInsert = { san: moveText, fen: afterFen };
      queueMicrotask(() => { pendingMoveInsert = null; });
      editBoardFen = afterFen;
      lastInsertToFen = afterFen;
      return;
    }

    if (current && current.moves[san]) {
      if (current.moves[san].autoDetected) {
        await confirmMove(nav.activeRepertoire, displayFen, san);
      }
      invalidateComfortCache(nav.activeRepertoire, displayFen);
      navigateTo(current.moves[san].toFen);
    } else {
      await addMove(nav.activeRepertoire, displayFen, san, afterFen);
      invalidateComfortCache(nav.activeRepertoire, displayFen);
      navigateTo(afterFen);
    }
  }

  function handleEditClose() {
    currentPanel = 'main';
  }

  async function handleDeleteMove(san: string) {
    if (!confirm(`Delete move ${san}? This will not affect other positions.`)) return;
    await dismissMove(nav.activeRepertoire, nav.currentFen, san);
    invalidateComfortCache(nav.activeRepertoire, nav.currentFen);
  }

  function handleReorderMove(order: string[]) {
    setMoveOrder(nav.activeRepertoire, nav.currentFen, order);
  }

  function handleConfirmMove(san: string) {
    confirmMove(nav.activeRepertoire, nav.currentFen, san);
  }

  function handleCursorFenChange(fen: string) {
    if (currentPanel === 'edit') {
      editBoardFen = fen;
    }
  }

  function handleImportDone() {
    currentPanel = 'main';
    invalidateComfortCache();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if !initialized}
  <div class="loading">
    <p>Loading repertoire…</p>
  </div>
{:else}
  <div class="app-layout">
    <header class="topbar">
      <div class="topbar-left">
        <BookOpen size={18} class="logo-icon" />
        <span class="logo-text">Opening Hub</span>
        <span class="pos-count">{totalPositions} positions</span>
      </div>
      <nav class="topbar-nav">
        <button
          class="topbar-btn"
          class:active={currentPanel === 'search'}
          onclick={() => currentPanel = currentPanel === 'search' ? 'main' : 'search'}
        >
          <Search size={14} /> Search
        </button>
        <button
          class="topbar-btn"
          class:active={currentPanel === 'import'}
          onclick={() => currentPanel = currentPanel === 'import' ? 'main' : 'import'}
        >
          <Upload size={14} /> Import
        </button>
        <button
          class="topbar-btn"
          class:active={currentPanel === 'export'}
          onclick={() => currentPanel = currentPanel === 'export' ? 'main' : 'export'}
        >
          <Download size={14} /> Export
        </button>
        <button
          class="topbar-btn"
          class:active={currentPanel === 'cleanup'}
          onclick={() => currentPanel = currentPanel === 'cleanup' ? 'main' : 'cleanup'}
        >
          <Trash2 size={14} /> Cleanup
        </button>
        <button
          class="topbar-btn issues-btn"
          class:active={currentPanel === 'issues'}
          onclick={() => currentPanel = currentPanel === 'issues' ? 'main' : 'issues'}
        >
          <AlertTriangle size={14} /> Issues
          {#if labelData.issueCount > 0}
            <span class="issue-badge">{labelData.issueCount}</span>
          {/if}
        </button>
      </nav>
    </header>

    <NavBar />

    <main class="main-area">
      <section class="board-column" style="width: {boardWidth}px">
        <ChessBoard
          fen={displayFen}
          selectedSquare={selectedSquare}
          highlightedSquares={highlightedSquares}
          interactive={true}
          flipped={isFlipped}
          size={boardWidth - 32}
          onSquareClick={handleSquareClick}
          onSquareDrag={handleSquareDrag}
          onDrop={handleDrop}
        />
        <div class="board-footer">
          <span class="turn-indicator">{getTurn(displayFen) === 'w' ? 'White' : 'Black'} to move</span>
        </div>
        <div class="board-fen">
          <code>{displayFen}</code>
        </div>
        {#if movePath.length > 0}
          <div class="move-history">
            {#each movePath as step, i}
              <button class="history-step" onclick={() => navigateTo(step.toFen)}>
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${step.san}` : step.san}{step.marker}
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <Resizer onResize={(d: number) => boardWidth = Math.max(320, boardWidth + d)} />

      <section class="info-column" style="flex: 1; min-width: 200px">
        {#if currentPanel === 'edit'}
          <PositionEditor position={currentPosition} onClose={handleEditClose} moveToInsert={pendingMoveInsert} onCursorFenChange={handleCursorFenChange} />
        {:else if currentPanel === 'search'}
          <SearchView />
        {:else if currentPanel === 'import'}
          <ImportPanel onComplete={handleImportDone} onClose={() => currentPanel = 'main'} />
        {:else if currentPanel === 'export'}
          <ExportPanel onClose={() => currentPanel = 'main'} />
        {:else if currentPanel === 'cleanup'}
          <CleanupPanel onClose={() => currentPanel = 'main'} />
        {:else if currentPanel === 'issues'}
          <IssuesPanel onClose={() => currentPanel = 'main'} />
        {:else}
          <PositionDisplay position={currentPosition} onEdit={() => currentPanel = 'edit'} />
        {/if}
      </section>

      {#if currentPanel === 'main'}
        <Resizer onResize={(d: number) => movesWidth = Math.max(140, movesWidth - d)} />
        <section class="moves-column" style="width: {movesWidth}px">
          <MoveList onDeleteMove={handleDeleteMove} onReorderMove={handleReorderMove} onConfirmMove={handleConfirmMove} />
        </section>
      {/if}
    </main>
  </div>
{/if}

{#if nav.showMoveChooser}
  <MoveChooser />
{/if}

<style>
  .loading {
    display: flex; align-items: center; justify-content: center;
    height: 100vh; color: var(--muted); font-size: 1rem;
  }

  .app-layout {
    display: flex; flex-direction: column; height: 100vh; overflow: hidden;
  }

  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 0.75rem; background: var(--surface1);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }

  .topbar-left {
    display: flex; align-items: center; gap: 0.5rem;
  }

  :global(.logo-icon) { color: var(--accent); flex-shrink: 0; }

  .logo-text {
    font-weight: 700; font-size: 1rem; color: var(--text-h);
  }

  .pos-count {
    font-size: 0.75rem; color: var(--muted);
  }

  .topbar-nav {
    display: flex; gap: 0.25rem;
  }

  .topbar-btn {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.375rem 0.625rem; border: 1px solid transparent; border-radius: 4px;
    background: none; color: var(--text); cursor: pointer;
    font-size: 0.8125rem; font-family: inherit;
  }

  .topbar-btn:hover {
    background: var(--surface2); color: var(--text-h);
  }

  .topbar-btn.active {
    background: var(--accent-bg); color: var(--accent); border-color: var(--accent);
  }

  .issues-btn { position: relative; }
  .issue-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #ef4444; color: #fff; font-size: 0.625rem;
    display: flex; align-items: center; justify-content: center;
    line-height: 1; padding: 0 3px;
  }

  .main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .board-column {
    display: flex; flex-direction: column; align-items: center;
    padding: 0.5rem; gap: 0.5rem; overflow: hidden;
    flex-shrink: 0;
  }

  .board-footer {
    font-size: 0.8125rem; color: var(--muted);
  }

  .turn-indicator {
    font-style: italic;
  }

  .board-fen {
    font-size: 0.6875rem; color: var(--muted);
    word-break: break-all; text-align: center;
    padding: 0 0.5rem;
  }
  .move-history {
    display: flex; flex-wrap: wrap; justify-content: center;
    column-gap: 0.5em; padding: 0 0.5rem; font-size: 0.875rem;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    color: var(--text); line-height: 1.5; user-select: text;
  }
  .history-step {
    background: none; border: none; padding: 0;
    font-family: inherit; font-size: inherit; color: var(--accent);
    cursor: pointer; white-space: nowrap; user-select: text;
  }
  .history-step:hover { text-decoration: underline; }

  .info-column {
    overflow-y: auto;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .moves-column {
    overflow-y: auto; flex-shrink: 0;
  }
</style>
