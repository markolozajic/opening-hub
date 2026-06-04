<script lang="ts">
  import { labelData } from '../state/labels.svelte';
  import { nav } from '../state/navigation.svelte';
  import { getPosition } from '../db/positionStore.svelte';
  import { getComfort } from '../state/comfort.svelte';
  import { navigateTo } from '../state/navigation.svelte';
  import MiniBoard from './MiniBoard.svelte';
  import ComfortBadge from './ComfortBadge.svelte';

  let {
    onClose = undefined as (() => void) | undefined,
  } = $props();

  let isFlipped = $derived(nav.activeRepertoire === 'black');

  let positions = $derived(
    labelData.issuePositions.map(p => {
      const pos = getPosition(nav.activeRepertoire, p.fen);
      return { ...p, comfort: getComfort(nav.activeRepertoire, p.fen), moves: pos ? Object.keys(pos.moves).length : 0 };
    })
  );

  function handleNavigate(fen: string) {
    navigateTo(fen);
    onClose?.();
  }
</script>

<div class="issues-view">
  <div class="issues-bar">
    <h3 class="issues-title">
      Repertoire Issues
      {#if labelData.issueCount > 0}
        <span class="issues-count">({labelData.issueCount})</span>
      {/if}
    </h3>
    {#if labelData.issueCount > 0}
      <p class="issues-hint">Positions where a non-avoid line has only avoid children.</p>
    {/if}
  </div>

  <div class="results">
    {#if positions.length === 0}
      <p class="empty">No issues found.</p>
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
                <ComfortBadge level={pos.comfort} size={8} />
                <span class="result-count">{pos.moves} move(s)</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
      <p class="count">{positions.length} issue(s) found</p>
    {/if}
  </div>
</div>

<style>
  .issues-view {
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
  }
  .issues-bar {
    padding: 0.75rem; border-bottom: 1px solid var(--border);
    background: var(--surface1);
  }
  .issues-title {
    margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h);
    display: flex; align-items: center; gap: 0.375rem;
  }
  .issues-count {
    font-weight: 400; color: var(--muted); font-size: 0.875rem;
  }
  .issues-hint {
    margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--muted);
  }
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
  .empty { color: var(--muted); font-style: italic; font-size: 0.875rem; text-align: center; padding: 2rem; }
  .count { font-size: 0.75rem; color: var(--muted); text-align: center; margin: 0.5rem 0 0; }
</style>
