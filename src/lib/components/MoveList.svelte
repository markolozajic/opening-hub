<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { getPosition, findMoveNumber } from '../db/positionStore.svelte';
  import { getComfort } from '../state/comfort.svelte';
  import { getTurn } from '../utils/fen';
  import { sortMoves, formatNumberedSan } from '../utils/positionUtils';
  import MiniBoard from './MiniBoard.svelte';
  import ComfortBadge from './ComfortBadge.svelte';
  import { navigateTo } from '../state/navigation.svelte';
  import { Trash2, GripVertical } from '@lucide/svelte';

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
          label: edge.label,
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
            <button
              class="delete-btn"
              onclick={() => onDeleteMove(move.san)}
              title="Delete move"
            >
              <Trash2 size={12} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

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
  .delete-btn {
    display: flex; align-items: center; justify-content: center;
    padding: 0.25rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--muted); cursor: pointer;
    flex-shrink: 0; margin-top: 0.25rem;
  }
  .delete-btn:hover { color: var(--danger, #ef4444); border-color: var(--danger, #ef4444); }
  .move-header { display: flex; align-items: center; gap: 0.375rem; }
  .move-san {
    font-weight: 600; font-size: 0.9375rem; color: var(--text-h);
  }
  .move-comment { font-size: 0.6875rem; color: var(--text); line-height: 1.3; }
  .child-name { font-size: 0.6875rem; color: var(--accent); font-style: italic; }
</style>
