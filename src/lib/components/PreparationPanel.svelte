<script lang="ts">
  import { getPlayers, selectPlayer, prepState, purgePlayer, formatPlayerName, addPlayer } from '../state/preparation.svelte';
  import { nav } from '../state/navigation.svelte';
  import { Plus, Trash2, X } from '@lucide/svelte';

  let input = $state('');
  let showDropdown = $state(false);
  let inputRef = $state<HTMLInputElement | null>(null);

  let allPlayers = $derived(getPlayers());
  let matches = $derived(
    input.trim()
      ? allPlayers.filter(p => p.toLowerCase().includes(input.trim().toLowerCase()))
      : allPlayers
  );

  function handleFocus() {
    showDropdown = true;
  }

  function handleInput() {
    showDropdown = true;
  }

  function handleBlur() {
    setTimeout(() => { showDropdown = false; }, 150);
  }

  function handleSelect(name: string) {
    selectPlayer(name);
    input = '';
    showDropdown = false;
    inputRef?.blur();
  }

  async function handleAddOrSelect() {
    const q = input.trim();
    if (!q) return;
    const exact = allPlayers.find(p => p.toLowerCase() === q.toLowerCase());
    if (exact) {
      handleSelect(exact);
    } else {
      await addPlayer(nav.activeRepertoire, q);
      input = '';
      showDropdown = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleAddOrSelect();
  }

  async function handleRemovePlayer(name: string) {
    if (confirm(`Permanently remove ${name} from the repertoire? All tagged paths will be deleted.`)) {
      await purgePlayer(nav.activeRepertoire, name);
    }
  }
</script>

<div class="prep-panel">
  <h3 class="panel-title">Preparation</h3>

  <div class="search-area">
    <div class="search-row">
      <input
        bind:this={inputRef}
        bind:value={input}
        oninput={handleInput}
        onkeydown={handleKeyDown}
        onblur={handleBlur}
        onfocus={handleFocus}
        class="input"
        placeholder="Search or add player…"
      />
      <button class="btn add-btn" onclick={handleAddOrSelect} disabled={!input.trim()}>
        <Plus size={14} />
      </button>
    </div>
    {#if showDropdown}
      <div class="dropdown">
        {#if matches.length > 0}
          {#each matches as player}
            <button
              class="drop-item"
              class:selected={prepState.selectedPlayer === player}
              onclick={() => handleSelect(player)}
            >
              <span class="drop-name">{player}</span>
              {#if prepState.selectedPlayer === player}
                <span class="drop-badge">filtering</span>
              {/if}
            </button>
          {/each}
        {:else if input.trim()}
          <div class="drop-empty">No players found. Press Enter or click + to add.</div>
        {:else}
          <div class="drop-empty">No players found.</div>
        {/if}
      </div>
    {/if}
  </div>

  {#if prepState.selectedPlayer}
    <div class="filter-bar">
      <span class="filter-label">Filtering by <strong>{formatPlayerName(prepState.selectedPlayer)}</strong></span>
      <div class="filter-actions">
        <button class="btn icon-btn" onclick={() => handleRemovePlayer(prepState.selectedPlayer!)} title="Remove player">
          <Trash2 size={13} />
        </button>
        <button class="btn icon-btn" onclick={() => { selectPlayer(null); input = ''; }} title="Clear filter">
          <X size={13} />
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .prep-panel {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem; overflow: visible;
  }
  .panel-title {
    margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h);
  }
  .search-area {
    position: relative;
  }
  .search-row {
    display: flex; gap: 0.375rem;
  }
  .input {
    flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.875rem; font-family: inherit;
    box-sizing: border-box;
  }
  .add-btn { background: var(--accent); color: #fff; border-color: var(--accent); }
  .add-btn:hover { opacity: 0.9; }
  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .dropdown {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
    margin-top: 2px; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-height: 200px; overflow-y: auto;
  }
  .drop-item {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 0.5rem; border: none; background: none;
    cursor: pointer; font-family: inherit; font-size: 0.875rem; color: var(--text-h);
    text-align: left;
  }
  .drop-item:hover { background: var(--surface2); }
  .drop-item.selected { background: var(--accent-bg); }
  .drop-name { font-weight: 500; }
  .drop-badge {
    font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--accent); border: 1px solid var(--accent); border-radius: 3px;
    padding: 1px 5px;
  }
  .drop-empty {
    padding: 0.75rem; font-size: 0.8125rem; color: var(--muted); font-style: italic; text-align: center;
  }
  .filter-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem; border-radius: 4px; background: var(--accent-bg);
    border: 1px solid var(--accent);
  }
  .filter-label { font-size: 0.8125rem; color: var(--accent); }
  .filter-actions { display: flex; gap: 0.25rem; }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: 0.8125rem;
    display: inline-flex; align-items: center; gap: 0.25rem; font-family: inherit;
  }
  .btn:hover { background: var(--surface2); }
  .icon-btn {
    padding: 0.25rem; border: 1px solid var(--border); border-radius: 4px;
    color: var(--muted); background: transparent;
  }
  .icon-btn:hover { color: var(--danger); border-color: var(--danger); }
  .icon-btn:last-child:hover { color: var(--text-h); border-color: var(--border); }
</style>
