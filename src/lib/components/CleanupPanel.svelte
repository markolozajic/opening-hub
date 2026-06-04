<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { getUnreachablePositions, deletePosition } from '../db/positionStore.svelte';
  import { X } from '@lucide/svelte';

  let {
    onClose = undefined as (() => void) | undefined,
  } = $props();

  let unreachable = $derived(getUnreachablePositions(nav.activeRepertoire));

  async function handleDelete(fen: string) {
    if (!confirm(`Delete unreachable position?\n${fen.slice(0, 40)}…`)) return;
    await deletePosition(nav.activeRepertoire, fen);
  }

  async function handleDeleteAll() {
    const count = unreachable.length;
    if (count === 0) return;
    if (!confirm(`Delete all ${count} unreachable positions? This cannot be undone.`)) return;
    for (const p of unreachable) {
      await deletePosition(nav.activeRepertoire, p.fen);
    }
  }
</script>

<div class="cleanup-panel">
  <div class="panel-header">
    <h3 class="panel-title">Unreachable Positions</h3>
    <button class="btn-icon" onclick={() => onClose?.()}>
      <X size={14} />
    </button>
  </div>

  <p class="hint">
    Positions that are no longer reachable from the root position.
    They are preserved in case a move is re-added or reached via a different move order.
  </p>

  {#if unreachable.length === 0}
    <p class="empty">No unreachable positions.</p>
  {:else}
    <div class="actions">
      <button class="btn danger" onclick={handleDeleteAll}>
        Delete All ({unreachable.length})
      </button>
    </div>

    <div class="list">
      {#each unreachable as pos}
        <div class="item">
          <div class="item-info">
            <code class="item-fen">{pos.fen.slice(0, 30)}…</code>
            {#if pos.name}
              <span class="item-name">{pos.name}</span>
            {/if}
          </div>
          <button
            class="btn-icon delete-item"
            onclick={() => handleDelete(pos.fen)}
            title="Delete this position"
          >
            <X size={12} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cleanup-panel {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem; overflow-y: auto;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h); }
  .hint { font-size: 0.75rem; color: var(--muted); margin: 0; line-height: 1.4; }
  .empty { color: var(--muted); font-style: italic; font-size: 0.8125rem; }
  .actions { display: flex; gap: 0.5rem; }
  .btn {
    padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer;
    font-size: 0.875rem; font-family: inherit;
  }
  .btn:hover { background: var(--surface2); }
  .btn.danger { color: var(--danger, #ef4444); border-color: var(--danger, #ef4444); }
  .btn.danger:hover { background: #fef2f2; }
  .list { display: flex; flex-direction: column; gap: 0.375rem; }
  .item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1);
  }
  .item-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
  .item-fen { font-size: 0.6875rem; color: var(--muted); }
  .item-name { font-size: 0.8125rem; color: var(--text-h); font-weight: 500; }
  .delete-item { flex-shrink: 0; }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--danger, #ef4444); background: var(--surface2); }
</style>
