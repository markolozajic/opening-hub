<script lang="ts">
  import { parseFenBoard, getSquareColor, PIECE_URL, displayToReal, LIGHT_SQUARE, DARK_SQUARE } from '../chess/board';

  let {
    fen = '',
    flipped = false,
    size = 100,
  } = $props();

  let cellSize = $derived(size / 8);
  let boardData = $derived(parseFenBoard(fen));
</script>

<svg
  viewBox="0 0 {size} {size}"
  class="mini-board"
  role="img"
  aria-label="Board preview"
>
  {#each [0,1,2,3,4,5,6,7] as dr}
    {#each [0,1,2,3,4,5,6,7] as df}
      {@const { file: rf, rank: rr } = displayToReal(df, dr, flipped)}
      {@const piece = boardData[rr][rf]}
      {@const isLight = getSquareColor(rf, rr) === 'light'}
      <rect
        x={df * cellSize}
        y={dr * cellSize}
        width={cellSize}
        height={cellSize}
        fill={isLight ? LIGHT_SQUARE : DARK_SQUARE}
      />
      {#if piece}
        <image
          href={PIECE_URL[piece]}
          x={df * cellSize + cellSize * 0.05}
          y={dr * cellSize + cellSize * 0.05}
          width={cellSize * 0.9}
          height={cellSize * 0.9}
          style="pointer-events: none;"
        />
      {/if}
    {/each}
  {/each}
</svg>

<style>
  .mini-board {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    flex-shrink: 0;
  }
</style>
