<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { navigateTo } from '../state/navigation.svelte';

  let { content = '' }: { content?: string } = $props();

  let html = $derived(DOMPurify.sanitize(marked.parse(content, { async: false }) as string, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|opening):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  }));

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href?.startsWith('opening://navigate/')) return;
    e.preventDefault();
    const fen = decodeURIComponent(href.slice('opening://navigate/'.length));
    navigateTo(fen);
  }
</script>

<div class="markdown" onclick={handleClick} onkeydown={() => {}} role="presentation">{@html html}</div>

<style>
  .markdown {
    line-height: 1.6;
    font-size: 0.9375rem;
  }
  .markdown :global(p) {
    margin: 0 0 0.5rem;
  }
  .markdown :global(p:last-child) {
    margin-bottom: 0;
  }
  .markdown :global(a) {
    color: var(--accent);
    text-decoration: underline;
  }
  .markdown :global(ul), .markdown :global(ol) {
    padding-left: 1.25rem;
    margin: 0.25rem 0;
  }
  .markdown :global(code) {
    background: var(--surface2);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.875rem;
  }
</style>
