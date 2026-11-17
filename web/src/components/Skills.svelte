<script lang="ts">
  import { nav } from '../lib/nav.svelte';
  import { FAMILY_IDS, recommended } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Icon from './Icon.svelte';
  import SkillCard from './SkillCard.svelte';

  // The practice tab: the four skills, a mixed lesson, and how to crack a pattern.
  const rec = $derived(recommended(practice.progress, practice.sessions));
</script>

<header>
  <h1 class="text-2xl font-bold tracking-tight">Practice</h1>
  <p class="mt-1 text-zinc-600 dark:text-zinc-400">
    Lessons of 8 questions with instant feedback. Get 6 right on your own to move up a level; each
    skill has 9.
  </p>
</header>

<button
  class="grid w-full grid-cols-[52px_1fr_auto] items-center gap-3.5 rounded-2xl border-2 border-emerald-600 bg-white p-4 text-left dark:bg-zinc-900"
  onclick={() => nav.open({ name: 'lesson', family: 'mix' })}
>
  <span class="grid size-13 place-items-center rounded-2xl bg-emerald-600 text-white"
    ><Icon name="mix" class="size-7" /></span
  >
  <span>
    <b>Mixed lesson</b>
    <span class="block text-sm text-zinc-500 dark:text-zinc-400"
      >All four kinds at your levels, like the real test.</span
    >
  </span>
  <Icon name="chev" class="size-5 text-zinc-400" />
</button>

{#each FAMILY_IDS as f (f)}<SkillCard
    family={f}
    recommended={f === rec && practice.sessions.length > 0}
  />{/each}

<section class="card">
  <h2 class="font-bold">How to crack a pattern</h2>
  <ol
    class="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[15px] marker:font-bold marker:text-emerald-600"
  >
    <li>
      <b>Changes:</b> take each number away from the next. If the changes aren't equal, look at the changes
      between them.
    </li>
    <li>
      <b>Multiplying:</b> fast growth means multiplication. Divide each number by the one before.
    </li>
    <li><b>Two series:</b> read boxes 1, 3, 5… and 2, 4, 6… on their own.</li>
    <li><b>Known series:</b> squares, cubes, primes, and "the two before added together".</li>
    <li><b>Grids and figures:</b> try rows, then columns; pair the opposite boxes of a figure.</li>
  </ol>
  <p class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
    Stuck on a question? <b>Hint</b> shows how to think about it, and <b>Show solution</b> walks you through
    it one step at a time.
  </p>
</section>
