<script lang="ts">
  let {
    onResize = (_delta: number) => {},
  } = $props();

  let dragging = $state(false);

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    dragging = true;
    let lastX = e.clientX;
    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      onResize(delta);
    }
    function onUp() {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(-10); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onResize(10); }
  }
</script>

<button
  class="resizer"
  class:dragging
  onmousedown={handleMouseDown}
  onkeydown={handleKeyDown}
  aria-label="Resize panel"
></button>

<style>
  .resizer {
    width: 5px;
    cursor: col-resize;
    flex-shrink: 0;
    background: transparent;
    transition: background 0.15s;
    position: relative;
    z-index: 10;
    border: none;
    padding: 0;
    outline: none;
  }
  .resizer:hover, .resizer.dragging {
    background: var(--accent);
  }
</style>
