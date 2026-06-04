<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { exportPositionsJson } from '../db/positionStore.svelte';
  import { exportMainlinePgn } from '../utils/pgn';
  import { downloadFile } from '../utils/dom';
  import { Download, FileText, Code, X } from '@lucide/svelte';

  let {
    onClose = undefined as (() => void) | undefined,
  } = $props();

  let status = $state<string>('');

  async function handleExportPgn() {
    status = 'exporting-pgn';
    const pgn = exportMainlinePgn(nav.activeRepertoire);
    downloadFile(pgn, 'repertoire.pgn', 'text/plain');
    status = '';
  }

  async function handleExportJson() {
    status = 'exporting-json';
    const json = await exportPositionsJson(nav.activeRepertoire);
    downloadFile(json, 'repertoire.json', 'application/json');
    status = '';
  }
</script>

<div class="export-panel">
  <div class="panel-header">
    <h3 class="panel-title">Export</h3>
    <button class="btn-icon" onclick={() => onClose?.()}>
      <X size={14} />
    </button>
  </div>

  <div class="export-options">
    <button class="export-card" onclick={handleExportPgn} disabled={status !== ''}>
      <FileText size={24} />
      <div class="export-info">
        <span class="export-name">PGN</span>
        <span class="export-desc">Main line as a single PGN game</span>
      </div>
      <Download size={16} class="export-icon" />
    </button>

    <button class="export-card" onclick={handleExportJson} disabled={status !== ''}>
      <Code size={24} />
      <div class="export-info">
        <span class="export-name">JSON Backup</span>
        <span class="export-desc">Complete repertoire data (all positions)</span>
      </div>
      <Download size={16} class="export-icon" />
    </button>
  </div>

  {#if status}
    <p class="status">Exporting…</p>
  {/if}
</div>

<style>
  .export-panel {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h); }
  .export-options { display: flex; flex-direction: column; gap: 0.5rem; }
  .export-card {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px;
    background: var(--surface1); cursor: pointer; text-align: left;
    transition: all 0.15s; font-family: inherit; width: 100%; box-sizing: border-box;
  }
  .export-card:hover { border-color: var(--accent); }
  .export-card:disabled { opacity: 0.5; cursor: not-allowed; }
  .export-info { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; }
  .export-name { font-weight: 600; font-size: 0.9375rem; color: var(--text-h); }
  .export-desc { font-size: 0.75rem; color: var(--muted); }
  :global(.export-icon) { flex-shrink: 0; color: var(--accent); }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
  .status { font-size: 0.875rem; color: var(--muted); text-align: center; }
</style>
