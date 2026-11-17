<script lang="ts">
  import { FAMILIES } from '../lib/engine';
  import { nav } from '../lib/nav.svelte';
  import {
    FAMILY_IDS,
    STANINE_WORDS,
    mmss,
    secs,
    toMs,
    type SessionSummary,
  } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Icon from './Icon.svelte';
  import Stanine from './Stanine.svelte';

  // Straight after a lesson or a mock test: the score, what changed, and what to do next.
  let { id }: { id: string } = $props();

  const s = $derived(practice.sessions.find((x) => x.id === id) as SessionSummary);
  const r = $derived(s.result);
  const time = $derived(toMs(s.ended) - toMs(s.started));
  const avg = $derived(time / Math.max(1, r.answered));
  const previous = $derived(
    practice.sessions
      .filter((x) => x.kind === 'test' && x.result.stanine && toMs(x.started) < toMs(s.started))
      .at(-1),
  );
  const byFam = $derived(
    FAMILY_IDS.map((f) => ({ f, t: r.fam?.[f] }))
      .filter((x) => x.t)
      .map(({ f, t }) => ({ f, n: t![0], right: t![1], ms: t![2] / t![0] })),
  );
  const weakest = $derived([...byFam].sort((a, b) => a.right / a.n - b.right / b.n)[0]);
  const name = $derived(
    s.family === 'mix' ? 'Mixed lesson' : s.family ? FAMILIES[s.family].name : '',
  );
  const celebrate = $derived(s.kind === 'practice' && ((r.change ?? 0) > 0 || (r.bonus ?? 0) > 0));
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 1.6,
    color: ['#059669', '#f59e0b', '#2563eb', '#dc2626'][i % 4],
  }));
</script>

<main
  class="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10"
>
  {#if s.kind === 'practice'}
    <section class="card rise text-center">
      {#if (r.change ?? 0) > 0}
        <p class="eyebrow">Level up</p>
        <div
          class="mx-auto my-3 grid size-20 place-items-center rounded-3xl bg-emerald-600 text-4xl font-bold text-white shadow-[0_5px_0_var(--color-emerald-800)]"
        >
          {s.level_after}
        </div>
        <h1 class="text-2xl font-extrabold tracking-tight">
          {name}: level {s.level_after} unlocked
        </h1>
        <p class="mt-1 text-zinc-600 dark:text-zinc-400">
          {r.correct} of {r.answered} on your own. The next questions will be harder.
        </p>
      {:else if (r.change ?? 0) < 0}
        <p class="eyebrow">Adjusting</p>
        <div
          class="mx-auto my-3 grid size-20 place-items-center rounded-3xl bg-amber-500 text-4xl font-bold text-white shadow-[0_5px_0_var(--color-amber-700)]"
        >
          {s.level_after}
        </div>
        <h1 class="text-2xl font-extrabold tracking-tight">
          Let's make level {s.level_after} solid first
        </h1>
        <p class="mt-1 text-zinc-600 dark:text-zinc-400">
          No problem: a firm base is where speed comes from.
        </p>
      {:else}
        <p class="eyebrow">Lesson complete</p>
        <div
          class="mx-auto my-3 grid size-20 place-items-center rounded-3xl bg-emerald-600 text-4xl font-bold text-white shadow-[0_5px_0_var(--color-emerald-800)]"
        >
          {r.correct}
        </div>
        <h1 class="text-2xl font-extrabold tracking-tight">
          {r.correct} of {r.answered} on your own
        </h1>
        <p class="mt-1 text-zinc-600 dark:text-zinc-400">
          {s.family === 'mix'
            ? 'Mixed lessons keep all four skills sharp.'
            : `Get 6 or more to reach level ${Math.min(9, s.level + 1)}.`}
        </p>
      {/if}
      <div class="mt-5 flex flex-wrap justify-center gap-2 text-left">
        <div class="kpi">
          <b class="text-blue-600 dark:text-blue-400">+{r.xp ?? 0}</b><span
            >XP{r.bonus ? ' with a perfect bonus' : ''}</span
          >
        </div>
        <div class="kpi">
          <b>{Math.round((r.correct / r.answered) * 100)}%</b><span>on your own</span>
        </div>
        {#if r.helped}<div class="kpi">
            <b class="text-blue-600 dark:text-blue-400">{r.helped}</b><span
              >with the walkthrough</span
            >
          </div>{/if}
        <div class="kpi"><b>{secs(avg)}</b><span>per question</span></div>
      </div>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <button
          class="btn-primary"
          onclick={() => nav.open({ name: 'lesson', family: s.family || 'mix' })}
          ><Icon name="play" fill class="size-4" />Next lesson</button
        >
        <button class="btn-secondary" onclick={() => nav.tab(`review-${s.id}`)}
          >Review answers</button
        >
        <button class="btn text-zinc-500" onclick={() => nav.tab('today')}>Done</button>
      </div>
    </section>
  {:else}
    <section class="card rise">
      <p class="eyebrow">{s.mode === 'quick' ? 'Quick check' : 'Full mock test'}</p>
      <div class="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div class="flex items-end gap-3">
            <span class="text-6xl leading-none font-bold tracking-tighter tabular-nums"
              >{r.stanine}</span
            >
            <div class="pb-1">
              <b>Stanine</b>
              <p class="text-sm text-zinc-500 dark:text-zinc-400">
                {r.lo === r.hi ? 'margin of error within this band' : `likely ${r.lo}–${r.hi}`}
              </p>
            </div>
          </div>
          {#if previous}
            {@const d = r.stanine! - previous.result.stanine!}
            <span
              class="badge mt-2.5 {d > 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : d < 0
                  ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}"
              >{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : 'No change'} since your last test</span
            >
          {/if}
        </div>
        <div class="w-full max-w-xs"><Stanine value={r.stanine} lo={r.lo} hi={r.hi} /></div>
      </div>
      <p class="mt-4 text-zinc-600 dark:text-zinc-400">
        {STANINE_WORDS[r.stanine ?? 5]}: higher than about
        <b class="text-zinc-900 dark:text-zinc-100">{r.pct}%</b>
        of people on this practice scale.{r.timeout
          ? ' Time ran out before the last question.'
          : ''}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <div class="kpi"><b>{r.correct}/{r.answered}</b><span>right</span></div>
        <div class="kpi"><b>{secs(avg)}</b><span>per question</span></div>
        <div class="kpi"><b>{mmss(time)}</b><span>in total</span></div>
        <div class="kpi"><b>{r.maxLevel || '–'}</b><span>hardest level solved</span></div>
        <div class="kpi"><b>±{((r.se ?? 0) * 2).toFixed(1)}</b><span>margin of error</span></div>
      </div>
    </section>

    <div class="grid gap-4 sm:grid-cols-2">
      <section class="card">
        <h2 class="mb-2 font-bold">By question type</h2>
        {#each byFam as x (x.f)}
          <div
            class="grid grid-cols-[88px_1fr_64px] items-center gap-3 border-t border-zinc-100 py-2 first:border-0 dark:border-zinc-800"
          >
            <span class="font-semibold">{FAMILIES[x.f].short}</span>
            <span class="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              ><i
                class="block h-full rounded-full bg-emerald-600"
                style="width: {(x.right / x.n) * 100}%"
              ></i></span
            >
            <span class="text-right text-sm tabular-nums"
              >{x.right}/{x.n}<small class="block text-zinc-500">{secs(x.ms)}</small></span
            >
          </div>
        {/each}
      </section>
      <section class="card">
        <h2 class="mb-2 font-bold">What next</h2>
        <ul class="flex flex-col gap-2 text-[15px]">
          {#if weakest && weakest.right / weakest.n < 0.6}
            <li class="flex gap-2">
              <Icon name="check" class="mt-1 size-4 shrink-0 text-emerald-600" /><span
                >Practise <b>{FAMILIES[weakest.f].name.toLowerCase()}</b>: your lowest score this
                time.</span
              >
            </li>
          {/if}
          <li class="flex gap-2">
            <Icon name="check" class="mt-1 size-4 shrink-0 text-emerald-600" />
            <span
              >{avg > 120_000
                ? 'You averaged over 2 minutes a question. Practise guessing and moving on after about 90 seconds.'
                : 'Your pace is good: keep it under 2 minutes a question.'}</span
            >
          </li>
          {#if r.bumped}<li class="flex gap-2">
              <Icon name="check" class="mt-1 size-4 shrink-0 text-emerald-600" /><span
                >Your practice levels went up to match this result.</span
              >
            </li>{/if}
          <li class="flex gap-2">
            <Icon name="check" class="mt-1 size-4 shrink-0 text-emerald-600" /><span
              >Retake it in a few days: scores move about one stanine between sittings.</span
            >
          </li>
        </ul>
      </section>
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="btn-primary" onclick={() => nav.tab(`review-${s.id}`)}
        >Review every question</button
      >
      {#if weakest}
        <button
          class="btn-secondary"
          onclick={() => nav.open({ name: 'lesson', family: weakest.f })}
        >
          <Icon name="play" fill class="size-4" />Practise {FAMILIES[weakest.f].short.toLowerCase()}
        </button>
      {/if}
      <button class="btn text-zinc-500" onclick={() => nav.tab('progress')}>See progress</button>
    </div>
    <p class="text-xs text-zinc-500">
      A practice estimate from the questions' built-in difficulty, not an official norm score. Use
      it to follow your own progress.
    </p>
  {/if}
</main>

{#if celebrate}
  <div
    class="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
    aria-hidden="true"
  >
    {#each pieces as p, i (i)}
      <i
        class="confetti absolute -top-3 h-3.5 w-2 rounded-sm"
        style="left: {p.left}%; background: {p.color}; animation-duration: {p.dur}s; animation-delay: {p.delay}s"
      ></i>
    {/each}
  </div>
{/if}

<style>
  .confetti {
    animation: fall linear forwards;
  }
  @keyframes fall {
    to {
      transform: translateY(110vh) rotate(720deg);
    }
  }
</style>
