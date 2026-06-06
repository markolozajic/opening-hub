<script lang="ts">
  import { nav, chooseMove, cancelMoveChooser } from '../state/navigation.svelte';
  import { labelData } from '../state/labels.svelte';
  import { getPosition } from '../db/positionStore.svelte';
  import { getComfort } from '../state/comfort.svelte';
  import { sortMoves } from '../utils/positionUtils';
  import { MOVE_LABELS } from '../constants';
  import ComfortBadge from './ComfortBadge.svelte';
  import { X } from '@lucide/svelte';

  let children = $derived(buildChildren());
  let dialogRef = $state<HTMLDialogElement | null>(null);
  let listRef = $state<HTMLDivElement | null>(null);
  let selectedIndex = $state(0);

  $effect(() => {
    if (dialogRef) {
      dialogRef.showModal();
      selectedIndex = 0;
    }
  });

  $effect(() => {
    if (listRef && children.length > 0) {
      listRef.focus();
    }
  });

  function buildChildren() {
    const pos = getPosition(nav.activeRepertoire, nav.currentFen);
    if (!pos) return [];
    const raw = Object.entries(pos.moves).map(([san, edge]) => ({
      san,
      toFen: edge.toFen,
      comfort: getComfort(nav.activeRepertoire, edge.toFen),
      childName: getPosition(nav.activeRepertoire, edge.toFen)?.name,
      label: labelData.moveLabels[nav.currentFen]?.[san],
      marker: edge.marker,
    }));
    return sortMoves(pos.moveOrder, raw, nav.sortMode);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogRef) {
      cancelMoveChooser();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % children.length;
      scrollIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + children.length) % children.length;
      scrollIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (children[selectedIndex]) {
        chooseMove(children[selectedIndex].toFen);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
    }
  }

  function scrollIntoView() {
    const items = listRef?.querySelectorAll('.chooser-item');
    items?.[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }
</script>

<dialog
  class="move-chooser"
  bind:this={dialogRef}
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
  onclose={cancelMoveChooser}
>
  <div class="chooser-header">
    <h3 class="chooser-title">Choose move</h3>
    <button class="btn-icon" onclick={cancelMoveChooser} title="Close">
      <X size={14} />
    </button>
  </div>

  <div class="chooser-list" bind:this={listRef} tabindex="-1" role="listbox">
    {#each children as child, i}
      <button
        class="chooser-item"
        class:selected={i === selectedIndex}
        class:label-main={child.label === 'main'}
        class:label-alternative={child.label === 'alternative'}
        class:label-avoid={child.label === 'avoid'}
        role="option"
        aria-selected={i === selectedIndex}
        onclick={() => chooseMove(child.toFen)}
        onmouseenter={() => selectedIndex = i}
      >
        <span class="child-san">{child.san}{child.marker}</span>
        <ComfortBadge level={child.comfort} size={10} />
        {#if child.childName}
          <span class="child-name">{child.childName}</span>
        {/if}
      </button>
    {/each}
  </div>
</dialog>

<style>
  .move-chooser {
    border: 1px solid var(--border); border-radius: 8px; padding: 0;
    background: var(--bg); color: var(--text); min-width: 200px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  }
  .move-chooser::backdrop {
    background: rgba(0,0,0,0.3);
  }
  .chooser-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border);
  }
  .chooser-title { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text-h); }
  .chooser-list { display: flex; flex-direction: column; padding: 0.375rem; gap: 0.25rem; outline: none; }
  .chooser-item {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 0.75rem; border: 1px solid transparent; border-radius: 6px;
    background: none; cursor: pointer; text-align: left; width: 100%;
    box-sizing: border-box; font-family: inherit; font-size: 0.9375rem;
    transition: all 0.1s;
  }
  .chooser-item:hover { background: var(--surface2); border-color: var(--accent); }
  .chooser-item.selected { background: var(--accent-bg); border-color: var(--accent); }
  .chooser-item.label-main { border-left: 3px solid var(--label-main); }
  .chooser-item.label-alternative { border-left: 3px solid var(--label-alt); }
  .chooser-item.label-avoid { border-left: 3px solid var(--label-avoid); }
  .child-san { font-weight: 600; color: var(--text-h); min-width: 2.5rem; }
  .child-name { font-size: 0.75rem; color: var(--accent); font-style: italic; }

  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
</style>
