<script lang="ts">
  import { FAMILIES, fmt } from '../lib/engine';
  import { errorMessage } from '../lib/pb';
  import { earned, mmss, secs, toMs, type Answer, type SessionSummary } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import Guide from './Guide.svelte';
  import Icon from './Icon.svelte';
  import ItemView from './ItemView.svelte';

  // Every question of a lesson or test, the answer given, and the worked solution.
  let { id }: { id: string } = $props();

  let session = $state<(SessionSummary & { items: Answer[] }) | null>(null);
  let error = $state('');

  $effect(() => {
    practice
      .answers(id)
      .then((s) => (session = s))
      .catch((err) => (error = errorMessage(err, "Couldn't load this session.")));
  });

  const title = (s: SessionSummary) =>
    s.kind === 'test'
      ? s.mode === 'quick'
        ? 'Quick check'
        : 'Full mock test'
      : s.family === 'mix'
        ? 'Mixed lesson'
        : FAMILIES[s.family as keyof typeof FAMILIES].name;
</script>

<header class="flex items-center gap-3">
  <button
    class="btn-secondary size-10 shrink-0 p-0"
    aria-label="Back"
    onclick={() => history.back()}
  >
    <Icon name="back" />
  </button>
  {#if session}
    <div>
      <h1 class="text-xl font-bold tracking-tight">{title(session)}</h1>
      <p class="text-xs text-zinc-500">
        {new Date(toMs(session.started)).toLocaleString()} · {mmss(
          toMs(session.ended) - toMs(session.started),
        )} ·
        {session.result.correct}/{session.result.answered} right{session.kind === 'test'
          ? ` · stanine ${session.result.stanine}`
          : ''}
      </p>
    </div>
  {/if}
</header>

{#if error}
  <p class="card" role="alert">{error}</p>
{:else if !session}
  <p class="card text-zinc-500">Loading…</p>
{:else}
  {#each session.items as a, i (i)}
    {@const state = earned(a) ? 'ok' : a.correct ? 'help' : 'bad'}
    <details class="card overflow-hidden p-0" open={state !== 'ok'}>
      <summary
        class="grid cursor-pointer list-none grid-cols-[30px_1fr_auto] items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden"
      >
        <span
          class="grid size-7 place-items-center rounded-full text-white {state === 'ok'
            ? 'bg-emerald-600'
            : state === 'help'
              ? 'bg-blue-600'
              : 'bg-red-600'}"><Icon name={a.correct ? 'check' : 'x'} class="size-4" /></span
        >
        <span>
          <b>Q{i + 1} · {FAMILIES[a.item.family].short}</b>
          <small class="text-zinc-500">level {a.item.level}</small>
          <small class="block text-zinc-500">
            Your answer: <b class="tabular-nums">{a.given === null ? 'skipped' : fmt(a.given)}</b
            >{#if !a.correct}
              · right answer: <b class="tabular-nums">{fmt(a.item.answer)}</b>{/if}{a.solved
              ? ' · solved with the walkthrough'
              : a.hinted
                ? ' · hint used'
                : ''}
          </small>
        </span>
        <span class="text-sm text-zinc-500 tabular-nums">{secs(a.ms)}</span>
      </summary>
      <div class="flex flex-col gap-4 px-4 pb-5">
        <div
          class="flex justify-center overflow-x-auto rounded-xl border border-zinc-200 px-2 py-5 dark:border-zinc-800"
        >
          <ItemView item={a.item} reveal={{ state, answer: a.item.answer }} gaps="full" />
        </div>
        <Guide steps={a.item.guide} />
      </div>
    </details>
  {/each}
{/if}
