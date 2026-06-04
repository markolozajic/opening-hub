<script lang="ts">
  import { parseFenBoard, getSquareColor, PIECE_URL, displayToReal, realToDisplay, parseSq } from '../chess/board';

  let {
    fen = '',
    selectedSquare = null as string | null,
    highlightedSquares = [] as string[],
    lastMoveSquares = [] as string[],
    interactive = false,
    flipped = false,
    size = 480,
    onSquareClick = (_sq: string) => {},
    onDrop = (_from: string, _to: string) => {},
  } = $props();

  let cellSize = $derived(size / 8);
  let boardData = $derived(parseFenBoard(fen));

  let selectedDisplay = $derived(
    selectedSquare ? realToDisplay(parseSq(selectedSquare).file, parseSq(selectedSquare).rank, flipped) : null
  );

  let dragFromSq = $state<string | null>(null);
  let dragPiece = $state<string | null>(null);
  let dragStartSvgPos = $state<{x: number, y: number} | null>(null);
  let dragSvgPos = $state<{x: number, y: number} | null>(null);
  let isDragging = $state(false);
  let pointerId = $state<number | null>(null);

  const DRAG_THRESHOLD = 5;

  function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): {x: number, y: number} {
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function sqFromPoint(pt: {x: number, y: number}): {df: number; dr: number; rank: number; file: number; sq: string} | null {
    const df = Math.floor(pt.x / cellSize);
    const dr = Math.floor(pt.y / cellSize);
    if (df < 0 || df >= 8 || dr < 0 || dr >= 8) return null;
    const { rank, file, sq } = displayToReal(df, dr, flipped);
    return { df, dr, rank, file, sq };
  }

  function getDisplayHighlighted(df: number, dr: number): boolean {
    const { sq } = displayToReal(df, dr, flipped);
    return highlightedSquares.includes(sq);
  }

  function getDisplayLastMove(df: number, dr: number): boolean {
    const { sq } = displayToReal(df, dr, flipped);
    return lastMoveSquares.includes(sq);
  }

  function handlePointerDown(e: PointerEvent) {
    if (!interactive) return;
    const svg = e.currentTarget as SVGSVGElement;
    const pt = getSvgPoint(svg, e.clientX, e.clientY);
    const info = sqFromPoint(pt);
    if (!info) return;

    dragFromSq = info.sq;
    dragPiece = boardData[info.rank][info.file];
    dragStartSvgPos = pt;
    dragSvgPos = pt;
    isDragging = false;
    pointerId = e.pointerId;
    svg.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragFromSq || e.pointerId !== pointerId) return;
    const svg = e.currentTarget as SVGSVGElement;
    const pt = getSvgPoint(svg, e.clientX, e.clientY);
    dragSvgPos = pt;

    if (!isDragging && dragStartSvgPos) {
      const dx = pt.x - dragStartSvgPos.x;
      const dy = pt.y - dragStartSvgPos.y;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        isDragging = true;
      }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!dragFromSq || e.pointerId !== pointerId) {
      resetDrag();
      return;
    }
    const svg = e.currentTarget as SVGSVGElement;

    if (isDragging && dragPiece) {
      const pt = getSvgPoint(svg, e.clientX, e.clientY);
      const dest = sqFromPoint(pt);
      if (dest && dest.sq !== dragFromSq) {
        onDrop(dragFromSq, dest.sq);
      }
    } else {
      onSquareClick(dragFromSq);
    }

    resetDrag();
  }

  function resetDrag() {
    dragFromSq = null;
    dragPiece = null;
    dragStartSvgPos = null;
    dragSvgPos = null;
    isDragging = false;
    pointerId = null;
  }

  function isDragSource(df: number, dr: number): boolean {
    if (!isDragging || !dragFromSq) return false;
    const { sq } = displayToReal(df, dr, flipped);
    return sq === dragFromSq;
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  class="chess-board"
  class:interactive
  class:grabbing={isDragging}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  role="grid"
  tabindex={interactive ? 0 : -1}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); } }}
  aria-label="Chess board"
>
  <rect width={size} height={size} fill="#d4c4a8" rx="4" />

  {#each [0,1,2,3,4,5,6,7] as dr}
    {#each [0,1,2,3,4,5,6,7] as df}
      {@const { file: rf, rank: rr, sq } = displayToReal(df, dr, flipped)}
      {@const piece = boardData[rr][rf]}
      {@const isLight = getSquareColor(rf, rr) === 'light'}
      {@const isSel = selectedDisplay && selectedDisplay.displayFile === df && selectedDisplay.displayRank === dr}
      {@const isHigh = getDisplayHighlighted(df, dr)}
      {@const isLM = getDisplayLastMove(df, dr)}
      {@const isDragSq = isDragSource(df, dr)}

      <rect
        x={df * cellSize}
        y={dr * cellSize}
        width={cellSize}
        height={cellSize}
        fill={isLight ? '#f0d9b5' : '#b58863'}
        stroke={isLM ? '#fff' : 'none'}
        stroke-width={isLM ? '2' : '0'}
      />

      {#if isSel}
        <rect
          x={df * cellSize}
          y={dr * cellSize}
          width={cellSize}
          height={cellSize}
          fill="rgba(255,255,0,0.3)"
        />
      {/if}

      {#if piece && !(isDragging && isDragSq)}
        <image
          href={PIECE_URL[piece]}
          x={df * cellSize + cellSize * 0.05}
          y={dr * cellSize + cellSize * 0.05}
          width={cellSize * 0.9}
          height={cellSize * 0.9}
          style="pointer-events: none;"
        />
      {/if}

      {#if isHigh}
        <circle
          cx={df * cellSize + cellSize / 2}
          cy={dr * cellSize + cellSize / 2}
          r={cellSize * 0.14}
          fill="rgba(0,0,0,0.25)"
        />
      {/if}
    {/each}
  {/each}

  {#if isDragging && dragPiece && dragSvgPos}
    <image
      href={PIECE_URL[dragPiece]}
      x={dragSvgPos.x - cellSize * 0.45}
      y={dragSvgPos.y - cellSize * 0.45}
      width={cellSize * 0.9}
      height={cellSize * 0.9}
      style="pointer-events: none; opacity: 0.85;"
    />
  {/if}
</svg>

<style>
  .chess-board {
    display: block;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    user-select: none;
    touch-action: none;
  }
  .chess-board.interactive {
    cursor: pointer;
  }
  .chess-board.interactive.grabbing {
    cursor: grabbing;
  }
</style>
