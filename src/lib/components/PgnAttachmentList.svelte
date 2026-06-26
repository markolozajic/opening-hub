<script lang="ts">
  import type { PgnAttachment } from '../types';
  import { Chess } from 'chess.js';
  import { openPgnView } from '../state/pgnView.svelte';
  import { FileText, ExternalLink, Trash2, Plus, ChevronDown, ChevronUp, Eye } from '@lucide/svelte';

  let {
    attachments = [] as PgnAttachment[],
    readonly = false,
    onAdd = (_a: PgnAttachment) => {},
    onRemove = (_id: string) => {},
  } = $props();

  let showForm = $state(false);
  let label = $state('');
  let pgnText = $state('');
  let expanded = $state<Record<string, boolean>>({});

  function fmt(v: string): string {
    return v && v !== '?' && v !== '*' && v !== '????.??.??' && v !== '-' ? v : '';
  }

  function extractYear(text: string): string | null {
    const m = text.match(/(\d{4})/);
    return m ? m[1] : null;
  }

  function buildLabel(white: string, black: string, result: string, event: string, date: string): string {
    const parts: string[] = [];

    if (fmt(white) && fmt(black)) {
      let players = `${white} vs ${black}`;
      if (fmt(result)) players += `, ${result}`;
      parts.push(players);
    }

    const eventYear = event ? extractYear(event) : null;
    const dateYear = date && date !== '?' && date !== '????.??.??' ? date.substring(0, 4) : '';
    const year = eventYear || fmt(dateYear) || '';
    const cleanEvent = eventYear ? event.replace(/\s*\d{4}\s*$/, '').trim() : (fmt(event) || '');

    const eventParts: string[] = [];
    if (cleanEvent) eventParts.push(cleanEvent);
    if (year) eventParts.push(year);
    if (eventParts.length > 0) parts.push(eventParts.join(', '));

    return parts.length > 0 ? parts.join(' · ') : 'Game';
  }

  function getLabelFromPgn(pgn: string): string {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const headers = chess.getHeaders();
      return buildLabel(
        headers['White'] || '',
        headers['Black'] || '',
        headers['Result'] || '',
        headers['Event'] || '',
        headers['Date'] || '',
      );
    } catch {
      return 'Game';
    }
  }

  function handleAdd() {
    if (!pgnText.trim()) return;
    const defaultLabel = getLabelFromPgn(pgnText.trim());
    onAdd({ id: crypto.randomUUID(), pgn: pgnText.trim(), label: label.trim() || defaultLabel });
    label = '';
    pgnText = '';
    showForm = false;
  }

  function toggleExpand(id: string, pgn: string) {
    if (readonly) {
      openPgnView(pgn);
    } else {
      expanded[id] = !expanded[id];
    }
  }
</script>

<div class="pgn-list">
  {#if attachments.length > 0}
    <div class="items">
      {#each attachments as att}
        <div class="att-item">
          <div class="att-header">
            <button class="expand-btn" onclick={() => toggleExpand(att.id, att.pgn)}>
              {#if readonly}
                <Eye size={12} />
              {:else if expanded[att.id]}
                <ChevronUp size={12} />
              {:else}
                <ChevronDown size={12} />
              {/if}
            </button>
            <FileText size={14} class="att-icon" />
            <span class="att-label">{att.label}</span>
            {#if att.url}
              <a href={att.url} target="_blank" rel="noopener noreferrer" class="btn-icon link-btn" title="Open on Lichess">
                <ExternalLink size={12} />
              </a>
            {/if}
            {#if !readonly}
              <button class="btn-icon" onclick={() => onRemove(att.id)} title="Remove">
                <Trash2 size={12} />
              </button>
            {/if}
          </div>
          {#if !readonly && expanded[att.id]}
            <pre class="pgn-content">{att.pgn}</pre>
          {/if}
        </div>
      {/each}
    </div>
  {:else if readonly}
    <p class="empty">No PGN attachments</p>
  {/if}

  {#if !readonly}
    {#if showForm}
      <div class="add-form">
        <input bind:value={label} placeholder="Label (optional)" class="input" />
        <textarea
          bind:value={pgnText}
          placeholder="Paste PGN here..."
          class="input textarea"
          rows={4}
        ></textarea>
        <div class="form-actions">
          <button class="btn primary" onclick={handleAdd}>Add</button>
          <button class="btn" onclick={() => showForm = false}>Cancel</button>
        </div>
      </div>
    {:else}
      <button class="btn add-btn" onclick={() => showForm = true}>
        <Plus size={12} /> PGN
      </button>
    {/if}
  {/if}
</div>

<style>
  .pgn-list { font-size: 0.8125rem; }
  .items { display: flex; flex-direction: column; gap: 0.25rem; }
  .att-item { border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
  .att-header {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.375rem; background: var(--surface1);
  }
:global(.att-icon) { flex-shrink: 0; color: var(--accent); }
  .att-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expand-btn {
    background: none; border: none; cursor: pointer; padding: 1px;
    display: flex; color: var(--muted); border-radius: 3px;
  }
  .expand-btn:hover { color: var(--text-h); }
  .pgn-content {
    margin: 0; padding: 0.5rem; font-size: 0.75rem; line-height: 1.4;
    white-space: pre-wrap; word-break: break-all;
    background: var(--code-bg); color: var(--text); border-top: 1px solid var(--border);
    max-height: 150px; overflow-y: auto;
  }
  .empty { color: var(--muted); font-style: italic; }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 2px;
    color: var(--muted); border-radius: 3px; flex-shrink: 0;
  }
  .btn-icon:hover { color: var(--danger); background: var(--surface2); }
  .link-btn { display: inline-flex; align-items: center; padding: 2px; }
  .link-btn:hover { color: var(--accent); background: var(--surface2); }
  .add-form { display: flex; flex-direction: column; gap: 0.375rem; margin-top: 0.5rem; }
  .form-actions { display: flex; gap: 0.375rem; }
  .add-btn { margin-top: 0.375rem; }
  .input {
    padding: 0.375rem 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: inherit; font-family: inherit;
  }
  .textarea { resize: vertical; font-family: var(--mono); }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: inherit;
    display: inline-flex; align-items: center; gap: 0.25rem;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
</style>
