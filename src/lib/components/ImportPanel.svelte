<script lang="ts">
  import { nav } from '../state/navigation.svelte';
  import { importPgn } from '../utils/pgn';
  import { importPositionsJson } from '../db/positionStore.svelte';
  import { invalidateComfortCache } from '../state/comfort.svelte';
  import { Upload, FileText, Code, X } from '@lucide/svelte';

  let {
    onComplete = undefined as (() => void) | undefined,
    onClose = undefined as (() => void) | undefined,
  } = $props();

  let importMode = $state<'pgn' | 'json'>('pgn');
  let pgnText = $state('');
  let jsonText = $state('');
  let status = $state<'idle' | 'importing' | 'done' | 'error'>('idle');
  let message = $state('');
  let count = $state(0);

  async function handleImportPgn() {
    if (!pgnText.trim()) return;
    status = 'importing';
    try {
      count = await importPgn(nav.activeRepertoire, pgnText);
      invalidateComfortCache();
      status = 'done';
      message = `Imported ${count} move(s).`;
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Import failed';
    }
  }

  async function handleImportJson() {
    if (!jsonText.trim()) return;
    status = 'importing';
    try {
      await importPositionsJson(jsonText);
      invalidateComfortCache();
      status = 'done';
      message = 'JSON data imported successfully.';
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Import failed';
    }
  }

  function handlePgnFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pgnText = reader.result as string;
    };
    reader.readAsText(file);
  }

  function handleJsonFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonText = reader.result as string;
    };
    reader.readAsText(file);
  }

  function handleDone() {
    pgnText = '';
    jsonText = '';
    status = 'idle';
    message = '';
    onComplete?.();
  }
</script>

<div class="import-panel">
  <div class="panel-header">
    <h3 class="panel-title">Import</h3>
    <button class="btn-icon" onclick={() => onClose?.()}>
      <X size={14} />
    </button>
  </div>

  {#if status === 'done'}
    <div class="done">
      <p class="success">{message}</p>
      <button class="btn primary" onclick={handleDone}>Continue</button>
    </div>
  {:else}
    <div class="mode-tabs">
      <button class="mode-tab" class:active={importMode === 'pgn'} onclick={() => importMode = 'pgn'}>
        <FileText size={14} /> PGN
      </button>
      <button class="mode-tab" class:active={importMode === 'json'} onclick={() => importMode = 'json'}>
        <Code size={14} /> JSON
      </button>
    </div>

    {#if importMode === 'pgn'}
      <div class="file-upload">
        <label class="file-label">
          <Upload size={14} />
          Choose .pgn file
          <input type="file" accept=".pgn,.txt" onchange={handlePgnFileUpload} class="file-input" />
        </label>
        <span class="or">or paste below</span>
      </div>

      <textarea
        bind:value={pgnText}
        class="code-input"
        placeholder="Paste PGN here..."
        rows={10}
      ></textarea>
    {:else}
      <div class="file-upload">
        <label class="file-label">
          <Upload size={14} />
          Choose .json file
          <input type="file" accept=".json" onchange={handleJsonFileUpload} class="file-input" />
        </label>
        <span class="or">or paste below</span>
      </div>

      <textarea
        bind:value={jsonText}
        class="code-input"
        placeholder="Paste JSON here..."
        rows={10}
      ></textarea>
    {/if}

    {#if status === 'error'}
      <p class="error">{message}</p>
    {/if}

    <div class="actions">
      <button
        class="btn primary"
        onclick={importMode === 'pgn' ? handleImportPgn : handleImportJson}
        disabled={status === 'importing' || (importMode === 'pgn' ? !pgnText.trim() : !jsonText.trim())}
      >
        {#if importMode === 'pgn'}
          <FileText size={14} />
        {:else}
          <Code size={14} />
        {/if}
        {status === 'importing' ? 'Importing…' : 'Import'}
      </button>
    </div>
  {/if}
</div>

<style>
  .import-panel {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem; height: 100%; box-sizing: border-box;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h); }
  .mode-tabs { display: flex; gap: 0.25rem; }
  .mode-tab {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--muted); cursor: pointer;
    font-size: 0.8125rem; font-family: inherit; transition: all 0.15s;
  }
  .mode-tab:hover { color: var(--text-h); background: var(--surface2); }
  .mode-tab.active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
  .file-upload { display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
  .file-label {
    display: inline-flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 1rem; border: 2px dashed var(--border); border-radius: 6px;
    cursor: pointer; font-size: 0.875rem; color: var(--text); transition: border-color 0.15s;
  }
  .file-label:hover { border-color: var(--accent); }
  .file-input { display: none; }
  .or { font-size: 0.8125rem; color: var(--muted); }
  .code-input {
    flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.8125rem;
    font-family: var(--mono); resize: vertical; line-height: 1.5;
  }
  .actions { display: flex; gap: 0.5rem; }
  .btn {
    padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: 0.875rem;
    display: inline-flex; align-items: center; gap: 0.375rem; font-family: inherit;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
  .done { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 2rem; }
  .success { color: var(--success, #22c55e); font-size: 1rem; margin: 0; }
  .error { color: var(--danger, #ef4444); font-size: 0.875rem; margin: 0; }
</style>
