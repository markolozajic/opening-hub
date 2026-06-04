<script lang="ts">
  import { nav, canGoBack, navigateToRoot, goBack, goForward, switchRepertoire } from '../state/navigation.svelte';
  import { getPosition } from '../db/positionStore.svelte';
  import { ArrowLeft, ArrowRight, Home } from '@lucide/svelte';

  let currentPos = $derived(getPosition(nav.activeRepertoire, nav.currentFen));
  let moveCount = $derived(currentPos ? Object.keys(currentPos.moves).length : 0);
</script>

<nav class="nav-bar">
  <div class="nav-left">
    <button class="tab" class:active={nav.activeRepertoire === 'white'} onclick={() => switchRepertoire('white')}>
      White
    </button>
    <button class="tab" class:active={nav.activeRepertoire === 'black'} onclick={() => switchRepertoire('black')}>
      Black
    </button>
  </div>

  <div class="nav-center">
    <button class="nav-btn" onclick={goBack} disabled={!canGoBack()} title="Back (←)">
      <ArrowLeft size={16} />
    </button>
    <button class="nav-btn" onclick={navigateToRoot} title="Home">
      <Home size={16} />
    </button>
    <button class="nav-btn" onclick={goForward} disabled={moveCount === 0} title="Forward (→)">
      {#if moveCount > 1}
        <span class="count-badge">{moveCount}</span>
      {/if}
      <ArrowRight size={16} />
    </button>
  </div>

  <div class="nav-right">
    <span class="pos-label">{currentPos?.name || 'Current position'}</span>
  </div>
</nav>

<style>
  .nav-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.375rem 0.75rem; background: var(--surface1);
    border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 0.5rem;
  }
  .nav-left { display: flex; gap: 0.125rem; }
  .tab {
    padding: 0.25rem 0.75rem; border: 1px solid transparent; border-radius: 4px;
    background: none; color: var(--text); cursor: pointer;
    font-size: 0.8125rem; font-weight: 500; font-family: inherit;
  }
  .tab:hover { background: var(--surface2); }
  .tab.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
  .nav-center { display: flex; align-items: center; gap: 0.125rem; }
  .nav-btn {
    position: relative; display: flex; align-items: center; justify-content: center;
    padding: 0.375rem; border: 1px solid transparent; border-radius: 4px;
    background: none; color: var(--text); cursor: pointer;
  }
  .nav-btn:hover:not(:disabled) { background: var(--surface2); color: var(--text-h); }
  .nav-btn:disabled { opacity: 0.3; cursor: default; }
  .count-badge {
    position: absolute; top: -2px; right: -2px;
    background: var(--accent); color: #fff; font-size: 0.625rem;
    width: 14px; height: 14px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
  }
  .nav-right { overflow: hidden; }
  .pos-label {
    font-size: 0.75rem; color: var(--muted); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; max-width: 200px;
  }
</style>
