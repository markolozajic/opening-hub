<script lang="ts">
  import type { Position, ComfortLevel, Link, PgnAttachment, Repertoire } from '../types';
  import { nav } from '../state/navigation.svelte';
  import { setPositionName, setPositionComment, setComfortLevel, setForcedDraw, setPracticalDraw, addLink, removeLink, addPgnAttachment, removePgnAttachment, getPosition, updateLink } from '../db/positionStore.svelte';
  import { getNovelty, getOnlineNovelty } from '../state/novelty.svelte';
  import { invalidateComfortCache } from '../state/comfort.svelte';
  import { invalidateDrawCounts } from '../state/drawCounts.svelte';
  import { getOpponentNames, tagPosition, untagPosition, getDirectlyTaggedOpponents } from '../state/preparation.svelte';
  import { COMFORT_COLORS, COMFORT_LABELS } from '../constants';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import LinkList from './LinkList.svelte';
  import PgnAttachmentList from './PgnAttachmentList.svelte';
  import { untrack } from 'svelte';
  import { X, Check } from '@lucide/svelte';

  let {
    position = null as Position | null,
    onClose = undefined as (() => void) | undefined,
    moveToInsert = null as { san: string; fen: string } | null,
    onCursorFenChange = undefined as ((fen: string) => void) | undefined,
  } = $props();

  let name = $state('');
  let comment = $state('');
  let comfort = $state<ComfortLevel | undefined>(undefined);
  let forcedDraw = $state(false);
  let practicalDraw = $state(false);
  let previewMode = $state(false);
  let saving = $state(false);

  let tagOpponent = $state('');
  let taggableOpponents = $derived(position ? getOpponentNames() : []);
  let turn = $derived(position ? position.fen.split(' ')[1] as 'w' | 'b' || 'w' : 'w');
  let isOurTurn = $derived(
    position && ((nav.activeRepertoire === 'white' && turn === 'w') || (nav.activeRepertoire === 'black' && turn === 'b'))
  );
  let taggedAtPosition = $derived(
    position && isOurTurn
      ? getDirectlyTaggedOpponents(nav.activeRepertoire, position.fen)
          .map(p => ({ name: p }))
      : []
  );

  let isNovel = $derived(position ? getNovelty(nav.activeRepertoire, position.fen) : false);
  let isOnlineNovel = $derived(position ? getOnlineNovelty(nav.activeRepertoire, position.fen) : false);

  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let lastProcessedKey = '';
  const LINK_RE = /\[([^\]]*)\]\(opening:\/\/navigate\/([^)]+)\)/g;

  function parseCommentLinks(text: string): Array<{ start: number; end: number; fen: string }> {
    const links: Array<{ start: number; end: number; fen: string }> = [];
    for (const match of text.matchAll(LINK_RE)) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        fen: decodeURIComponent(match[2]),
      });
    }
    return links;
  }

  function getCursorFen(): string {
    if (!textareaRef || !position) return position?.fen ?? '';
    const cursor = textareaRef.selectionStart;
    const links = parseCommentLinks(comment);
    for (const link of links) {
      if (cursor >= link.start && cursor <= link.end) return link.fen;
    }
    return position.fen;
  }

  function handleTextareaCursorChange() {
    if (onCursorFenChange) {
      onCursorFenChange(getCursorFen());
    }
  }

  $effect(() => {
    const p = position;
    const data = untrack(() => p ? {
      name: p.name ?? '',
      comment: p.comment ?? '',
      comfort: p.comfortLevel,
      forcedDraw: p.forcedDraw ?? false,
      practicalDraw: p.practicalDraw ?? false,
    } : null);
    if (data) {
      name = data.name;
      comment = data.comment;
      comfort = data.comfort;
      forcedDraw = data.forcedDraw;
      practicalDraw = data.practicalDraw;
    }
  });

  $effect(() => {
    const m = moveToInsert;
    if (!m) return;
    const key = m.san + m.fen;
    if (key === lastProcessedKey) return;
    lastProcessedKey = key;
    const link = `[${m.san}](opening://navigate/${encodeURIComponent(m.fen)}) `;
    untrack(() => {
      if (textareaRef) {
        const start = textareaRef.selectionStart;
        const end = textareaRef.selectionEnd;
        comment = comment.slice(0, start) + link + comment.slice(end);
        requestAnimationFrame(() => {
          const pos = start + link.length;
          textareaRef?.setSelectionRange(pos, pos);
        });
      } else {
        comment += (comment ? '\n' : '') + link;
      }
    });
  });

  async function handleSave() {
    if (!position) return;

    saving = true;
    const r: Repertoire = position.repertoire;
    const f = position.fen;
    await setPositionName(r, f, name || undefined);
    await setPositionComment(r, f, comment || undefined);
    await setComfortLevel(r, f, comfort);
    invalidateComfortCache(r, f);
    await setForcedDraw(r, f, forcedDraw);
    await setPracticalDraw(r, f, practicalDraw);
    invalidateDrawCounts(r);
    saving = false;
    onClose?.();
  }

  async function handleTagPosition() {
    if (!position || !tagOpponent.trim()) return;
    await tagPosition(nav.activeRepertoire, position.fen, tagOpponent.trim());
    tagOpponent = '';
  }

  async function handleUntagPosition(opponentName: string) {
    if (!position) return;
    await untagPosition(nav.activeRepertoire, position.fen, opponentName);
  }

  async function handleAddLink(link: Link) {
    if (!position) return;
    await addLink(position.repertoire, position.fen, link);
  }

  async function handleRemoveLink(id: string) {
    if (!position) return;
    await removeLink(position.repertoire, position.fen, id);
  }

  async function handleEditLink(id: string, updates: Partial<Link>) {
    if (!position) return;
    await updateLink(position.repertoire, position.fen, id, updates);
  }

  async function handleAddPgn(att: PgnAttachment) {
    if (!position) return;
    await addPgnAttachment(position.repertoire, position.fen, att);
  }

  async function handleRemovePgn(id: string) {
    if (!position) return;
    await removePgnAttachment(position.repertoire, position.fen, id);
  }

  function handleCancel() {
    name = position?.name ?? '';
    comment = position?.comment ?? '';
    comfort = position?.comfortLevel;
    onClose?.();
  }
</script>

{#if position}
  <div class="editor">
    <div class="editor-header">
      <div class="editor-title-row">
        <h3 class="editor-title">Edit Position</h3>
        {#if isNovel}
          <span class="novelty-badge">N</span>
        {/if}
        {#if isOnlineNovel}
          <span class="online-novelty-badge">ON</span>
        {/if}
      </div>
      <div class="editor-actions">
        <button class="btn primary" onclick={handleSave} disabled={saving}>
          <Check size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button class="btn" onclick={handleCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>

    <div class="field">
      <span class="label">Name</span>
      <input
        bind:value={name}
        class="input"
        placeholder="e.g. Sicilian, Grand Prix, Left Hook"
      />
    </div>

    {#if isOurTurn}
      <div class="field">
        <span class="label">Tag position</span>
        <div class="tag-section">
          <div class="tag-row">
            <input
              bind:value={tagOpponent}
              class="input"
              placeholder="Player name…"
              list="tag-opponents"
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTagPosition(); } }}
            />
            <datalist id="tag-opponents">
              {#each taggableOpponents as p}
                <option value={p}></option>
              {/each}
            </datalist>
            <button class="btn" onclick={handleTagPosition} disabled={!tagOpponent.trim()}>Tag</button>
          </div>
          {#if taggedAtPosition.length > 0}
            <div class="tagged-list">
              {#each taggedAtPosition as entry}
                <div class="tagged-item">
                  <span class="tagged-name">{entry.name.includes(', ') ? entry.name.split(', ').reverse().join(' ') : entry.name}</span>
                  <button class="btn small-btn" onclick={() => handleUntagPosition(entry.name)}>Untag</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if Object.keys(position.moves).length === 0}
      <div class="field">
        <span class="label">Comfort Level</span>
        <div class="comfort-options">
          {#each ['easy', 'comfortable', 'moderate', 'uncomfortable', 'struggling'] as level}
            {@const isSelected = comfort === level}
            <button
              class="comfort-btn"
              class:selected={isSelected}
              style:border-color={COMFORT_COLORS[level]}
              style:background={isSelected ? COMFORT_COLORS[level] : 'transparent'}
              style:color={isSelected ? '#fff' : 'inherit'}
              onclick={() => comfort = isSelected ? undefined : level as ComfortLevel}
            >
              {COMFORT_LABELS[level]}
            </button>
          {/each}
          {#if comfort}
            <button class="clear-comfort" onclick={() => comfort = undefined}>Clear</button>
          {/if}
        </div>
      </div>
      <div class="field">
        <span class="label">Position Drawn?</span>
        <div class="comfort-options">
          <button
            class="comfort-btn"
            class:selected={forcedDraw}
            class:draw-selected={forcedDraw}
            onclick={() => { forcedDraw = !forcedDraw; practicalDraw = false; }}
          >
            By Force
          </button>
          <button
            class="comfort-btn"
            class:selected={practicalDraw}
            class:draw-selected={practicalDraw}
            onclick={() => { practicalDraw = !practicalDraw; forcedDraw = false; }}
          >
            Practically
          </button>
        </div>
      </div>
    {/if}

    <div class="field">
      <div class="label-row">
        <span class="label">Comment</span>
        <button class="preview-toggle" onclick={() => previewMode = !previewMode}>
          {previewMode ? 'Edit' : 'Preview'}
        </button>
      </div>
      {#if previewMode}
        <div class="preview-box">
          <MarkdownRenderer content={comment} />
        </div>
      {:else}
        <textarea
          bind:this={textareaRef}
          bind:value={comment}
          class="input comment-input"
          placeholder="Markdown supported. Use [text](url) for links."
          rows={8}
          onclick={handleTextareaCursorChange}
          onkeyup={handleTextareaCursorChange}
        ></textarea>
      {/if}
    </div>

    <div class="field">
      <span class="label">Links</span>
      <LinkList
        links={position.links}
        readonly={false}
        onAdd={handleAddLink}
        onRemove={handleRemoveLink}
        onEdit={handleEditLink}
        onAddPgn={({ pgn, url, label }) => handleAddPgn({ id: crypto.randomUUID(), pgn, label, url })}
      />
    </div>

    <div class="field">
      <span class="label">PGN Attachments</span>
      <PgnAttachmentList
        attachments={position.pgnAttachments}
        readonly={false}
        onAdd={handleAddPgn}
        onRemove={handleRemovePgn}
      />
    </div>
  </div>
{/if}

<style>
  .editor {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 0.75rem; overflow-y: auto;
  }
  .editor-header {
    display: flex; align-items: center; justify-content: space-between;
  }
  .editor-title-row { display: flex; align-items: center; gap: 0.5rem; }
  .editor-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-h); }
  .editor-actions { display: flex; gap: 0.375rem; }
  .novelty-badge {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.625rem; font-weight: 700; line-height: 1;
    color: #14b8a6; border: 1px solid #14b8a6; border-radius: 3px;
    padding: 1px 4px; letter-spacing: 0.02em;
  }
  .online-novelty-badge {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.625rem; font-weight: 700; line-height: 1;
    color: #2563eb; border: 1px solid #2563eb; border-radius: 3px;
    padding: 1px 4px; letter-spacing: 0.02em;
  }
  .field { display: flex; flex-direction: column; gap: 0.375rem; }
  .label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .label-row { display: flex; align-items: center; justify-content: space-between; }
  .preview-toggle {
    background: none; border: none; cursor: pointer; font-size: 0.75rem;
    color: var(--accent); padding: 0; font-family: inherit;
  }
  .preview-toggle:hover { text-decoration: underline; }
  .input {
    padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: 0.875rem; font-family: inherit;
    width: 100%; box-sizing: border-box;
  }
  .comment-input { resize: vertical; font-family: inherit; line-height: 1.5; }
  .preview-box {
    padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); min-height: 3rem;
  }
  .comfort-options { display: flex; gap: 0.375rem; align-items: center; }
  .comfort-btn {
    padding: 0.375rem 0.75rem; border: 2px solid; border-radius: 6px;
    cursor: pointer; font-size: 0.8125rem; font-weight: 500; font-family: inherit;
    transition: all 0.15s;
  }
  .comfort-btn:hover { opacity: 0.85; }
  .comfort-btn.draw-selected {
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);
  }
  .clear-comfort {
    background: none; border: none; cursor: pointer; font-size: 0.75rem;
    color: var(--muted); padding: 0.25rem; font-family: inherit;
  }
  .clear-comfort:hover { color: var(--danger); }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: 0.8125rem;
    display: inline-flex; align-items: center; gap: 0.25rem; font-family: inherit;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .tag-section { display: flex; flex-direction: column; gap: 0.375rem; }
  .tag-row { display: flex; gap: 0.25rem; }
  .tag-row .input { flex: 1; padding: 0.375rem; font-size: 0.8125rem; }
  .tagged-list { display: flex; flex-direction: column; gap: 0.25rem; }
  .tagged-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.25rem 0.375rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); font-size: 0.8125rem;
  }
  .tagged-name { color: var(--text-h); font-weight: 500; }
  .small-btn {
    padding: 0.125rem 0.5rem; border: 1px solid var(--border); border-radius: 3px;
    background: var(--surface2); color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.75rem;
  }
  .small-btn:hover { color: var(--danger); border-color: var(--danger); }
</style>
