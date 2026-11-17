<script lang="ts">
  import { pb } from '../lib/pb';
  import { install } from '../lib/install.svelte';
  import { DAILY_GOALS, dayKey } from '../lib/practice';
  import { practice } from '../lib/practice.svelte';
  import { session } from '../lib/session.svelte';
  import Account from './Account.svelte';
  import Notifications from './Notifications.svelte';

  // Settings: the daily goal, the evening streak reminder, the person's data and their account.
  const user = $derived(session.user!);
  let confirmReset = $state(false);
  let busy = $state(false);
  let message = $state('');
  const version = pb
    .send<{ version: string }>('/api/app/info', {})
    .then((i) => i.version)
    .catch(() => '');

  function setGoal(daily_goal: number) {
    practice.setProgress({ ...practice.progress, daily_goal });
  }

  async function download() {
    busy = true;
    message = '';
    try {
      const data = await practice.export();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }),
      );
      a.download = `reckon-${dayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      message = "Couldn't download your data. Please try again.";
    } finally {
      busy = false;
    }
  }

  async function reset() {
    busy = true;
    message = '';
    try {
      await practice.reset();
      message = 'Everything was cleared. Your levels start again from 1.';
    } catch {
      message = "Couldn't clear everything. Please try again.";
    } finally {
      busy = false;
      confirmReset = false;
    }
  }
</script>

<header class="flex items-center justify-between">
  <h1 class="text-2xl font-bold tracking-tight">{user.name || user.email}</h1>
  <button class="btn-secondary px-3 py-2 text-sm" onclick={() => session.logout()}>Sign out</button>
</header>

<section class="card">
  <h2 class="font-bold">Daily goal</h2>
  <p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
    A right answer on your own is 10 XP; one lesson is about 60.
  </p>
  <div class="mt-3 grid grid-cols-3 gap-2">
    {#each DAILY_GOALS as g (g)}
      <button
        class="choice items-center {practice.progress.daily_goal === g ? 'chosen' : ''}"
        aria-pressed={practice.progress.daily_goal === g}
        onclick={() => setGoal(g)}
        ><b>{g} XP</b><small class="text-zinc-500"
          >{g === 20 ? 'Casual' : g === 50 ? 'Regular' : 'Serious'}</small
        ></button
      >
    {/each}
  </div>
</section>

<section class="card flex flex-col gap-3">
  <label class="flex-row items-center justify-between gap-4 text-base font-normal">
    <span>
      <b class="block">Evening reminder</b>
      <span class="text-sm text-zinc-500 dark:text-zinc-400"
        >At 19:00, if you haven't practised yet and your streak would break.</span
      >
    </span>
    <input
      type="checkbox"
      class="shrink-0"
      checked={practice.progress.reminders}
      onchange={(e) =>
        practice.setProgress({ ...practice.progress, reminders: e.currentTarget.checked })}
    />
  </label>
  {#if practice.progress.reminders}
    <p class="text-sm text-zinc-500 dark:text-zinc-400">
      Reminders arrive as notifications: turn them on for this device below.
    </p>
  {/if}
</section>

<Notifications />

{#if install.canPrompt}
  <section class="card flex items-center justify-between gap-4">
    <p>Install Reckon to practise from your home screen.</p>
    <button class="btn-primary shrink-0" onclick={() => install.install()}>Install</button>
  </section>
{:else if install.needsIosSteps}
  <section class="card">
    <p>To install Reckon, tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</p>
  </section>
{/if}

<section class="card flex flex-col gap-3">
  <h2 class="font-bold">Your data</h2>
  <p class="text-sm text-zinc-500 dark:text-zinc-400">
    Your practice is yours alone: nobody else on this server can see it, the owner included. It
    never leaves this server.
  </p>
  <div class="flex flex-wrap gap-2">
    <button class="btn-secondary px-3 py-2 text-sm" disabled={busy} onclick={download}
      >Download it</button
    >
    <button
      class="btn-secondary px-3 py-2 text-sm text-red-600 dark:text-red-400"
      disabled={busy}
      onclick={() => (confirmReset = true)}>Start again</button
    >
  </div>
  {#if confirmReset}
    <div
      class="rise rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
      role="alertdialog"
      aria-labelledby="reset-q"
    >
      <p id="reset-q">
        Delete every lesson and test, and set your levels, XP and streak back to the start? This
        can't be undone.
      </p>
      <div class="mt-3 flex gap-2">
        <button class="btn-bad px-3 py-2 text-sm" disabled={busy} onclick={reset}
          >Delete everything</button
        >
        <button class="btn-secondary px-3 py-2 text-sm" onclick={() => (confirmReset = false)}
          >Cancel</button
        >
      </div>
    </div>
  {/if}
  {#if message}<p class="text-sm" role="status">{message}</p>{/if}
</section>

<Account />

{#await version then v}
  {#if v}<p class="text-center text-xs text-zinc-400">Reckon {v}</p>{/if}
{/await}
