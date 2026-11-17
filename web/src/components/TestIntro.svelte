<script lang="ts">
  import { nav } from '../lib/nav.svelte';
  import { MODES, toMs, type Mode } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Icon from './Icon.svelte';

  // The mock test tab: pick a length, read the conditions, start.
  let mode = $state<Mode>('full');
  const tests = $derived(practice.sessions.filter((s) => s.kind === 'test').reverse());
</script>

<header>
  <h1 class="text-2xl font-bold tracking-tight">Mock test</h1>
  <p class="mt-1 text-zinc-600 dark:text-zinc-400">
    Like the real thing: the questions get harder when you're right and easier when you're not, so
    most people get about half right. You get a stanine from 1 to 9, the scale candidate reports
    use, with its margin of error.
  </p>
</header>

<div class="grid gap-3 sm:grid-cols-2">
  {#each Object.entries(MODES) as [id, m] (id)}
    <button
      class="choice grid grid-cols-[auto_1fr] items-center gap-4 p-4 {mode === id ? 'chosen' : ''}"
      aria-pressed={mode === id}
      onclick={() => (mode = id as Mode)}
    >
      <span
        class="grid size-11 place-items-center rounded-xl {mode === id
          ? 'bg-brand-600 text-white'
          : 'bg-zinc-100 dark:bg-zinc-800'}"
        ><Icon name={id === 'full' ? 'test' : 'bolt'} class="size-6" /></span
      >
      <span
        ><b class="block">{m.label}</b><span class="text-sm text-zinc-500 dark:text-zinc-400"
          >{m.desc}</span
        ></span
      >
    </button>
  {/each}
</div>

<section class="card">
  <h2 class="font-bold">Test conditions</h2>
  <ul class="mt-3 flex flex-col gap-2 text-[15px]">
    {#each ['No feedback and no hints until the end.', 'One timer for the whole test: aim for about 2 minutes a question.', 'Paper and pen are fine. Use a calculator only if your real test allows one.', 'Skipping counts as wrong, so a good guess is never worse.'] as line (line)}
      <li class="flex gap-2">
        <Icon name="check" class="mt-1 size-4 shrink-0 text-emerald-600" />{line}
      </li>
    {/each}
  </ul>
  <button class="btn-primary mt-5 w-full" onclick={() => nav.open({ name: 'test', mode })}>
    <Icon name="play" fill class="size-4" />Start the {MODES[mode].label.toLowerCase()}
  </button>
</section>

{#if tests.length}
  <h2 class="mt-2 text-lg font-bold">Your results</h2>
  <section class="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
    {#each tests.slice(0, 5) as t (t.id)}
      <a
        class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        href="#review-{t.id}"
      >
        <span class="flex-1">
          <b>{t.mode === 'quick' ? 'Quick check' : 'Full mock test'}</b>
          <small class="block text-zinc-500"
            >{new Date(toMs(t.started)).toLocaleDateString()} · {t.result.correct}/{t.result
              .answered} right</small
          >
        </span>
        <span class="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >Stanine {t.result.stanine}</span
        >
        <Icon name="chev" class="size-4 text-zinc-400" />
      </a>
    {/each}
  </section>
{/if}
