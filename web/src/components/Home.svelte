<script lang="ts">
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import Lesson from './Lesson.svelte';
  import Me from './Me.svelte';
  import MockTest from './MockTest.svelte';
  import Progress from './Progress.svelte';
  import Result from './Result.svelte';
  import Review from './Review.svelte';
  import Skills from './Skills.svelte';
  import TestIntro from './TestIntro.svelte';
  import Today from './Today.svelte';

  // The signed-in app: tabs, each with its own #address so Back works, and the
  // full-screen lesson, test and result on top of them (lib/nav.svelte.ts).
  const tabs: { id: string; label: string; icon: IconName }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'practice', label: 'Practice', icon: 'practice' },
    { id: 'test', label: 'Mock test', icon: 'test' },
    { id: 'progress', label: 'Progress', icon: 'progress' },
    { id: 'me', label: 'Me', icon: 'me' },
  ];

  const fromHash = () => location.hash.slice(1);
  let hash = $state(fromHash());
  const review = $derived(hash.startsWith('review-') ? hash.slice(7) : '');
  const tab = $derived(review ? 'progress' : (tabs.find((t) => t.id === hash)?.id ?? 'today'));

  onMount(() => {
    const onHash = () => {
      hash = fromHash();
      // Back from a lesson or result returns to the tabs
      if (nav.screen.name !== 'tabs') nav.screen = { name: 'tabs' };
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });
</script>

{#if nav.screen.name === 'lesson'}
  {#key nav.screen}<Lesson family={nav.screen.family} />{/key}
{:else if nav.screen.name === 'test'}
  <MockTest mode={nav.screen.mode} />
{:else if nav.screen.name === 'result'}
  {#key nav.screen.id}<Result id={nav.screen.id} />{/key}
{:else}
  <div class="mx-auto min-h-dvh max-w-2xl">
    <main class="flex flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
      {#if review}
        {#key review}<Review id={review} />{/key}
      {:else if tab === 'today'}
        <Today />
      {:else if tab === 'practice'}
        <Skills />
      {:else if tab === 'test'}
        <TestIntro />
      {:else if tab === 'progress'}
        <Progress />
      {:else}
        <Me />
      {/if}
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90"
    >
      <div class="mx-auto grid max-w-2xl grid-cols-5">
        {#each tabs as t (t.id)}
          <a
            href="#{t.id}"
            class="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium {tab === t.id
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-zinc-500'}"
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <Icon name={t.icon} class="size-6" />
            {t.label}
          </a>
        {/each}
      </div>
    </nav>
  </div>
{/if}
