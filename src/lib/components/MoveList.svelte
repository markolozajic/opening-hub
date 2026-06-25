<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { labelData, recomputeLabels } from '../state/labels.svelte';
  import { getPosition, setMoveMarker, setMoveLabel, setComfortLevel, setForcedDraw, setPracticalDraw, setMoveOrder } from '../db/positionStore.svelte';
  import { findMoveNumber, findAllTranspositionPaths } from '../utils/positionQueries';
  import type { MovePathStep, MoveMarker, ComfortLevel, MoveLabel } from '../types';
  import { COMFORT_COLORS, COMFORT_LABELS, MOVE_LABELS } from '../constants';
  import { getComfort, invalidateComfortCache } from '../state/comfort.svelte';
  import { getDrawCounts, invalidateDrawCounts } from '../state/drawCounts.svelte';
  import { getNovelty } from '../state/novelty.svelte';
  import { getTurn } from '../utils/fen';
  import { sortMoves, formatNumberedSan } from '../utils/positionUtils';
  import MiniBoard from './MiniBoard.svelte';
  import ComfortBadge from './ComfortBadge.svelte';
  import { navigateTo, navigatePath } from '../state/navigation.svelte';
  import { prepState, nextSansForPath, selectOpponent, tagPosition, untagPosition, getOpponentNames, getDirectlyTaggedOpponents } from '../state/preparation.svelte';
  import { Trash2, GripVertical, Eye, X, Pencil } from '@lucide/svelte';

  let {
    onDeleteMove = undefined as ((san: string) => void) | undefined,
    onReorderMove = undefined as ((order: string[]) => void) | undefined,
    onConfirmMove = undefined as ((san: string) => void) | undefined,
  } = $props();

  let isFlipped = $derived(nav.activeRepertoire === 'black');
  let position = $derived(getPosition(nav.activeRepertoire, nav.currentFen));

  let allowedSans = $derived(
    prepState.selectedOpponent
      ? nextSansForPath(nav.activeRepertoire, nav.currentPath.map(s => s.san), prepState.selectedOpponent)
      : null
  );

  let moves = $derived(
    position
      ? Object.entries(position.moves)
          .filter(([san, edge]) => {
            if (allowedSans === null) return true;
            if (allowedSans.length === 0) return false;
            return allowedSans.includes(san);
          })
          .map(([san, edge]) => {
            const dc = getDrawCounts(nav.activeRepertoire, edge.toFen);
            return {
              san,
              toFen: edge.toFen,
              comment: edge.comment,
              autoDetected: edge.autoDetected,
              label: labelData.moveLabels[nav.currentFen]?.[san],
              marker: edge.marker,
              childPos: getPosition(nav.activeRepertoire, edge.toFen),
              comfort: getComfort(nav.activeRepertoire, edge.toFen),
              forcedDraws: dc.forced,
              practicalDraws: dc.practical,
            };
          })
      : []
  );

  let sortMode = $derived(nav.sortMode);
  let sortedMoves = $derived(sortMoves(position?.moveOrder, moves, sortMode));

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

  let editMoveSan = $state<string | null>(null);
  let editCurrentMarker = $state<MoveMarker | undefined>(undefined);
  let editCurrentLabel = $state<MoveLabel | undefined>(undefined);
  let editCurrentComfort = $state<ComfortLevel | undefined>(undefined);
  let editCurrentForcedDraw = $state(false);
  let editCurrentPracticalDraw = $state(false);
  let editToFen = $state<string>('');
  let editIsLeaf = $state(false);
  let editShowLabel = $state(false);
  let metaDialogRef = $state<HTMLDialogElement | null>(null);
  let metaTagOpponent = $state('');
  let metaTaggableOpponents = $derived(editToFen ? getOpponentNames() : []);
  let metaTaggedAtPosition = $derived(
    editToFen ? getDirectlyTaggedOpponents(nav.activeRepertoire, editToFen) : []
  );

  let availableLabels = $derived.by(() => {
    if (!editShowLabel) return [];
    const lbl = labelData.positionLabels[nav.currentFen];
    if (lbl === 'avoid') return ['avoid'] as MoveLabel[];
    if (lbl === 'alternative') return ['alternative', 'avoid'] as MoveLabel[];
    return ['main', 'alternative', 'avoid'] as MoveLabel[];
  });

  let ourTurn = $derived(getTurn(nav.currentFen) === (nav.activeRepertoire === 'white' ? 'w' : 'b'));
  let moveCount = $derived(position ? Object.keys(position.moves).length : 0);
  let isCurrentPositionNovel = $derived(getNovelty(nav.activeRepertoire, nav.currentFen));

  $effect(() => {
    if (metaDialogRef && editMoveSan !== null) {
      metaDialogRef.showModal();
    }
  });

  function handleEditMetadata(san: string) {
    const edge = position?.moves[san];
    if (!edge) return;
    editCurrentMarker = edge.marker;
    editCurrentLabel = edge.label;
    editMoveSan = san;
    editToFen = edge.toFen;
    const childPos = getPosition(nav.activeRepertoire, edge.toFen);
    editIsLeaf = childPos ? Object.keys(childPos.moves).length === 0 : false;
    editCurrentComfort = childPos?.comfortLevel;
    editCurrentForcedDraw = childPos?.forcedDraw ?? false;
    editCurrentPracticalDraw = childPos?.practicalDraw ?? false;
    editShowLabel = ourTurn && moveCount > 1;
  }

  async function handleSaveMeta() {
    if (editMoveSan === null) return;
    const rep = nav.activeRepertoire;
    const fen = nav.currentFen;
    const san = editMoveSan;

    await setMoveMarker(rep, fen, san, editCurrentMarker);

    if (editShowLabel) {
      await setMoveLabel(rep, fen, san, editCurrentLabel);
    }

    if (editIsLeaf && editToFen) {
      await setComfortLevel(rep, editToFen, editCurrentComfort);
      invalidateComfortCache(rep, editToFen);
      await setForcedDraw(rep, editToFen, editCurrentForcedDraw);
      await setPracticalDraw(rep, editToFen, editCurrentPracticalDraw);
      invalidateDrawCounts(rep);
    }

    recomputeLabels(rep);
    closeMetaDialog();
  }

  function closeMetaDialog() {
    editMoveSan = null;
    editCurrentMarker = undefined;
    editCurrentLabel = undefined;
    editCurrentComfort = undefined;
    editCurrentForcedDraw = false;
    editCurrentPracticalDraw = false;
    editToFen = '';
    editIsLeaf = false;
    editShowLabel = false;
    metaDialogRef?.close();
  }

  function handleToggleSortMode() {
    nav.sortMode = sortMode === 'comfort' ? 'manual' : 'comfort';
  }

  async function handleMetaTag() {
    if (!metaTagOpponent.trim() || !editToFen) return;
    await tagPosition(nav.activeRepertoire, editToFen, metaTagOpponent.trim());
    metaTagOpponent = '';
  }

  async function handleMetaUntag(opponent: string) {
    if (!editToFen) return;
    await untagPosition(nav.activeRepertoire, editToFen, opponent);
  }
</script>

<div class="move-list">
  {#if prepState.selectedOpponent}
    <div class="opponent-filter-banner">
      <span class="opponent-filter-label">PLAYER FILTER: {prepState.selectedOpponent?.includes(', ') ? prepState.selectedOpponent.split(', ').reverse().join(' ') : prepState.selectedOpponent}</span>
      <button class="banner-clear-btn" onclick={() => selectOpponent(null)} title="Clear player filter">
        <X size={12} /> Clear
      </button>
    </div>
  {/if}
  <div class="title-row">
    <h3 class="title">Moves</h3>
    <div class="title-actions">
      <button class="sort-toggle" onclick={handleToggleSortMode} title={sortMode === 'comfort' ? 'Switch to manual order' : 'Switch to comfort order'}>
        {sortMode === 'comfort' ? 'Active: Comfort order' : 'Active: Manual order'}
      </button>
    </div>
  </div>
  {#if sortedMoves.length === 0}
    <p class="empty">{prepState.selectedOpponent ? `No moves by ${prepState.selectedOpponent.includes(', ') ? prepState.selectedOpponent.split(', ').reverse().join(' ') : prepState.selectedOpponent} at this position.` : 'No moves added yet. Click a piece on the board.'}</p>
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
          draggable={sortMode === 'manual' && sortedMoves.length > 1}
          role="listitem"
          ondragstart={(e) => handleDragStart(e, i)}
          ondragover={(e) => handleDragOver(e, i)}
          ondragleave={(e) => handleDragLeaveItem(e, i)}
          ondrop={(e) => handleDrop(e, i)}
          ondragend={resetDrag}
        >
          {#if sortMode === 'manual'}
            <button class="drag-handle" tabindex="-1" aria-label="Drag to reorder">
              <GripVertical size={12} />
            </button>
          {/if}
          <button class="move-card" onclick={() => handleNavigate(move.toFen, move.san, move.autoDetected)}>
            <div class="move-header">
              <div class="draw-indicator">
                <span class="draw-symbol">&#189;</span>
                <span class="draw-counts"><span class="draw-count forced">{move.forcedDraws}</span>/<span class="draw-count practical">{move.practicalDraws}</span></span>
              </div>
              <div class="move-info">
                <span class="move-san">{move.displaySan}</span>
                {#if move.marker}<span class="move-marker" class:move-marker-novelty={move.marker === 'N'}>{move.marker}</span>{/if}
                <ComfortBadge level={move.comfort} size={8} />
              </div>
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
  class="meta-dialog"
  bind:this={metaDialogRef}
  onclick={(e) => { if (e.target === metaDialogRef) closeMetaDialog(); }}
  onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMetaDialog(); } }}
  onclose={closeMetaDialog}
>
  {#if editMoveSan !== null}
    <div class="dialog-header">
      <h3 class="dialog-title">{editMoveSan}</h3>
      <button class="btn-icon" onclick={closeMetaDialog} title="Close">
        <X size={14} />
      </button>
    </div>
    <div class="dialog-body">
      {#if editShowLabel}
        <div class="dialog-section">
          <span class="dialog-section-title">Label</span>
          <div class="label-options">
            {#each availableLabels as l}
              {@const isSelected = editCurrentLabel === l}
              <button
                class="meta-btn label-btn"
                class:selected={isSelected}
                class:meta-btn-main={l === 'main'}
                class:meta-btn-alt={l === 'alternative'}
                class:meta-btn-avoid={l === 'avoid'}
                onclick={() => editCurrentLabel = isSelected ? undefined : l as MoveLabel}
              >
                {MOVE_LABELS[l]}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if !ourTurn && editToFen}
        <div class="dialog-section">
          <span class="dialog-section-title">Tag position</span>
          <div class="tag-row-centered">
            <input
              bind:value={metaTagOpponent}
              class="meta-input"
              placeholder="Player…"
              list="meta-tag-opponents" />
            <datalist id="meta-tag-opponents">
              {#each metaTaggableOpponents as p}
                <option value={p}></option>
              {/each}
            </datalist>
            <button class="meta-btn" onclick={handleMetaTag} disabled={!metaTagOpponent.trim()}>Tag</button>
          </div>
          {#if metaTaggedAtPosition.length > 0}
            <div class="meta-tagged-list">
              {#each metaTaggedAtPosition as p}
                <span class="meta-tag-item">
                  {p.includes(', ') ? p.split(', ').reverse().join(' ') : p}
                  <button class="meta-untag-btn" onclick={() => handleMetaUntag(p)}>x</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="dialog-section">
        <span class="dialog-section-title">Marker</span>
        <div class="marker-options">
          {#each ['!!', '!', '!?', '?!', '?', '??'] as marker}
            {@const isSelected = editCurrentMarker === marker}
            <button
              class="meta-btn"
              class:selected={isSelected}
              onclick={() => editCurrentMarker = isSelected ? undefined : marker as MoveMarker}
            >
              {marker}
            </button>
          {/each}
          <button
            class="meta-btn novelty-btn"
            class:selected={editCurrentMarker === 'N'}
            class:disabled-novelty={isCurrentPositionNovel}
            disabled={isCurrentPositionNovel}
            onclick={() => editCurrentMarker = editCurrentMarker === 'N' ? undefined : 'N' as MoveMarker}
          >
            N
          </button>
        </div>
      </div>

      {#if editIsLeaf}
        <div class="dialog-section">
          <span class="dialog-section-title">Comfort</span>
          <div class="comfort-options">
            {#each ['easy', 'comfortable', 'moderate', 'uncomfortable', 'struggling'] as level}
              {@const isSelected = editCurrentComfort === level}
              <button
                class="meta-btn comfort-btn"
                class:selected={isSelected}
                style:border-color={COMFORT_COLORS[level]}
                style:background={isSelected ? COMFORT_COLORS[level] : 'transparent'}
                style:color={isSelected ? '#fff' : 'inherit'}
                onclick={() => editCurrentComfort = isSelected ? undefined : level as ComfortLevel}
              >
                {COMFORT_LABELS[level]}
              </button>
            {/each}
          </div>
        </div>
        <div class="dialog-section">
          <span class="dialog-section-title">Position Drawn?</span>
          <div class="draw-toggle-options">
            <button
              class="meta-btn draw-toggle-btn"
              class:selected={editCurrentForcedDraw}
              onclick={() => { editCurrentForcedDraw = !editCurrentForcedDraw; editCurrentPracticalDraw = false; }}
            >
              By Force
            </button>
            <button
              class="meta-btn draw-toggle-btn"
              class:selected={editCurrentPracticalDraw}
              onclick={() => { editCurrentPracticalDraw = !editCurrentPracticalDraw; editCurrentForcedDraw = false; }}
            >
              Practically
            </button>
          </div>
        </div>
      {/if}

      <div class="dialog-actions">
        <button class="btn primary" onclick={handleSaveMeta}>Save</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .move-list {
    display: flex; flex-direction: column; gap: 0.5rem;
    padding: 0.75rem; overflow-y: auto; min-width: 120px;
  }
  .title-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .title { margin: 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .title-actions { display: flex; align-items: center; gap: 0.25rem; }
  .opponent-filter-banner {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.375rem 0.5rem; border-radius: 4px; background: var(--accent-bg);
    border: 1px solid var(--accent);
  }
  .opponent-filter-label {
    font-size: 0.75rem; font-weight: 600; color: var(--accent);
  }
  .banner-clear-btn {
    display: inline-flex; align-items: center; gap: 0.125rem;
    font-size: 0.625rem; padding: 0.125rem 0.375rem; border: 1px solid var(--accent);
    border-radius: 4px; background: transparent; color: var(--accent); cursor: pointer;
    font-family: inherit; white-space: nowrap;
  }
  .banner-clear-btn:hover { background: var(--accent); color: #fff; }
  .sort-toggle {
    font-size: 0.625rem; padding: 0.125rem 0.375rem; border: 1px solid var(--border);
    border-radius: 4px; background: var(--surface1); color: var(--muted); cursor: pointer;
    font-family: inherit; white-space: nowrap;
  }
  .sort-toggle:hover { border-color: var(--accent); color: var(--accent); }
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
    border-color: var(--label-main);
    background: color-mix(in srgb, var(--label-main) 12%, transparent);
  }
  .label-alternative .move-card {
    border-color: var(--label-alt);
    background: color-mix(in srgb, var(--label-alt) 12%, transparent);
  }
  .label-avoid .move-card {
    border-color: var(--label-avoid);
    background: color-mix(in srgb, var(--label-avoid) 12%, transparent);
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
  .move-header {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
  }

  .move-header .draw-indicator {
    position: absolute;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }

  .move-header .draw-symbol {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--text-h);
  }

  .move-header .draw-counts {
    font-size: 0.6875rem;
    display: flex;
    gap: 0;
  }

  .move-header .draw-count.forced {
    color: #ef4444;
    font-weight: 700;
  }

  .move-header .draw-count.practical {
    color: #ca8a04;
    font-weight: 700;
  }

  .move-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .move-san { font-weight: 600; font-size: 0.9375rem; color: var(--text-h); }
  .move-marker { font-weight: 600; font-size: 0.9375rem; color: var(--accent); }
  .move-marker-novelty { color: #14b8a6; }
  .move-comment { font-size: 0.6875rem; color: var(--text); line-height: 1.3; }
  .child-name { font-size: 0.6875rem; color: var(--accent); font-style: italic; }

  .draw-toggle-options {
    display: flex;
    gap: 0.375rem;
    justify-content: center;
  }

  .draw-toggle-btn {
    font-size: 0.75rem;
    padding: 0.375rem 0.625rem;
  }

  .draw-toggle-btn.selected {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

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

  .meta-dialog {
    border: 1px solid var(--border); border-radius: 8px; padding: 0;
    background: var(--bg); color: var(--text); min-width: 280px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  }
  .meta-dialog::backdrop { background: rgba(0,0,0,0.3); }
  .dialog-section { display: flex; flex-direction: column; gap: 0.375rem; }
  .dialog-section + .dialog-section { margin-top: 0.75rem; }
  .dialog-section-title {
    font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--muted); text-align: center;
  }
  .marker-options {
    display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center;
  }
  .label-options, .comfort-options {
    display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center;
  }
  .novelty-btn { border-color: var(--border); }
  .novelty-btn.selected { border-color: #14b8a6; background: color-mix(in srgb, #14b8a6 15%, transparent); color: #14b8a6; }
  .novelty-btn.disabled-novelty { opacity: 0.35; cursor: not-allowed; }
  .novelty-btn.disabled-novelty:hover { border-color: var(--border); background: var(--surface1); }
  .meta-btn {
    padding: 0.375rem 0.75rem; border: 2px solid var(--border); border-radius: 6px;
    background: var(--surface1); color: var(--text-h); cursor: pointer;
    font-size: 0.875rem; font-weight: 500; font-family: inherit;
    transition: all 0.1s;
  }
  .meta-btn:hover { border-color: var(--accent); background: var(--surface2); }
  .meta-btn.selected { border-color: var(--accent); background: var(--accent-bg); }
  .meta-btn.label-btn.selected { border-color: var(--label-main); background: var(--label-main); color: #fff; }
  .meta-btn.label-btn.meta-btn-alt.selected { border-color: var(--label-alt); background: var(--label-alt); color: #fff; }
  .meta-btn.label-btn.meta-btn-avoid.selected { border-color: var(--label-avoid); background: var(--label-avoid); color: #fff; }
  .comfort-btn { font-size: 0.75rem; padding: 0.375rem 0.625rem; }
  .tag-row-centered {
    display: flex; gap: 0.25rem; justify-content: center; align-items: center;
  }
  .meta-input {
    flex: 1; padding: 0.375rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.8125rem; font-family: inherit;
    box-sizing: border-box; max-width: 140px;
  }
  .meta-tagged-list {
    display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: center; margin-top: 0.25rem;
  }
  .meta-tag-item {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.125rem 0.375rem; border: 1px solid var(--border); border-radius: 3px;
    background: var(--surface2); font-size: 0.75rem; color: var(--text-h);
  }
  .meta-untag-btn {
    border: none; background: none; cursor: pointer; padding: 0;
    font-size: 0.75rem; color: var(--muted); line-height: 1;
  }
  .meta-untag-btn:hover { color: var(--danger); }
  .dialog-actions {
    display: flex; gap: 0.5rem; justify-content: center; width: 100%; margin-top: 0.75rem;
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
