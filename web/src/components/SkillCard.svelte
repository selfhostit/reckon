<script lang="ts">
  import { FAMILIES, type Family } from '../lib/engine';
  import { nav } from '../lib/nav.svelte';
  import { familyStats, secs } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Icon from './Icon.svelte';

  // One skill: its level out of 9, recent accuracy and pace. Tap to start a lesson.
  let { family, recommended = false }: { family: Family; recommended?: boolean } = $props();
  const f = $derived(FAMILIES[family]);
  const level = $derived(practice.progress.skills[family].level);
  const st = $derived(familyStats(practice.sessions, family));
</script>

<button
  class="grid w-full grid-cols-[52px_1fr_auto] items-center gap-3.5 rounded-2xl border-2 border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 active:scale-[0.995] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
  onclick={() => nav.open({ name: 'lesson', family })}
>
  <span
    class="grid size-13 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
  >
    <Icon name={family} class="size-7" />
  </span>
  <span class="min-w-0">
    <span class="flex flex-wrap items-center gap-2">
      <b>{f.name}</b>
      {#if recommended}<span
          class="badge bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >Recommended</span
        >{/if}
    </span>
    <span class="block text-sm text-zinc-500 dark:text-zinc-400">{f.blurb}</span>
    <span class="mt-1.5 flex flex-wrap items-center gap-2.5">
      <span class="flex gap-1" role="img" aria-label="Level {level} of 9">
        {#each Array(9) as _, i (i)}
          <i
            class="h-1.5 w-3.5 rounded-full {i < level
              ? 'bg-emerald-600 dark:bg-emerald-500'
              : 'bg-zinc-200 dark:bg-zinc-800'} {i + 1 < f.min ? 'opacity-40' : ''}"
          ></i>
        {/each}
      </span>
      <span class="text-xs text-zinc-500">
        Level {level}{st.n ? ` · ${Math.round(st.acc! * 100)}% · ${secs(st.avgMs!)}` : ''}
      </span>
    </span>
  </span>
  <Icon name="chev" class="size-5 text-zinc-400" />
</button>
