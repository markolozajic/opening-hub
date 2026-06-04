<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { labelData } from '../state/labels.svelte';
  import { getPosition, setMoveMarker } from '../db/positionStore.svelte';
  import { findMoveNumber, findAllTranspositionPaths } from '../utils/positionQueries';
  import type { MovePathStep, MoveMarker } from '../types';
  import { getComfort } from '../state/comfort.svelte';
  import { getTurn } from '../utils/fen';
  import { sortMoves, formatNumberedSan } from '../utils/positionUtils';
  import MiniBoard from './MiniBoard.svelte';
  import ComfortBadge from './ComfortBadge.svelte';
  import { navigateTo, navigatePath } from '../state/navigation.svelte';
  import { Trash2, GripVertical, Eye, X, Pencil } from '@lucide/svelte';

  let {
    onDeleteMove = undefined as ((san: string) => void) | undefined,
    onReorderMove = undefined as ((order: string[]) => void) | undefined,
    onConfirmMove = undefined as ((san: string) => void) | undefined,
  } = $props();

  let isFlipped = $derived(nav.activeRepertoire === 'black');
  let position = $derived(getPosition(nav.activeRepertoire, nav.currentFen));

  let moves = $derived(
    position
      ? Object.entries(position.moves).map(([san, edge]) => ({
          san,
          toFen: edge.toFen,
          comment: edge.comment,
          autoDetected: edge.autoDetected,
          label: labelData.moveLabels[nav.currentFen]?.[san],
          marker: edge.marker,
          childPos: getPosition(nav.activeRepertoire, edge.toFen),
          comfort: getComfort(nav.activeRepertoire, edge.toFen),
        }))
      : []
  );

  let sortedMoves = $derived(sortMoves(position?.moveOrder, moves));

  let depth = $derived(findMoveNumber(nav.activeRepertoire, nav.currentFen));
  let numberedMoves = $derived(sortedMoves.map(m => ({
    ...m,
    displaySan: formatNumberedSan(depth, getTurn(nav.currentFen) as 'w' | 'b', m.san),
  })));

  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let showTranspositionsFor = $state<string | null>(null);
  let transpositionPaths = $state<MovePathStep[][]>([]);
  let transpositionTargetName = $state('');
  let transpositionDialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (transpositionDialogRef && showTranspositionsFor !== null) {
      transpositionDialogRef.showModal();
    }
  });

  function handleNavigate(fen: string, san: string, autoDetected?: boolean) {
    if (autoDetected && onConfirmMove) {
      onConfirmMove(san);
    }
    navigateTo(fen);
  }

  function handleDragStart(e: DragEvent, i: number) {
    dragIndex = i;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, i: number) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (dragIndex !== null && dragIndex !== i) {
      dragOverIndex = i;
    }
  }

  function handleDragLeaveItem(e: DragEvent, i: number) {
    if (dragOverIndex === i && (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))) {
      dragOverIndex = null;
    }
  }

  function handleDrop(e: DragEvent, i: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) {
      resetDrag();
      return;
    }
    const display = sortedMoves.map(m => m.san);
    const [item] = display.splice(dragIndex, 1);
    display.splice(i, 0, item);
    onReorderMove?.(display);
    resetDrag();
  }

  function resetDrag() {
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleShowTranspositions(san: string, toFen: string) {
    const paths = findAllTranspositionPaths(nav.activeRepertoire, toFen);
    const target = getPosition(nav.activeRepertoire, toFen);
    transpositionTargetName = target?.name ?? toFen;
    transpositionPaths = paths.map(path =>
      path.map(step => ({
        fen: step.fen,
        san: step.san,
        toFen: step.toFen,
        marker: step.marker,
      }))
    );
    showTranspositionsFor = san;
  }

  function closeTranspositions() {
    showTranspositionsFor = null;
    transpositionPaths = [];
    transpositionDialogRef?.close();
  }

  function handlePathStepClick(path: MovePathStep[], targetIndex: number) {
    navigatePath(path, targetIndex);
  }

  let editMarkerForSan = $state<string | null>(null);
  let editMarkerCurrent = $state<MoveMarker | undefined>(undefined);
  let markerDialogRef = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (markerDialogRef && editMarkerForSan !== null) {
      markerDialogRef.showModal();
    }
  });

  function handleEditMetadata(san: string) {
    editMarkerCurrent = position?.moves[san]?.marker;
    editMarkerForSan = san;
  }

  async function handleSetMarker(marker: MoveMarker | undefined) {
    if (editMarkerForSan === null) return;
    await setMoveMarker(nav.activeRepertoire, nav.currentFen, editMarkerForSan, marker);
    editMarkerForSan = null;
    editMarkerCurrent = undefined;
    markerDialogRef?.close();
  }

  function closeMarkerDialog() {
    editMarkerForSan = null;
    editMarkerCurrent = undefined;
    markerDialogRef?.close();
  }
</script>

<div class="move-list">
  <h3 class="title">Moves</h3>
  {#if sortedMoves.length === 0}
    <p class="empty">No moves added yet. Click a piece on the board.</p>
  {:else}
    <div class="moves" role="list">
      {#each numberedMoves as move, i}
        <div
          class="move-card-wrapper"
          class:auto-detected={move.autoDetected}
          class:label-main={move.label === 'main'}
          class:label-alternative={move.label === 'alternative'}
          class:label-avoid={move.label === 'avoid'}
          class:dragging={dragIndex === i}
          class:drag-over={dragIndex !== null && dragIndex !== i && dragOverIndex === i}
          draggable={sortedMoves.length > 1}
          role="listitem"
          ondragstart={(e) => handleDragStart(e, i)}
          ondragover={(e) => handleDragOver(e, i)}
          ondragleave={(e) => handleDragLeaveItem(e, i)}
          ondrop={(e) => handleDrop(e, i)}
          ondragend={resetDrag}
        >
          <button class="drag-handle" tabindex="-1" aria-label="Drag to reorder">
            <GripVertical size={12} />
          </button>
          <button class="move-card" onclick={() => handleNavigate(move.toFen, move.san, move.autoDetected)}>
            <div class="move-header">
              <span class="move-san">{move.displaySan}</span>
              {#if move.marker}<span class="move-marker">{move.marker}</span>{/if}
              <ComfortBadge level={move.comfort} size={8} />
            </div>
            <MiniBoard fen={move.toFen} flipped={isFlipped} size={100} />
            {#if move.comment}
              <span class="move-comment">{move.comment}</span>
            {/if}
            {#if move.childPos?.name}
              <span class="child-name">{move.childPos.name}</span>
            {/if}
          </button>
          {#if onDeleteMove}
            <div class="action-btns">
              <button
                class="action-btn"
                onclick={() => handleEditMetadata(move.san)}
                title="Edit move metadata"
              >
                <Pencil size={12} />
              </button>
              <button
                class="action-btn"
                onclick={() => handleShowTranspositions(move.san, move.toFen)}
                title="Show transposition paths"
              >
                <Eye size={12} />
              </button>
              <button
                class="action-btn"
                onclick={() => onDeleteMove(move.san)}
                title="Delete move"
              >
                <Trash2 size={12} />
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<dialog
  class="transposition-dialog"
  bind:this={transpositionDialogRef}
  onclick={(e) => { if (e.target === transpositionDialogRef) closeTranspositions(); }}
  onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeTranspositions(); } }}
  onclose={closeTranspositions}
>
  {#if showTranspositionsFor !== null}
    <div class="dialog-header">
      <h3 class="dialog-title">Transposition paths to {transpositionTargetName}</h3>
      <button class="btn-icon" onclick={closeTranspositions} title="Close">
        <X size={14} />
      </button>
    </div>
    <div class="dialog-body">
      {#if transpositionPaths.length === 0}
        <p class="empty-paths">No other paths found.</p>
      {:else}
        {#each transpositionPaths as path, i}
          {#if i > 0}
            <hr class="path-separator">
          {/if}
          <div class="path-section">
            <span class="path-label">── Path {i + 1} ──</span>
            <div class="path-moves">
              {#each path as step, j}
                <button class="path-step" onclick={() => handlePathStepClick(path, j)}>
                  {j % 2 === 0 ? `${Math.floor(j / 2) + 1}. ` : ''}{step.san}{step.marker}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</dialog>

<dialog
  class="marker-dialog"
  bind:this={markerDialogRef}
  onclick={(e) => { if (e.target === markerDialogRef) closeMarkerDialog(); }}
  onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMarkerDialog(); } }}
  onclose={closeMarkerDialog}
>
  {#if editMarkerForSan !== null}
    <div class="dialog-header">
      <h3 class="dialog-title">Marker for {editMarkerForSan}</h3>
      <button class="btn-icon" onclick={closeMarkerDialog} title="Close">
        <X size={14} />
      </button>
    </div>
    <div class="dialog-body marker-options">
      {#each ['!!', '!', '!?', '?!', '?', '??'] as marker}
        {@const isSelected = editMarkerCurrent === marker}
        <button
          class="marker-btn"
          class:selected={isSelected}
          onclick={() => editMarkerCurrent = marker as MoveMarker}
        >
          {marker}
        </button>
      {/each}
      <div class="marker-actions">
        {#if editMarkerCurrent}
          <button class="btn" onclick={async () => { await handleSetMarker(undefined); }}>Clear</button>
        {/if}
        <button class="btn primary" onclick={async () => { await handleSetMarker(editMarkerCurrent); }}>Save</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .move-list {
    display: flex; flex-direction: column; gap: 0.5rem;
    padding: 0.75rem; overflow-y: auto; min-width: 120px;
  }
  .title { margin: 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .empty { color: var(--muted); font-style: italic; font-size: 0.8125rem; margin: 0; }
  .moves { display: flex; flex-direction: column; gap: 0.5rem; }
  .move-card-wrapper {
    display: flex; align-items: flex-start; gap: 0.25rem;
    transition: opacity 0.15s;
  }
  .move-card-wrapper.dragging {
    opacity: 0.35;
  }
  .move-card-wrapper.drag-over {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-radius: 6px;
  }
  .move-card-wrapper.auto-detected {
    opacity: 0.65;
  }
  .move-card-wrapper.auto-detected .move-card {
    border-style: dashed;
  }
  .label-main .move-card {
    border-color: #d97706;
    background: rgba(217, 119, 6, 0.08);
  }
  .label-alternative .move-card {
    border-color: #2563eb;
    background: rgba(37, 99, 235, 0.08);
  }
  .label-avoid .move-card {
    border-color: #dc2626;
    background: rgba(220, 38, 38, 0.08);
  }
  .drag-handle {
    display: flex; align-items: center; justify-content: center;
    padding: 0.25rem; border: none; border-radius: 4px;
    background: transparent; color: var(--muted); cursor: grab;
    flex-shrink: 0; margin-top: 0.5rem; outline: none;
  }
  .drag-handle:hover { color: var(--text); background: var(--surface2); }
  .move-card {
    display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
    padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;
    background: var(--surface1); cursor: pointer; text-align: center;
    transition: all 0.15s; flex: 1; min-width: 0; box-sizing: border-box;
    font-family: inherit;
  }
  .move-card:hover {
    border-color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  .action-btns {
    display: flex; flex-direction: column; gap: 0.25rem;
    flex-shrink: 0;
  }
  .action-btn {
    display: flex; align-items: center; justify-content: center;
    padding: 0.25rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--muted); cursor: pointer;
  }
  .action-btn:hover { color: var(--accent); border-color: var(--accent); }
  .action-btn:last-child:hover { color: var(--danger, #ef4444); border-color: var(--danger, #ef4444); }
  .move-header { display: flex; align-items: center; gap: 0.375rem; }
  .move-san { font-weight: 600; font-size: 0.9375rem; color: var(--text-h); }
  .move-marker { font-weight: 600; font-size: 0.9375rem; color: var(--accent); }
  .move-comment { font-size: 0.6875rem; color: var(--text); line-height: 1.3; }
  .child-name { font-size: 0.6875rem; color: var(--accent); font-style: italic; }

  .transposition-dialog {
    border: 1px solid var(--border); border-radius: 8px; padding: 0;
    background: var(--bg); color: var(--text); min-width: 320px; max-width: 480px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  }
  .transposition-dialog::backdrop {
    background: rgba(0,0,0,0.3);
  }
  .dialog-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border);
  }
  .dialog-title {
    margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text-h);
  }
  .dialog-body {
    padding: 0.75rem; max-height: 60vh; overflow-y: auto;
  }
  .empty-paths {
    color: var(--muted); font-style: italic; font-size: 0.875rem; text-align: center; margin: 1rem 0;
  }
  .path-section {
    display: flex; flex-direction: column; gap: 0.375rem;
  }
  .path-label {
    font-size: 0.75rem; font-weight: 600; color: var(--muted);
    letter-spacing: 0.03em;
  }
  .path-moves {
    display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.8125rem; color: var(--text-h); line-height: 1.5; user-select: text;
  }
  .path-step {
    background: none; border: none; padding: 0;
    font-family: inherit; font-size: inherit; color: var(--accent);
    cursor: pointer; white-space: nowrap; user-select: text;
  }
  .path-step:hover { text-decoration: underline; }
  .path-separator {
    border: none; border-top: 1px solid var(--border); margin: 0.5rem 0;
  }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }

  .marker-dialog {
    border: 1px solid var(--border); border-radius: 8px; padding: 0;
    background: var(--bg); color: var(--text); min-width: 260px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  }
  .marker-dialog::backdrop { background: rgba(0,0,0,0.3); }
  .marker-options {
    display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center;
  }
  .marker-btn {
    padding: 0.5rem 0.75rem; border: 2px solid var(--border); border-radius: 6px;
    background: var(--surface1); color: var(--text-h); cursor: pointer;
    font-size: 1rem; font-weight: 600; font-family: inherit; min-width: 3rem;
    transition: all 0.1s;
  }
  .marker-btn:hover { border-color: var(--accent); background: var(--surface2); }
  .marker-btn.selected { border-color: var(--accent); background: var(--accent-bg); }
  .marker-actions {
    display: flex; gap: 0.5rem; justify-content: center; width: 100%; margin-top: 0.5rem;
  }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: 0.8125rem;
    font-family: inherit;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
</style>
