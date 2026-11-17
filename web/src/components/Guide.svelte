<script lang="ts">
  import type { GuideStep } from '../lib/engine';
  import Icon from './Icon.svelte';

  // The steps of a solution, up to `upto`; the newest one stands out until all are shown.
  let { steps, upto = steps.length }: { steps: GuideStep[]; upto?: number } = $props();
  const all = $derived(upto >= steps.length);
</script>

<ol class="flex flex-col gap-2.5">
  {#each steps.slice(0, upto) as s, i (i)}
    {@const current = i === upto - 1 && !all}
    <li
      class="grid grid-cols-[28px_1fr] gap-2.5 text-[15px] transition-opacity {all ||
      current ||
      s.final
        ? ''
        : 'opacity-60'} {current ? 'rise' : ''} {s.final ? 'font-semibold' : ''}"
    >
      <span
        class="grid size-6.5 place-items-center rounded-full text-xs font-extrabold {s.final
          ? 'bg-emerald-600 text-white'
          : current
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}"
      >
        {#if s.final}<Icon name="check" class="size-3.5" />{:else}{i + 1}{/if}
      </span>
      <div>
        <p>{s.t}</p>
        {#if s.lines?.length}
          <div class="mt-1.5 flex flex-col items-start gap-1">
            {#each s.lines as line (line)}
              <span
                class="rounded-lg bg-zinc-100 px-2.5 py-0.5 font-semibold tabular-nums dark:bg-zinc-800"
                >{line}</span
              >
            {/each}
          </div>
        {/if}
      </div>
    </li>
  {/each}
</ol>
