<script lang="ts">
  import type { Link } from '../types';
  import { Chess } from 'chess.js';
  import { Film, Globe, Sword, Trash2, Plus, Pencil } from '@lucide/svelte';
  import { parseYouTubeUrl } from '../utils/youtube';
  import { parseLichessUrl, fetchLichessPgn } from '../utils/lichess';

  let {
    links = [] as Link[],
    readonly = false,
    onAdd = (_link: Link) => {},
    onRemove = (_id: string) => {},
    onEdit = (_id: string, _updates: Partial<Link>) => {},
    onAddPgn = (_data: { pgn: string; url: string; label: string }) => {},
  } = $props();

  let showForm = $state(false);
  let url = $state('');
  let label = $state('');
  let type = $state<'youtube' | 'other' | 'lichess'>('other');
  let fetchingTitle = $state(false);
  let fetchedPgn = $state<string | null>(null);
  let lichessFetchTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  let editingId = $state<string | null>(null);
  let editUrl = $state('');
  let editLabel = $state('');
  let editType = $state<'youtube' | 'other' | 'lichess'>('other');
  let editFetchingTitle = $state(false);

  const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;

  async function fetchYouTubeTitle(videoUrl: string): Promise<string | null> {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.title ?? null;
    } catch {
      return null;
    }
  }

  function extractPgnLabel(pgn: string): string {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const h = chess.getHeaders();
      const ok = (v: string) => v && v !== '?' && v !== '*' && v !== '????.??.??' && v !== '-';
      const parts: string[] = [];
      if (ok(h['White']) && ok(h['Black'])) {
        let p = `${h['White']} vs ${h['Black']}`;
        if (ok(h['Result'])) p += `, ${h['Result']}`;
        parts.push(p);
      }
      const year = h['Event']?.match(/(\d{4})/)?.[1] || (ok(h['Date']) ? h['Date'].substring(0, 4) : '');
      const cleanEvent = h['Event']?.replace(/\s*\d{4}\s*$/, '').trim() || '';
      if (cleanEvent || year) parts.push([cleanEvent, year].filter(Boolean).join(', '));
      return parts.length > 0 ? parts.join(' · ') : 'Lichess Game';
    } catch {
      return 'Lichess Game';
    }
  }

  async function fetchLichessFromUrl(currentUrl: string, setLabel: (v: string) => void, setIsFetching: (v: boolean) => void) {
    const gameId = parseLichessUrl(currentUrl);
    if (!gameId) {
      fetchedPgn = null;
      return;
    }
    setIsFetching(true);
    try {
      const pgn = await fetchLichessPgn(gameId);
      fetchedPgn = pgn;
      setLabel(extractPgnLabel(pgn));
    } catch {
      fetchedPgn = null;
    }
    setIsFetching(false);
  }

  async function handleTypeChange(newType: string, currentUrl: string, currentLabel: string, setIsFetching: (v: boolean) => void, setLabel: (v: string) => void) {
    if (newType === 'youtube' && YOUTUBE_RE.test(currentUrl) && !currentLabel.trim()) {
      setIsFetching(true);
      const title = await fetchYouTubeTitle(currentUrl);
      if (title) setLabel(title);
      setIsFetching(false);
    }
    if (newType === 'lichess' && !currentLabel.trim()) {
      await fetchLichessFromUrl(currentUrl, setLabel, setIsFetching);
    }
  }

  function handleUrlChange(currentUrl: string, setLabel: (v: string) => void, setIsFetching: (v: boolean) => void) {
    if (lichessFetchTimeout) clearTimeout(lichessFetchTimeout);
    lichessFetchTimeout = setTimeout(async () => {
      await fetchLichessFromUrl(currentUrl, setLabel, setIsFetching);
    }, 500);
  }

  function handleAdd() {
    if (!url.trim()) return;
    const link: Link = { id: crypto.randomUUID(), url: url.trim(), label: label.trim() || url.trim(), type };
    onAdd(link);
    if (type === 'lichess' && fetchedPgn) {
      onAddPgn({ pgn: fetchedPgn, url: url.trim(), label: label.trim() || url.trim() });
    }
    url = '';
    label = '';
    type = 'other';
    fetchedPgn = null;
    showForm = false;
  }

  function startEdit(link: Link) {
    editingId = link.id;
    editUrl = link.url;
    editLabel = link.label;
    editType = link.type;
  }

  function cancelEdit() {
    editingId = null;
    editUrl = '';
    editLabel = '';
    editType = 'other';
  }

  function handleSaveEdit(link: Link) {
    if (!editUrl.trim()) return;
    onEdit(link.id, { url: editUrl.trim(), label: editLabel.trim() || editUrl.trim(), type: editType });
    cancelEdit();
  }
</script>

<div class="link-list">
  {#if links.length > 0}
    <div class="items">
      {#each links as link}
        {#if editingId === link.id}
          <div class="edit-form">
            <input bind:value={editUrl} placeholder="URL" class="input" type="url" oninput={() => editType === 'lichess' && handleUrlChange(editUrl, v => editLabel = v, v => editFetchingTitle = v)} />
            <input bind:value={editLabel} placeholder="Label (optional)" class="input" />
            <select bind:value={editType} class="input" onchange={() => handleTypeChange(editType, editUrl, editLabel, v => editFetchingTitle = v, v => editLabel = v)}>
              <option value="youtube">YouTube</option>
              <option value="lichess">Lichess</option>
              <option value="other">Other</option>
            </select>
            {#if editFetchingTitle}
              <span class="fetching">Fetching title…</span>
            {/if}
            <div class="form-actions">
              <button class="btn primary" onclick={() => handleSaveEdit(link)}>Save</button>
              <button class="btn" onclick={cancelEdit}>Cancel</button>
            </div>
          </div>
        {:else}
          {#if !(readonly && link.type === 'youtube')}
            <div class="link-item">
              {#if link.type === 'youtube'}
                <Film size={14} class="link-icon" />
              {:else if link.type === 'lichess'}
                <Sword size={14} class="link-icon" />
              {:else}
                <Globe size={14} class="link-icon" />
              {/if}
              <a href={link.url} target="_blank" rel="noopener noreferrer" class="link-url">
                {link.label}
              </a>
              {#if !readonly}
                <button class="btn-icon" onclick={() => startEdit(link)} title="Edit link">
                  <Pencil size={12} />
                </button>
                <button class="btn-icon" onclick={() => onRemove(link.id)} title="Remove link">
                  <Trash2 size={12} />
                </button>
              {/if}
            </div>
          {/if}
        {/if}
        {#if readonly && link.type === 'youtube'}
          {@const parsed = parseYouTubeUrl(link.url)}
          {#if parsed}
            <div class="youtube-embed">
              <iframe
                src="https://www.youtube.com/embed/{parsed.videoId}{parsed.startTime ? `?start=${parsed.startTime}` : ''}"
                title={link.label}
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
          {/if}
        {/if}
      {/each}
    </div>
  {:else if readonly}
    <p class="empty">No links</p>
  {/if}

  {#if !readonly}
    {#if showForm}
      <div class="add-form">
        <input bind:value={url} placeholder="URL" class="input" type="url" oninput={() => type === 'lichess' && handleUrlChange(url, v => label = v, v => fetchingTitle = v)} />
        <input bind:value={label} placeholder="Label (optional)" class="input" />
        <select bind:value={type} class="input" onchange={() => handleTypeChange(type, url, label, v => fetchingTitle = v, v => label = v)}>
          <option value="youtube">YouTube</option>
          <option value="lichess">Lichess</option>
          <option value="other">Other</option>
        </select>
        {#if fetchingTitle}
          <span class="fetching">{type === 'lichess' ? 'Fetching game…' : 'Fetching title…'}</span>
        {/if}
        <div class="form-actions">
          <button class="btn primary" onclick={handleAdd}>Add</button>
          <button class="btn" onclick={() => showForm = false}>Cancel</button>
        </div>
      </div>
    {:else}
      <button class="btn add-btn" onclick={() => showForm = true}>
        <Plus size={12} /> Link
      </button>
    {/if}
  {/if}
</div>

<style>
  .link-list { font-size: 0.8125rem; }
  .items { display: flex; flex-direction: column; gap: 0.25rem; }
  .link-item {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.25rem 0.375rem; border-radius: 4px;
  }
  .link-item:hover { background: var(--surface2); }
  :global(.link-icon) { flex-shrink: 0; color: var(--accent); }
  .youtube-embed {
    position: relative; width: 100%; max-width: 100%;
    aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden;
    margin-top: 0.25rem;
  }
  .youtube-embed iframe {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%; border: none;
  }
  .link-url { color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .link-url:hover { text-decoration: underline; }
  .empty { color: var(--muted); font-style: italic; }
  .btn-icon {
    background: none; border: none; cursor: pointer; padding: 2px;
    color: var(--muted); border-radius: 3px; flex-shrink: 0;
  }
  .btn-icon:hover { color: var(--text-h); background: var(--surface2); }
  .btn-icon:hover:last-child { color: var(--danger); }
  .add-form, .edit-form { display: flex; flex-direction: column; gap: 0.375rem; margin-top: 0.375rem; }
  .form-actions { display: flex; gap: 0.375rem; }
  .add-btn { margin-top: 0.375rem; }
  .input {
    padding: 0.375rem 0.5rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--bg); color: var(--text-h); font-size: inherit; font-family: inherit;
  }
  .btn {
    padding: 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 4px;
    background: var(--surface1); color: var(--text-h); cursor: pointer; font-size: inherit;
    display: inline-flex; align-items: center; gap: 0.25rem;
  }
  .btn:hover { background: var(--surface2); }
  .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn.primary:hover { opacity: 0.9; }
  .fetching { font-size: 0.75rem; color: var(--muted); font-style: italic; }
</style>
