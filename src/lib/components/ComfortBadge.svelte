<script lang="ts">
  import { COMFORT_COLORS, COMFORT_LABELS } from '../constants';
  import type { ComfortLevel } from '../types';

  let { level, size = 12 }: { level: ComfortLevel | null; size?: number } = $props();
</script>

<span
  class="comfort-badge"
  style:width={size + 'px'}
  style:height={size + 'px'}
  style:background={level ? COMFORT_COLORS[level] : '#9ca3af'}
  style:opacity={level ? '1' : '0.3'}
  title={level ? COMFORT_LABELS[level] : 'Unrated'}
></span>

<style>
  .comfort-badge {
    display: inline-block;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
