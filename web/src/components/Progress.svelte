<script lang="ts">
  import { FAMILIES } from '../lib/engine';
  import {
    FAMILY_IDS,
    dayKey,
    familyStats,
    mmss,
    secs,
    streak,
    toMs,
    type SessionSummary,
  } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Icon from './Icon.svelte';

  // Test results over time, each skill's accuracy and pace, four weeks of
  // activity, and every session to review.
  const p = $derived(practice.progress);
  const sessions = $derived(practice.sessions);
  const tests = $derived(sessions.filter((s) => s.kind === 'test' && s.result.stanine));
  const answered = $derived(sessions.reduce((n, s) => n + s.result.answered, 0));
  const right = $derived(sessions.reduce((n, s) => n + s.result.correct, 0));
  const best = $derived(Math.max(0, ...tests.map((t) => t.result.stanine!)));

  // the test chart, as wide as its card so the labels stay readable on a phone
  let width = $state(640);
  const W = $derived(Math.max(280, Math.round(width))),
    H = 200,
    L = 28,
    R = 14,
    T = 10,
    B = 26;
  const x = (i: number, n: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((9 - v) * (H - T - B)) / 8;
  const clamp = (v: number) => Math.max(1, Math.min(9, v));
  const line = $derived(
    tests.map((t, i) => `${i ? 'L' : 'M'}${x(i, tests.length)} ${y(t.result.stanine!)}`).join(' '),
  );
  const band = $derived(
    tests.length > 1
      ? tests
          .map(
            (t, i) =>
              `${i ? 'L' : 'M'}${x(i, tests.length)} ${y(clamp(5 + 2 * (t.result.theta! + t.result.se!)))}`,
          )
          .join(' ') +
          ' ' +
          tests
            .map((t, i) => ({ t, i }))
            .reverse()
            .map(
              ({ t, i }) =>
                `L${x(i, tests.length)} ${y(clamp(5 + 2 * (t.result.theta! - t.result.se!)))}`,
            )
            .join(' ') +
          ' Z'
      : '',
  );
  let hover = $state<number | null>(null);

  const days = $derived.by(() => {
    const out = [];
    const d = new Date();
    d.setDate(d.getDate() - 27);
    for (let i = 0; i < 28; i++) {
      out.push({
        xp: p.days[dayKey(d)] ?? 0,
        label: d.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      });
      d.setDate(d.getDate() + 1);
    }
    return out;
  });
  const heat = [
    'bg-zinc-100 dark:bg-zinc-800',
    'bg-emerald-200 dark:bg-emerald-900',
    'bg-emerald-400 dark:bg-emerald-700',
    'bg-emerald-600 dark:bg-emerald-500',
    'bg-emerald-800 dark:bg-emerald-300',
  ];
  const heatOf = (xp: number) => (xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4);

  const title = (s: SessionSummary) =>
    s.kind === 'test'
      ? s.mode === 'quick'
        ? 'Quick check'
        : 'Full mock test'
      : (s.family === 'mix' ? 'Mixed lesson' : FAMILIES[s.family as keyof typeof FAMILIES].name) +
        ((s.result.change ?? 0) > 0 ? ' · level up' : '');
</script>

<header>
  <h1 class="text-2xl font-bold tracking-tight">Progress</h1>
  <p class="mt-1 text-zinc-600 dark:text-zinc-400">
    Every lesson and test is kept, with each question, your answer and your time.
  </p>
</header>

<div class="flex flex-wrap gap-2">
  <div class="kpi"><b>{tests.at(-1)?.result.stanine ?? '–'}</b><span>latest stanine</span></div>
  <div class="kpi"><b>{best || '–'}</b><span>best stanine</span></div>
  <div class="kpi">
    <b>{answered ? Math.round((right / answered) * 100) + '%' : '–'}</b><span
      >right on your own</span
    >
  </div>
  <div class="kpi"><b>{streak(p.days)}</b><span>days in a row</span></div>
  <div class="kpi"><b>{p.xp}</b><span>XP</span></div>
</div>

<section class="card">
  <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
    <h2 class="font-bold">Mock test results</h2>
    <span class="text-xs text-zinc-500">stanine · shaded: margin of error</span>
  </div>
  {#if tests.length}
    <div class="relative">
      <svg
        viewBox="0 0 {W} {H}"
        class="w-full overflow-visible"
        role="img"
        aria-label="Stanine of each mock test, oldest first"
      >
        {#each [1, 3, 5, 7, 9] as v (v)}
          <line
            x1={L}
            x2={W - R}
            y1={y(v)}
            y2={y(v)}
            class="stroke-zinc-200 dark:stroke-zinc-800"
          />
          <text x={L - 10} y={y(v) + 4} text-anchor="end" class="fill-zinc-400 text-[12px]"
            >{v}</text
          >
        {/each}
        {#if band}<path d={band} class="fill-emerald-500/15" />{/if}
        {#if tests.length > 1}<path
            d={line}
            fill="none"
            class="stroke-emerald-600"
            stroke-width="2"
            stroke-linejoin="round"
          />{/if}
        {#each tests as t, i (t.id)}
          <circle
            cx={x(i, tests.length)}
            cy={y(t.result.stanine!)}
            r={hover === i ? 7 : 5}
            class="fill-emerald-600 stroke-white dark:stroke-zinc-900"
            stroke-width="2"
          />
          <rect
            x={x(i, tests.length) - 16}
            y={T}
            width="32"
            height={H - T - B}
            fill="transparent"
            role="presentation"
            onpointerenter={() => (hover = i)}
            onpointerleave={() => (hover = null)}
          />
        {/each}
        {#each tests as _, i (i)}
          {#if tests.length <= 8 || i % Math.ceil(tests.length / 8) === 0}
            <text
              x={x(i, tests.length)}
              y={H - 6}
              text-anchor="middle"
              class="fill-zinc-400 text-[12px]">#{i + 1}</text
            >
          {/if}
        {/each}
      </svg>
      {#if hover !== null}
        {@const t = tests[hover]}
        <div
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white dark:bg-white dark:text-zinc-900"
          style="left: {(x(hover, tests.length) / W) * 100}%; top: {(y(t.result.stanine!) / H) *
            100 -
            4}%"
        >
          <b>Stanine {t.result.stanine}</b> · {new Date(toMs(t.started)).toLocaleDateString()}<br
          />{t.result.correct}/{t.result.answered} right
        </div>
      {/if}
    </div>
  {:else}
    <p class="py-6 text-center text-zinc-500">
      No mock tests yet. <a class="text-brand-600 underline dark:text-brand-400" href="#test"
        >Take your first one.</a
      >
    </p>
  {/if}
</section>

<div class="grid gap-4 sm:grid-cols-2">
  <section class="card">
    <h2 class="mb-1 font-bold">
      Skills <small class="font-normal text-zinc-500">last 40 answers</small>
    </h2>
    {#each FAMILY_IDS as f (f)}
      {@const st = familyStats(sessions, f)}
      <div
        class="grid grid-cols-[96px_1fr_64px] items-center gap-3 border-t border-zinc-100 py-2 first-of-type:border-0 dark:border-zinc-800"
      >
        <span
          ><b class="block">{FAMILIES[f].short}</b><small class="text-zinc-500"
            >Level {p.skills[f].level}</small
          ></span
        >
        <span class="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          ><i class="block h-full rounded-full bg-emerald-600" style="width: {(st.acc ?? 0) * 100}%"
          ></i></span
        >
        <span class="text-right text-sm tabular-nums"
          >{st.n ? Math.round(st.acc! * 100) + '%' : '–'}<small class="block text-zinc-500"
            >{st.n ? secs(st.avgMs!) : ''}</small
          ></span
        >
      </div>
    {/each}
  </section>
  <section class="card">
    <h2 class="mb-3 font-bold">Activity</h2>
    <div class="grid grid-cols-14 gap-1">
      {#each days as d, i (i)}<i
          class="aspect-square rounded {heat[heatOf(d.xp)]}"
          title="{d.xp} XP · {d.label}"
        ></i>{/each}
    </div>
    <div class="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
      <span>Last 4 weeks</span>
      <span class="flex items-center gap-1"
        >Less {#each heat as h (h)}<i class="size-3 rounded-sm {h}"></i>{/each} More</span
      >
    </div>
  </section>
</div>

<h2 class="mt-2 flex items-baseline justify-between text-lg font-bold">
  History <small class="text-xs font-normal text-zinc-500"
    >{sessions.length} session{sessions.length === 1 ? '' : 's'}</small
  >
</h2>
{#if sessions.length}
  <section class="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
    {#each [...sessions].reverse() as s (s.id)}
      <a
        class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        href="#review-{s.id}"
      >
        <span
          class="grid size-9 shrink-0 place-items-center rounded-xl {s.kind === 'test'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}"
          ><Icon
            name={s.kind === 'test' ? 'test' : s.family === 'mix' ? 'mix' : (s.family as 'series')}
            class="size-4.5"
          /></span
        >
        <span class="min-w-0 flex-1">
          <b class="block truncate">{title(s)}</b>
          <small class="text-zinc-500"
            >{new Date(toMs(s.started)).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })} · {mmss(toMs(s.ended) - toMs(s.started))}</small
          >
        </span>
        {#if s.kind === 'test'}
          <span
            class="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            >Stanine {s.result.stanine}</span
          >
        {:else}
          <span class="text-sm text-zinc-500 tabular-nums"
            >{s.result.correct}/{s.result.answered}</span
          >
        {/if}
        <Icon name="chev" class="size-4 text-zinc-400" />
      </a>
    {/each}
  </section>
{:else}
  <p class="card text-center text-zinc-500">Your lessons and tests will show up here.</p>
{/if}
