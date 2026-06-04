<script lang="ts">
  import type { Position } from '../types';
  import { nav } from '../state/navigation.svelte';
  import { getSideLabel } from '../utils/fen';
  import { getComfort } from '../state/comfort.svelte';
  import ComfortBadge from './ComfortBadge.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import LinkList from './LinkList.svelte';
  import PgnAttachmentList from './PgnAttachmentList.svelte';
  import { Pencil } from '@lucide/svelte';

  let {
    position = null as Position | null,
    onEdit = undefined as (() => void) | undefined,
  } = $props();

  let fen = $derived(position?.fen ?? '');
  let comfort = $derived(fen ? getComfort(nav.activeRepertoire, fen) : null);
  let turn = $derived(position ? getSideLabel(position.fen.split(' ')[1] as 'w' | 'b' || 'w') : '');
</script>

{#if position}
  <div class="position-display">
    <div class="header">
      <div class="title-row">
        {#if position.name}
          <h2 class="name">{position.name}</h2>
        {/if}
        <button class="btn-icon edit-btn" onclick={() => onEdit?.()} title="Edit position">
          <Pencil size={14} />
        </button>
      </div>
      <div class="meta">
        <ComfortBadge level={comfort} size={10} />
        <span class="comfort-label">{comfort ?? 'Unrated'}</span>
        <span class="sep">·</span>
        <span class="turn">{turn}</span>
      </div>
    </div>

    {#if position.comment}
      <div class="section">
        <h3 class="section-title">Notes</h3>
        <MarkdownRenderer content={position.comment} />
      </div>
    {/if}

    {#if position.links.length > 0}
      <div class="section">
        <h3 class="section-title">Links ({position.links.length})</h3>
        <LinkList links={position.links} readonly />
      </div>
    {/if}

    {#if position.pgnAttachments.length > 0}
      <div class="section">
        <h3 class="section-title">Games ({position.pgnAttachments.length})</h3>
        <PgnAttachmentList attachments={position.pgnAttachments} readonly />
      </div>
    {/if}

    {#if !position.comment && position.links.length === 0 && position.pgnAttachments.length === 0}
      <p class="empty">Click edit to add notes, links, and games.</p>
    {/if}
  </div>
{/if}

<style>
  .position-display {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem; overflow-y: auto;
  }
  .header { display: flex; flex-direction: column; gap: 0.25rem; }
  .title-row { display: flex; align-items: center; gap: 0.5rem; }
  .name { margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text-h); }
  .edit-btn { margin-left: auto; }
  .meta { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--text); }
  .comfort-label { text-transform: capitalize; }
  .sep { color: var(--border); }
  .turn { font-style: italic; }
  .section { display: flex; flex-direction: column; gap: 0.375rem; }
  .section-title {
    margin: 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--muted);
  }
  .empty { color: var(--muted); font-style: italic; font-size: 0.8125rem; }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 0.25rem;
    color: var(--muted); border-radius: 4px; display: flex;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
</style>
