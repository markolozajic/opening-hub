<script lang="ts">
  import { pgnView, pgnGoToMove, closePgnView } from '../state/pgnView.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import { ArrowLeft, ChevronLeft, ChevronRight } from '@lucide/svelte';

  let { onClose = undefined as (() => void) | undefined } = $props();

  let currentIndex = $derived(pgnView.currentMoveIndex);
  let moves = $derived(pgnView.moves);
  let commentsMap = $derived(pgnView.commentsMap);

  let currentComment = $derived(
    currentIndex >= 0
      ? (commentsMap[moves[currentIndex]?.after] ?? null)
      : null
  );

  let isAtStart = $derived(currentIndex === -1);
  let isAtEnd = $derived(currentIndex >= moves.length - 1);

  let white = $derived(pgnView.label);

  let moveRows = $derived.by(() => {
    const rows: Array<{
      moveNum: number;
      white: string;
      whiteIndex: number;
      black?: string;
      blackIndex?: number;
    }> = [];
    for (let i = 0; i < moves.length; i += 2) {
      const row: {
        moveNum: number;
        white: string;
        whiteIndex: number;
        black?: string;
        blackIndex?: number;
      } = {
        moveNum: Math.floor(i / 2) + 1,
        white: moves[i].san,
        whiteIndex: i,
      };
      if (moves[i + 1]) {
        row.black = moves[i + 1].san;
        row.blackIndex = i + 1;
      }
      rows.push(row);
    }
    return rows;
  });

  function handleGoToMove(index: number) {
    pgnGoToMove(index);
  }

  function goNext() {
    if (!isAtEnd) pgnGoToMove(currentIndex + 1);
  }

  function goPrev() {
    if (!isAtStart) pgnGoToMove(currentIndex - 1);
  }

  function isCurrent(index: number): boolean {
    return currentIndex === index;
  }

  function handleClose() {
    closePgnView();
    onClose?.();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      goNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      goPrev();
    }
  }

  let headers: Record<string, string> = $derived({} /* not used directly */);

  let eventStr = $derived('');
  let dateStr = $derived('');
  let resultStr = $derived('');

  function fmt(v: string): string {
    if (v === '?' || v === '????.??.??' || v === '-') return '';
    return v;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<div class="pgn-viewer" onkeydown={handleKeyDown} role="application">
  <button class="back-btn" onclick={handleClose}>
    <ArrowLeft size={14} /> Back to repertoire
  </button>

  <div class="metadata">
    <div class="moves-info">
      <span class="move-count">{currentIndex === -1 ? 0 : currentIndex + 1}/{moves.length} moves</span>
    </div>
  </div>

  <div class="game-area">
    <div class="moves-section">
      <div class="moves-list">
        {#each moveRows as row}
          <div class="move-row">
            <span class="move-num">{row.moveNum}.</span>
            <button
              class="move-san"
              class:active={isCurrent(row.whiteIndex)}
              onclick={() => handleGoToMove(row.whiteIndex)}
            >
              {row.white}
            </button>
            {#if row.black}
              <button
                class="move-san"
                class:active={isCurrent(row.blackIndex!)}
                onclick={() => handleGoToMove(row.blackIndex!)}
              >
                {row.black}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="nav-controls">
      <button class="nav-btn" onclick={goPrev} disabled={isAtStart}>
        <ChevronLeft size={14} />
      </button>
      <span class="nav-label">
        {currentIndex === -1 ? 'Start' : moves[currentIndex]?.san ?? ''}
      </span>
      <button class="nav-btn" onclick={goNext} disabled={isAtEnd}>
        <ChevronRight size={14} />
      </button>
    </div>
  </div>

  {#if currentComment}
    <div class="comment">
      <MarkdownRenderer content={currentComment} />
    </div>
  {/if}
</div>

<style>
  .pgn-viewer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    font-size: 0.8125rem;
    outline: none;
    height: 100%;
    box-sizing: border-box;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--text);
    align-self: flex-start;
  }

  .back-btn:hover {
    background: var(--surface2);
    color: var(--text-h);
  }

  .metadata {
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--border);
  }

  .moves-info {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .move-count {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .game-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-height: 0;
  }

  .moves-section {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .moves-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .move-row {
    display: grid;
    grid-template-columns: 1.5rem 1fr 1fr;
    gap: 0;
    align-items: center;
    padding: 0.0625rem 0;
  }

  .move-num {
    color: var(--muted);
    font-size: 0.6875rem;
    text-align: right;
    padding-right: 0.375rem;
    user-select: none;
  }

  .move-san {
    background: none;
    border: none;
    padding: 0.125rem 0.25rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-family: var(--mono);
    color: var(--text);
    text-align: left;
    border-radius: 2px;
    transition: background 0.1s;
  }

  .move-san:hover {
    background: var(--surface2);
  }

  .move-san.active {
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 600;
  }

  .nav-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface1);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: var(--text);
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--surface2);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .nav-label {
    font-size: 0.8125rem;
    font-family: var(--mono);
    color: var(--text);
    min-width: 4rem;
    text-align: center;
  }

  .comment {
    padding: 0.5rem;
    background: var(--surface1);
    border-radius: 4px;
    border: 1px solid var(--border);
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--text);
    flex-shrink: 0;
  }
</style>
