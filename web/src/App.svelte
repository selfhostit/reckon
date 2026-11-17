<script lang="ts">
  import { onMount } from 'svelte';
  import { errorMessage, pb } from './lib/pb';
  import { practice } from './lib/practice.svelte';
  import { session } from './lib/session.svelte';
  import Home from './components/Home.svelte';
  import Login from './components/Login.svelte';
  import People from './components/People.svelte';
  import Setup from './components/Setup.svelte';

  // Signed-out visitors see the setup screen on a new install, the sign-in form otherwise.
  // Anyone already signed in means setup is done.
  let setupNeeded = $state<boolean | null>(session.user ? false : null);
  let error = $state('');
  // screens other than Home have an address like #/people, so Back works
  let route = $state(location.hash);

  async function checkSetup() {
    error = '';
    try {
      setupNeeded = (await pb.send<{ needed: boolean }>('/api/app/setup', {})).needed;
    } catch (err) {
      error = errorMessage(err);
    }
  }

  onMount(() => {
    addEventListener('hashchange', () => (route = location.hash));
    if (session.user) session.refresh();
    else checkSetup();
  });

  // after sign-in, load this person's levels and sessions
  $effect(() => {
    if (session.user && !practice.loaded) practice.load();
  });
</script>

{#if session.user}
  {#if route === '#/people' && session.isOwner}
    <People />
  {:else if practice.error}
    <main class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6">
      <p class="text-center" role="alert">{practice.error}</p>
      <button class="btn-secondary" onclick={() => practice.load()}>Try again</button>
    </main>
  {:else if practice.loaded}
    <Home />
  {/if}
{:else if error}
  <main class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6">
    <p class="text-center" role="alert">{error}</p>
    <button class="btn-secondary" onclick={checkSetup}>Try again</button>
  </main>
{:else if setupNeeded}
  <Setup />
{:else if setupNeeded === false}
  <Login />
{/if}
