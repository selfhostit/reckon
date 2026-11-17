<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { nextAdaptive, type Item } from '../lib/engine';
  import { showAnswer } from '../lib/demo';
  import { nav } from '../lib/nav.svelte';
  import { errorMessage } from '../lib/pb';
  import {
    MODES,
    levelsAfterTest,
    mmss,
    testResult,
    validAnswer,
    withXp,
    type Answer,
    type Mode,
  } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import AnswerInput from './AnswerInput.svelte';
  import Icon from './Icon.svelte';
  import ItemView from './ItemView.svelte';

  // A timed, adaptive mock test: each question is picked to match the ability
  // shown so far, and there is no feedback or help until the end.
  let { mode }: { mode: Mode } = $props();

  const { n, ms } = untrack(() => MODES[mode]);
  const started = Date.now();
  const deadline = started + ms;
  let answers = $state<Answer[]>([]);
  let item = $state<Item>(nextAdaptive([], []));
  let input = $state('');
  let asked = $state(Date.now());
  let now = $state(Date.now());
  let confirmEnd = $state(false);
  let finishing = $state(false);
  let saveError = $state('');

  const left = $derived(deadline - now);
  const onThis = $derived(now - asked);

  function answer(skip = false) {
    const given = skip || !validAnswer(input) ? null : Number(input.trim());
    answers.push({ item, given, correct: given === item.answer, ms: Date.now() - asked });
    if (answers.length >= n) return finish(false);
    item = nextAdaptive(
      answers.map((a) => ({ b: a.item.b, correct: a.correct })),
      answers.map((a) => a.item),
    );
    input = '';
    asked = Date.now();
    scrollTo(0, 0);
  }

  async function finish(timeout: boolean) {
    if (finishing) return;
    finishing = true;
    saveError = '';
    const result = testResult(answers, timeout);
    const { skills, bumped } = levelsAfterTest(practice.progress, result.theta!);
    result.bumped = bumped;
    try {
      await practice.setProgress({ ...withXp(practice.progress, result.correct * 5), skills });
      const s = await practice.addSession({
        kind: 'test',
        mode,
        started,
        ended: Date.now(),
        items: $state.snapshot(answers) as Answer[],
        result,
      });
      nav.open({ name: 'result', id: s.id });
    } catch (err) {
      saveError = errorMessage(err, "Couldn't save your result.");
      finishing = false;
    }
  }

  $effect(() => showAnswer(item.answer));

  onMount(() => {
    const t = setInterval(() => {
      now = Date.now();
      if (deadline - now <= 0 && !finishing && !saveError) finish(true);
    }, 500);
    return () => clearInterval(t);
  });
</script>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col">
  <header
    class="sticky top-0 z-10 flex items-center gap-3 bg-zinc-50/95 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 backdrop-blur dark:bg-zinc-950/95"
  >
    <button
      class="btn-secondary size-10 p-0"
      aria-label="End the test"
      onclick={() => (confirmEnd = true)}
    >
      <Icon name="x" />
    </button>
    <div class="flex flex-1 gap-1" aria-label="Question {answers.length + 1} of {n}">
      {#each Array(n) as _, i (i)}
        <i
          class="h-2.5 flex-1 rounded-full {i < answers.length
            ? 'bg-zinc-500'
            : i === answers.length
              ? 'bg-zinc-400'
              : 'bg-zinc-200 dark:bg-zinc-800'}"
        ></i>
      {/each}
    </div>
    <span
      class="min-w-19 rounded-lg border px-2.5 py-1.5 text-center font-bold tabular-nums {left <
      3 * 60_000
        ? 'border-red-400 text-red-600 dark:text-red-400'
        : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'}"
      aria-label="Time left">{mmss(left)}</span
    >
  </header>

  <main class="flex-1 px-4 pb-40">
    <div class="mb-1.5 flex items-center">
      <span class="eyebrow">Question {answers.length + 1} of {n}</span>
      <span
        class="ml-auto text-xs tabular-nums {onThis > 120_000 ? 'text-amber-600' : 'text-zinc-500'}"
        >this question {mmss(onThis)}</span
      >
    </div>
    <h1 class="mb-5 text-xl font-bold tracking-tight">{item.prompt}</h1>
    <section class="card flex justify-center overflow-x-auto px-2 py-7">
      <ItemView {item} />
    </section>
    {#if onThis > 120_000}
      <p class="rise mt-3 text-sm text-amber-700 dark:text-amber-300">
        Over two minutes on this one. A good guess and moving on usually scores better.
      </p>
    {/if}
    {#if saveError}
      <p class="mt-3 text-red-700 dark:text-red-300" role="alert">{saveError}</p>
      <button class="btn-primary mt-2" onclick={() => finish(left <= 0)}>Try again</button>
    {/if}
  </main>

  <div
    class="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-900"
  >
    <div class="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-4">
      {#key item.id}<AnswerInput bind:value={input} onsubmit={() => answer()} />{/key}
      <button
        class="btn hidden px-3 text-zinc-500 sm:inline-flex"
        disabled={finishing}
        onclick={() => answer(true)}>Skip</button
      >
      <button
        class="btn-primary h-14"
        disabled={!validAnswer(input) || finishing}
        onclick={() => answer()}>Next</button
      >
    </div>
  </div>
</div>

{#if confirmEnd}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && (confirmEnd = false)}
  >
    <div
      class="rise card w-full max-w-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
    >
      <h2 id="end-title" class="text-lg font-bold">End the test now?</h2>
      <p class="mt-1.5 text-zinc-600 dark:text-zinc-400">
        {#if answers.length}
          Your {answers.length} answer{answers.length === 1 ? '' : 's'} will be scored, but fewer answers
          means a wider margin of error.
        {:else}
          You haven't answered anything yet, so nothing will be saved.
        {/if}
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-secondary" onclick={() => (confirmEnd = false)}>Keep going</button>
        <button
          class="btn-bad"
          onclick={() => {
            confirmEnd = false;
            if (answers.length) finish(false);
            else nav.tab('test');
          }}>End test</button
        >
      </div>
    </div>
  </div>
{/if}
