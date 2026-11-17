<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { FAMILIES, makeItem, shuffle, fmt, type Item } from '../lib/engine';
  import { showAnswer } from '../lib/demo';
  import { nav } from '../lib/nav.svelte';
  import { errorMessage } from '../lib/pb';
  import {
    FAMILY_IDS,
    earned,
    lessonPlan,
    levelAfterLesson,
    secs,
    tally,
    validAnswer,
    withXp,
    xpFor,
    type Answer,
    type LessonFamily,
  } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import AnswerInput from './AnswerInput.svelte';
  import Guide from './Guide.svelte';
  import Icon from './Icon.svelte';
  import ItemView from './ItemView.svelte';

  // A lesson: eight questions with instant feedback. Under each question a
  // hint explains how to think about it, and the solution walks through it
  // step by step, highlighting the boxes each step is about.
  let { family }: { family: LessonFamily } = $props();

  // a lesson is set up once, from its family when it starts (Home keys it)
  const { level, plan } = untrack(() => ({
    level: family === 'mix' ? 0 : practice.progress.skills[family].level,
    plan: lessonPlan(practice.progress, family, shuffle),
  }));
  const started = Date.now();
  let answers = $state<Answer[]>([]);
  let item = $state<Item>(makeItem(plan[0].family, plan[0].level));
  let input = $state('');
  let asked = $state(Date.now());
  let phase = $state<'ask' | 'feedback'>('ask');
  let hinted = $state(false);
  let sol = $state(0); // solution steps shown
  let confirmLeave = $state(false);
  let saveError = $state('');

  const idx = $derived(answers.length - (phase === 'feedback' ? 1 : 0));
  const last = $derived(answers[answers.length - 1]);
  const steps = $derived(item.guide);
  const shown = $derived(steps.slice(0, sol));
  const lit = $derived(new Set(shown[shown.length - 1]?.hl ?? []));
  const revealed = $derived(shown.some((s) => s.reveal));
  const isChallenge = $derived(
    family !== 'mix' && idx === plan.length - 1 && plan[idx].level > level,
  );

  function check(skip = false) {
    const given = skip || !validAnswer(input) ? null : Number(input.trim());
    const a: Answer = {
      item,
      given,
      correct: given === item.answer,
      ms: Date.now() - asked,
      hinted,
      solved: sol > 0,
    };
    answers.push(a);
    const xp = xpFor(a);
    if (xp) practice.setProgress(withXp(practice.progress, xp)).catch(() => {});
    phase = 'feedback';
  }

  function next() {
    if (answers.length >= plan.length) return finish();
    const q = plan[answers.length];
    item = makeItem(q.family, q.level);
    input = '';
    hinted = false;
    sol = 0;
    phase = 'ask';
    asked = Date.now();
    scrollTo(0, 0);
  }

  async function finish() {
    saveError = '';
    const correct = answers.filter(earned).length;
    const helped = answers.filter((a) => a.solved).length;
    let p = practice.progress;
    let change = 0,
      levelAfter = level;
    if (family !== 'mix') {
      const out = levelAfterLesson(level, FAMILIES[family].min, correct);
      change = out.change;
      levelAfter = out.level;
      p = { ...p, skills: { ...p.skills, [family]: { level: levelAfter } } };
    }
    const bonus = correct === answers.length ? 20 : 0;
    p = withXp(p, bonus);
    try {
      await practice.setProgress(p);
      const s = await practice.addSession({
        kind: 'practice',
        family,
        level,
        level_after: levelAfter,
        started,
        ended: Date.now(),
        items: $state.snapshot(answers) as Answer[],
        result: {
          correct,
          answered: answers.length,
          fam: tally(answers),
          bonus,
          change,
          helped,
          xp: answers.reduce((n, a) => n + xpFor(a), 0) + bonus,
        },
      });
      nav.open({ name: 'result', id: s.id });
    } catch (err) {
      saveError = errorMessage(err, "Couldn't save this lesson.");
    }
  }

  function hint() {
    if (phase !== 'ask' || hinted) return;
    hinted = true;
  }

  function nextStep() {
    if (sol < steps.length) sol++;
    // keep the newest step in view, above the answer bar
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-guide] li:last-child');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  $effect(() => showAnswer(item.answer));

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || confirmLeave) return;
      if (
        phase === 'feedback' &&
        e.key === 'Enter' &&
        document.activeElement?.tagName !== 'BUTTON'
      ) {
        e.preventDefault();
        next();
      } else if (phase === 'ask' && (e.key === 'h' || e.key === 's')) {
        e.preventDefault();
        if (e.key === 'h') hint();
        else nextStep();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const titles = ['Correct!', 'Nicely done!', 'Spot on!', 'Exactly right!'];
  const praise = $derived(titles[answers.length % titles.length]);
</script>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col">
  <header
    class="sticky top-0 z-10 flex items-center gap-3 bg-zinc-50/95 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 backdrop-blur dark:bg-zinc-950/95"
  >
    <button
      class="btn-secondary size-10 p-0"
      aria-label="Leave the lesson"
      onclick={() => (confirmLeave = true)}
    >
      <Icon name="x" />
    </button>
    <div class="flex flex-1 gap-1" aria-label="Question {idx + 1} of {plan.length}">
      {#each plan as _, i (i)}
        {@const a = answers[i]}
        <i
          class="h-2.5 flex-1 rounded-full {a
            ? earned(a)
              ? 'bg-emerald-500'
              : a.correct
                ? 'bg-blue-500'
                : 'bg-red-500'
            : i === idx
              ? 'bg-zinc-400'
              : 'bg-zinc-200 dark:bg-zinc-800'}"
        ></i>
      {/each}
    </div>
  </header>

  <main class="flex-1 px-4 pb-80">
    <div class="mb-1.5 flex items-center gap-2">
      <span class="badge bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        >{FAMILIES[item.family].short} · level {item.level}</span
      >
      {#if isChallenge}<span
          class="badge bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >Challenge</span
        >{/if}
    </div>
    <h1 class="mb-5 text-xl font-bold tracking-tight">{item.prompt}</h1>

    <section class="card flex justify-center overflow-x-auto px-2 py-7">
      <ItemView
        {item}
        hl={lit}
        reveal={phase === 'feedback'
          ? { state: earned(last) ? 'ok' : last.correct ? 'help' : 'bad', answer: item.answer }
          : revealed
            ? { state: 'help', answer: item.answer }
            : null}
        gaps={phase === 'feedback'
          ? 'full'
          : shown.some((s) => s.gaps)
            ? revealed
              ? 'full'
              : 'partial'
            : null}
      />
    </section>

    {#if phase === 'ask'}
      <div class="mt-3.5 grid grid-cols-2 gap-2.5">
        <button
          class="flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition {hinted
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40'
            : 'border-zinc-300 bg-white shadow-[0_2px_0_var(--color-zinc-300)] active:translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_2px_0_var(--color-zinc-700)]'}"
          aria-expanded={hinted}
          onclick={hint}
        >
          <Icon name="bulb" class="size-6 shrink-0 text-amber-500" />
          <span class="flex flex-col leading-tight"
            ><b>Hint</b><small class="hidden text-zinc-500 sm:block dark:text-zinc-400"
              >How to think about it</small
            ></span
          >
        </button>
        <button
          class="flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition disabled:opacity-60 {sol
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
            : 'border-zinc-300 bg-white shadow-[0_2px_0_var(--color-zinc-300)] active:translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_2px_0_var(--color-zinc-700)]'}"
          disabled={sol >= steps.length}
          onclick={nextStep}
        >
          <Icon name="route" class="size-6 shrink-0 text-blue-600 dark:text-blue-400" />
          <span class="flex flex-col leading-tight">
            <b>{!sol ? 'Show solution' : sol >= steps.length ? 'Solution shown' : 'Next step'}</b>
            <small class="hidden text-zinc-500 sm:block dark:text-zinc-400"
              >{!sol
                ? 'Walk me through it'
                : sol >= steps.length
                  ? 'Now try it yourself'
                  : `Step ${sol + 1} of ${steps.length}`}</small
            >
          </span>
        </button>
      </div>
      <p class="mt-2 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {#if sol}
          A question solved with the walkthrough gives no XP and doesn't count towards levelling up,
          but it's how you learn the trick.
        {:else if hinted}
          Using the hint halves the XP for this question (+5).
        {:else}
          Try it yourself first: a right answer with no help earns +10 XP.
        {/if}
      </p>
    {/if}

    {#if hinted && phase === 'ask'}
      {#if sol}
        <section
          class="rise mt-3.5 flex gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          <Icon name="bulb" class="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p><b>Hint:</b> {item.nudge}</p>
        </section>
      {:else}
        <section
          class="rise mt-3.5 rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30"
          aria-label="Hint"
        >
          <h2 class="mb-2.5 flex items-center gap-2 font-bold">
            <Icon name="bulb" class="size-5 text-amber-500" />How to think about it
          </h2>
          <ol
            class="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] marker:font-bold marker:text-amber-500"
          >
            {#each item.think as t (t)}<li>{t}</li>{/each}
          </ol>
          <p
            class="mt-3 rounded-xl border border-dashed border-amber-400 bg-white px-3 py-2.5 text-[15px] dark:bg-zinc-900"
          >
            <b>For this question:</b>
            {item.nudge}
          </p>
        </section>
      {/if}
    {/if}

    {#if sol}
      <section
        class="rise mt-3.5 rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-zinc-900"
        aria-label="Solution"
        aria-live="polite"
        data-guide
      >
        <h2 class="mb-3 flex items-center gap-2 font-bold">
          <Icon name="route" class="size-5 text-blue-600 dark:text-blue-400" />
          {phase === 'feedback' ? "Here's how it works" : "Let's solve it together"}
          <span class="ml-auto text-xs font-normal text-zinc-500"
            >{Math.min(sol, steps.length)} / {steps.length}</span
          >
        </h2>
        <Guide {steps} upto={sol} />
        {#if sol < steps.length}
          <div class="mt-3.5 flex flex-wrap items-center gap-2">
            <button class="btn-help" onclick={nextStep}
              >Next step <Icon name="chev" class="size-4" /></button
            >
            <button class="btn px-3 text-sm text-zinc-500" onclick={() => (sol = steps.length)}
              >Show all steps</button
            >
          </div>
        {:else if phase === 'ask'}
          <p
            class="mt-3.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-[15px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Now type <b class="tabular-nums">{fmt(item.answer)}</b> in the answer box and press
            <b>Check</b>.
          </p>
        {/if}
      </section>
    {/if}
  </main>

  {#if phase === 'ask'}
    <div
      class="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div class="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-4">
        <AnswerInput bind:value={input} onsubmit={() => check()} autofocus={!sol} />
        <button class="btn hidden px-3 text-zinc-500 sm:inline-flex" onclick={() => check(true)}
          >Skip</button
        >
        <button class="btn-primary h-14" disabled={!validAnswer(input)} onclick={() => check()}
          >Check</button
        >
      </div>
    </div>
  {:else}
    {@const state = earned(last) ? 'ok' : last.correct ? 'help' : 'bad'}
    <div
      class="fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)] {state === 'ok'
        ? 'bg-emerald-50 dark:bg-emerald-950'
        : state === 'help'
          ? 'bg-blue-50 dark:bg-blue-950'
          : 'bg-red-50 dark:bg-red-950'}"
      role="status"
    >
      <div class="rise mx-auto max-w-2xl px-4 py-4">
        <div class="mb-2.5 flex items-center gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full text-white {state === 'ok'
              ? 'bg-emerald-600'
              : state === 'help'
                ? 'bg-blue-600'
                : 'bg-red-600'}"><Icon name={last.correct ? 'check' : 'x'} class="size-5" /></span
          >
          <div>
            <p
              class="text-lg font-extrabold {state === 'ok'
                ? 'text-emerald-800 dark:text-emerald-200'
                : state === 'help'
                  ? 'text-blue-700 dark:text-blue-200'
                  : 'text-red-700 dark:text-red-200'}"
            >
              {#if state === 'ok'}{praise}{:else if state === 'help'}That's it. Solved with the
                walkthrough.{:else if last.given === null}Skipped. The answer is {fmt(
                  item.answer,
                )}{:else}Not quite. The answer is {fmt(item.answer)}{/if}
            </p>
            <p class="text-xs text-zinc-600 dark:text-zinc-400">
              {[
                secs(last.ms),
                last.solved ? 'solution used' : last.hinted ? 'hint used' : '',
                xpFor(last) ? `+${xpFor(last)} XP` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        {#if !sol}
          <ul class="mb-3 flex flex-col gap-1 text-sm">
            {#each item.steps as s, i (i)}<li class={i === 0 ? 'font-semibold' : ''}>{s}</li>{/each}
          </ul>
        {/if}
        {#if saveError}<p class="mb-2 text-sm text-red-700 dark:text-red-300" role="alert">
            {saveError}
          </p>{/if}
        <div class="flex gap-2.5">
          {#if !last.correct && sol < steps.length}
            <button class="btn-secondary" onclick={() => (sol = sol ? steps.length : 1)}>
              <Icon name="route" class="size-4" />{sol ? 'Show all steps' : 'Walk me through it'}
            </button>
          {/if}
          <button
            class="{state === 'ok'
              ? 'btn-primary'
              : state === 'help'
                ? 'btn-help'
                : 'btn-bad'} flex-1"
            onclick={next}>{saveError ? 'Try saving again' : 'Continue'}</button
          >
        </div>
      </div>
    </div>
  {/if}
</div>

{#if confirmLeave}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && (confirmLeave = false)}
  >
    <div
      class="rise card w-full max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
    >
      <h2 id="leave-title" class="text-lg font-bold">Leave this lesson?</h2>
      <p class="mt-1.5 text-zinc-600 dark:text-zinc-400">
        The XP you earned is kept, but the lesson won't count towards levelling up.
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-secondary" onclick={() => (confirmLeave = false)}>Keep going</button>
        <button
          class="btn-bad"
          onclick={() => nav.tab(FAMILY_IDS.includes(family as never) ? 'practice' : 'today')}
          >Leave</button
        >
      </div>
    </div>
  </div>
{/if}
