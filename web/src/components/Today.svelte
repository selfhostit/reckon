<script lang="ts">
  import { FAMILIES } from '../lib/engine';
  import { nav } from '../lib/nav.svelte';
  import { FAMILY_IDS, dayKey, recommended, streak, toMs } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import { session } from '../lib/session.svelte';
  import Icon from './Icon.svelte';
  import SkillCard from './SkillCard.svelte';
  import Stanine from './Stanine.svelte';

  // The home tab: today's goal and streak, where to continue, and the latest test level.
  const p = $derived(practice.progress);
  const today = $derived(p.days[dayKey()] ?? 0);
  const goal = $derived(p.daily_goal || 50);
  const days = $derived(streak(p.days));
  const rec = $derived(recommended(p, practice.sessions));
  const last = $derived(practice.sessions.filter((s) => s.kind === 'test').at(-1));
  const first = (session.user?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const tips = [
    'Check the change between neighbours first, then the change between those changes.',
    'If numbers grow fast, divide each one by the one before: × 2 and × 3 hide there.',
    'Read every other number on its own. Two series are often mixed together.',
    'In grids, test both directions: rows first, then columns.',
    'Stuck after 90 seconds? Make your best guess and move on.',
    'Know the squares (4, 9, 16, 25, 36…) and cubes (8, 27, 64, 125…) by heart.',
    'In figures, pair up opposite boxes: top with bottom, left with right.',
  ];
  const tip = tips[new Date().getDate() % tips.length];
  const r = 43,
    circ = 2 * Math.PI * r;
</script>

<header class="flex items-center justify-between gap-3">
  <h1 class="text-2xl font-bold tracking-tight">{greet}{first ? `, ${first}` : ''}</h1>
  <div class="flex gap-1.5">
    <span
      class="flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900 {days
        ? 'text-amber-500'
        : 'text-zinc-400'}"
      title="Days in a row"><Icon name="flame" fill class="size-4" />{days}</span
    >
    <span
      class="flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-sm font-bold text-blue-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-blue-400"
      title="All your XP"><Icon name="bolt" fill class="size-4" />{p.xp}</span
    >
  </div>
</header>

{#if !practice.sessions.length}
  <section
    class="card border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
  >
    <h2 class="font-bold">Practise for the numbers test</h2>
    <p class="mt-1 text-[15px] text-zinc-700 dark:text-zinc-300">
      Many employers ask candidates to sit a numerical reasoning test: rows of boxes, grids and
      figures with one number missing, against the clock. Reckon gives you endless questions like
      those, with hints and worked solutions, and adaptive mock tests that place you on the same 1–9
      scale the reports use.
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <button class="btn-primary" onclick={() => nav.open({ name: 'lesson', family: 'series' })}
        ><Icon name="play" fill class="size-4" />Start with number series</button
      >
      <button class="btn-secondary" onclick={() => nav.tab('test')}>Find my level first</button>
    </div>
  </section>
{/if}

<section class="card grid grid-cols-[auto_1fr] items-center gap-5">
  <div class="relative size-24">
    <svg viewBox="0 0 96 96" class="size-24 -rotate-90" aria-hidden="true">
      <circle
        cx="48"
        cy="48"
        {r}
        fill="none"
        stroke-width="10"
        class="stroke-zinc-100 dark:stroke-zinc-800"
      />
      <circle
        cx="48"
        cy="48"
        {r}
        fill="none"
        stroke-width="10"
        stroke-linecap="round"
        class={today >= goal ? 'stroke-amber-500' : 'stroke-emerald-600'}
        stroke-dasharray="{circ * Math.min(1, today / goal)} {circ}"
      />
    </svg>
    <div class="absolute inset-0 grid place-items-center text-center leading-tight">
      <div>
        <b class="text-xl tabular-nums">{today}</b><small class="block text-xs text-zinc-500"
          >/ {goal} XP</small
        >
      </div>
    </div>
  </div>
  <div>
    <p class="font-semibold">
      {today >= goal
        ? 'Daily goal reached.'
        : today
          ? `${goal - today} XP to today's goal.`
          : 'A three-minute lesson keeps your streak going.'}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button class="btn-primary" onclick={() => nav.open({ name: 'lesson', family: rec })}>
        <Icon name="play" fill class="size-4" />{FAMILIES[rec].short}
      </button>
      <button class="btn-secondary" onclick={() => nav.open({ name: 'lesson', family: 'mix' })}>
        <Icon name="shuffle" class="size-4" />Mixed
      </button>
    </div>
  </div>
</section>

<div class="grid gap-4 sm:grid-cols-2">
  <section class="card">
    <div class="mb-3 flex items-baseline justify-between">
      <span class="eyebrow">Your level</span>
      {#if last}<span class="text-xs text-zinc-500"
          >{new Date(toMs(last.started)).toLocaleDateString()}</span
        >{/if}
    </div>
    <Stanine value={last?.result.stanine ?? 0} lo={last?.result.lo} hi={last?.result.hi} />
    <p class="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
      {#if last}
        Stanine <b class="text-zinc-900 dark:text-zinc-100">{last.result.stanine}</b> on your last mock
        test.
      {:else}
        A mock test places you on the 1–9 scale used in candidate reports.
      {/if}
    </p>
    <button class="btn-secondary mt-3 w-full" onclick={() => nav.tab('test')}>
      <Icon name="test" class="size-4" />{last ? 'Take another test' : 'Take a mock test'}
    </button>
  </section>
  <section class="card">
    <span class="eyebrow">Tip of the day</span>
    <p class="mt-2.5 text-lg font-semibold">{tip}</p>
  </section>
</div>

<h2 class="mt-2 text-lg font-bold">Skills</h2>
{#each FAMILY_IDS as f (f)}<SkillCard
    family={f}
    recommended={f === rec && practice.sessions.length > 0}
  />{/each}
