<script lang="ts">
  import { syncState, getGistCredentials, setGistCredentials, clearGistCredentials, createGist, mergeAndSync } from '../state/gistSync.svelte';
  import { Cog, RefreshCw, Link, Plus, Trash2, X, Check, AlertTriangle } from '@lucide/svelte';

  let {
    onClose = undefined as (() => void) | undefined,
  } = $props();

  let token = $state('');
  let gistId = $state('');
  let status = $state<string>('');
  let hasToken = $derived(!!getGistCredentials());
  let creds = $derived(getGistCredentials());

  function handleSaveToken() {
    if (!token.trim()) return;
    status = 'saving';
    if (creds) {
      setGistCredentials(token.trim(), creds.gistId);
    } else {
      setGistCredentials(token.trim(), '');
    }
    token = '';
    status = 'token-saved';
  }

  async function handleCreateGist() {
    status = 'creating';
    try {
      const json = JSON.stringify({ positions: [], preparation: [] });
      const newId = await createGist();
      setGistCredentials(getGistCredentials()!.token, newId);
      status = 'created';
    } catch (e) {
      status = 'error';
    }
  }

  function handleLinkGist() {
    if (!gistId.trim() || !creds) return;
    setGistCredentials(creds.token, gistId.trim());
    gistId = '';
    status = 'linked';
  }

  function handleClear() {
    clearGistCredentials();
    status = '';
  }

  async function handleSyncNow() {
    status = 'syncing';
    await mergeAndSync();
    status = syncState.error ? 'error' : 'synced';
  }
</script>

<div class="settings-panel">
  <div class="panel-header">
    <h3 class="panel-title">Settings</h3>
    <button class="btn-icon" onclick={() => onClose?.()}>
      <X size={14} />
    </button>
  </div>

  <div class="section">
    <h4 class="section-title">GitHub Gist Sync</h4>
    <p class="section-desc">
      Store your repertoire in a private GitHub Gist so you can access it from any machine.
      Generate a token with <code>gist</code> scope at
      <a href="https://github.com/settings/tokens/new?scopes=gist&description=Opening%20Hub" target="_blank" rel="noopener noreferrer">github.com/settings/tokens</a>.
    </p>

    {#if !creds}
      <div class="field">
        <input bind:value={token} type="password" placeholder="GitHub personal access token" class="input" />
        <button class="btn primary" onclick={handleSaveToken} disabled={!token.trim()}>
          <Check size={13} /> Save Token
        </button>
      </div>
    {:else}
      <div class="info-row">
        <span class="info-label">Token:</span>
        <code class="info-value">saved ({creds.token.slice(0, 4)}…{creds.token.slice(-4)})</code>
        <button class="btn-text" onclick={() => { token = creds.token; }}>Update</button>
      </div>

      {#if !creds.gistId}
        <p class="hint">Link an existing Gist or create a new one.</p>
        <div class="field">
          <input bind:value={gistId} placeholder="Gist ID (e.g. abc123def456)" class="input" />
          <button class="btn" onclick={handleLinkGist} disabled={!gistId.trim()}>
            <Link size={13} /> Link Gist
          </button>
        </div>
        <button class="btn primary" onclick={handleCreateGist}>
          <Plus size={13} /> Create New Gist
        </button>
      {:else}
        <div class="info-row">
          <span class="info-label">Gist:</span>
          <code class="info-value">{creds.gistId}</code>
          <a href="https://gist.github.com/{creds.gistId}" target="_blank" rel="noopener noreferrer" class="btn-text">Open</a>
        </div>

        <div class="sync-actions">
          <button class="btn primary" onclick={handleSyncNow} disabled={syncState.syncing}>
              <RefreshCw size={13} class={syncState.syncing ? 'spinning' : ''} /> {syncState.syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button class="btn danger" onclick={handleClear}>
            <Trash2 size={13} /> Clear Credentials
          </button>
        </div>

        {#if syncState.lastSync}
          <p class="sync-info">Last sync: {syncState.lastSync}</p>
        {/if}
        {#if syncState.error}
          <div class="error-box">
            <AlertTriangle size={13} /> {syncState.error}
          </div>
        {/if}
      {/if}
    {/if}

    {#if status === 'creating'}
      <p class="status">Creating Gist…</p>
    {:else if status === 'syncing'}
      <p class="status">Syncing…</p>
    {:else if status === 'synced'}
      <p class="status success">Synced successfully.</p>
    {:else if status === 'error'}
      <p class="status error">Sync failed. See error above.</p>
    {:else if status === 'created'}
      <p class="status success">Gist created and linked.</p>
    {:else if status === 'linked'}
      <p class="status success">Gist linked.</p>
    {:else if status === 'token-saved'}
      <p class="status success">Token saved.</p>
    {/if}
  </div>
</div>

<style>
  .settings-panel {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h); }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .section-title { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text); }
  .section-desc { margin: 0; font-size: 0.75rem; color: var(--muted); line-height: 1.5; }
  .section-desc a { color: var(--accent); }
  .section-desc code { font-size: 0.6875rem; background: var(--surface2); padding: 1px 4px; border-radius: 3px; }
  .field { display: flex; gap: 0.375rem; }
  .input {
    flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.875rem; font-family: inherit;
    box-sizing: border-box;
  }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: 0.8125rem;
    display: inline-flex; align-items: center; gap: 0.25rem; font-family: inherit;
    white-space: nowrap;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
  .btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.danger { color: var(--danger); border-color: var(--danger); }
  .btn.danger:hover { background: var(--danger); color: #fff; }
  .btn-text {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--accent); font-size: 0.8125rem; font-family: inherit; text-decoration: none;
  }
  .btn-text:hover { text-decoration: underline; }
  .info-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; }
  .info-label { color: var(--muted); white-space: nowrap; }
  .info-value { color: var(--text); word-break: break-all; }
  .hint { margin: 0; font-size: 0.75rem; color: var(--muted); font-style: italic; }
  .sync-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .sync-info { margin: 0; font-size: 0.75rem; color: var(--muted); }
  .error-box {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem; border-radius: 4px; background: #fef2f2;
    color: var(--danger); font-size: 0.75rem; border: 1px solid var(--danger);
  }
  .status { margin: 0; font-size: 0.75rem; color: var(--muted); font-style: italic; }
  .status.success { color: #16a34a; }
  .status.error { color: var(--danger); }
  :global(.spinning) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
