<script lang="ts">
  // The 1-9 stanine scale used in candidate reports, shaped like the bell curve
  // behind it, with the score and its likely range marked.
  let { value = 0, lo = 0, hi = 0 }: { value?: number; lo?: number; hi?: number } = $props();
  const heights = [22, 34, 48, 62, 70, 62, 48, 34, 22];
</script>

<div aria-label={value ? `Stanine ${value} of 9` : 'No score yet'} role="img">
  <div class="flex h-14 items-end gap-1">
    {#each heights as h, i (i)}
      {@const s = i + 1}
      <i
        class="flex-1 rounded-t {s === value
          ? 'bg-emerald-600 dark:bg-emerald-500'
          : s >= lo && s <= hi
            ? 'bg-emerald-200 dark:bg-emerald-900'
            : 'bg-zinc-100 dark:bg-zinc-800'}"
        style="height: {(h / 70) * 100}%"
      ></i>
    {/each}
  </div>
  <div class="mt-1.5 flex gap-1 text-center text-xs tabular-nums">
    {#each heights as _, i (i)}
      <span class="flex-1 {i + 1 === value ? 'font-bold' : 'text-zinc-400'}">{i + 1}</span>
    {/each}
  </div>
</div>
