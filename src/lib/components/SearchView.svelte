<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { getRepertoirePositions } from '../db/positionStore.svelte';
  import { getComfort } from '../state/comfort.svelte';
  import { navigateTo } from '../state/navigation.svelte';
  import type { ComfortLevel } from '../types';
  import { Search, X } from '@lucide/svelte';
  import ComfortBadge from './ComfortBadge.svelte';
  import MiniBoard from './MiniBoard.svelte';

  let query = $state('');
  let filterComfort = $state<ComfortLevel | ''>('');
  let showTerminalOnly = $state(true);

  let allPositions = $derived(getRepertoirePositions(nav.activeRepertoire));

  let positions = $derived(
    allPositions.filter(p => {
      if (showTerminalOnly && Object.keys(p.moves).length > 0) return false;
      if (filterComfort) {
        const c = getComfort(nav.activeRepertoire, p.fen);
        if (c !== filterComfort) return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (p.name?.toLowerCase().includes(q) ?? false) ||
        (p.comment?.toLowerCase().includes(q) ?? false) ||
        p.fen.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.updatedAt - a.updatedAt)
  );

  function handleNavigate(fen: string) {
    navigateTo(fen);
  }

  function clearFilters() {
    query = '';
    filterComfort = '';
    showTerminalOnly = true;
  }
</script>

<div class="search-view">
  <div class="search-bar">
    <Search size={14} class="search-icon" />
    <input
      bind:value={query}
      class="search-input"
      placeholder="Search by name, comment, or FEN..."
      type="search"
    />
    <select bind:value={filterComfort} class="filter-select">
      <option value="">All comfort</option>
      <option value="easy">Easy</option>
      <option value="moderate">Moderate</option>
      <option value="uncomfortable">Uncomfortable</option>
    </select>
    <label class="terminal-toggle">
      <input type="checkbox" bind:checked={showTerminalOnly} />
      Leaves only
    </label>
    {#if query || filterComfort || !showTerminalOnly}
      <button class="btn-icon" onclick={clearFilters} title="Clear filters">
        <X size={14} />
      </button>
    {/if}
  </div>

  <div class="results">
    {#if positions.length === 0}
      <p class="empty">No positions found.</p>
    {:else}
      <div class="grid">
        {#each positions as pos}
          <button class="result-card" onclick={() => handleNavigate(pos.fen)}>
            {#if pos.name}
              <span class="result-name">{pos.name}</span>
            {/if}
            <MiniBoard fen={pos.fen} size={70} />
            <div class="result-info">
              <div class="result-meta">
                <ComfortBadge level={getComfort(nav.activeRepertoire, pos.fen)} size={8} />
                <span class="result-count">{Object.keys(pos.moves).length} move(s)</span>
              </div>
              {#if pos.comment}
                <span class="result-excerpt">{pos.comment.slice(0, 80)}{pos.comment.length > 80 ? '…' : ''}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
      <p class="count">{positions.length} position(s)</p>
    {/if}
  </div>
</div>

<style>
  .search-view {
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
  }
  .search-bar {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem; border-bottom: 1px solid var(--border);
    background: var(--surface1);
  }
  :global(.search-icon) { flex-shrink: 0; color: var(--muted); }
  .search-input {
    flex: 1; padding: 0.375rem 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.875rem; font-family: inherit;
  }
  .filter-select {
    padding: 0.375rem 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.8125rem; font-family: inherit;
  }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
  .terminal-toggle {
    display: flex; align-items: center; gap: 0.25rem;
    font-size: 0.75rem; color: var(--muted); cursor: pointer; white-space: nowrap;
  }
  .terminal-toggle input { margin: 0; }
  .results { flex: 1; overflow-y: auto; padding: 0.75rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
  .result-card {
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px;
    background: var(--surface1); cursor: pointer; text-align: center;
    transition: all 0.15s; font-family: inherit; width: 100%; box-sizing: border-box;
  }
  .result-card:hover { border-color: var(--accent); }
  .result-info { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; width: 100%; }
  .result-name { font-weight: 600; font-size: 0.875rem; color: var(--text-h); text-align: center; }
  .result-meta { display: flex; align-items: center; gap: 0.25rem; font-size: 0.6875rem; color: var(--muted); }
  .result-count { font-size: 0.6875rem; }
  .result-excerpt { font-size: 0.6875rem; color: var(--text); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .empty { color: var(--muted); font-style: italic; font-size: 0.875rem; text-align: center; padding: 2rem; }
  .count { font-size: 0.75rem; color: var(--muted); text-align: center; margin: 0.5rem 0 0; }
</style>
