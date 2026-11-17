<script lang="ts">
  import { validAnswer as valid } from '../lib/practice';

  // The answer box: whole numbers only, with a ± key because phone number pads
  // often have no minus sign. Enter submits.
  let {
    value = $bindable(''),
    onsubmit,
    autofocus = true,
  }: { value?: string; onsubmit: () => void; autofocus?: boolean } = $props();
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (autofocus) setTimeout(() => input?.focus({ preventScroll: true }), 30);
  });

  function clean() {
    value = value.replace(/−/g, '-').replace(/[^\d-]/g, '');
  }
</script>

<div
  class="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-zinc-300 bg-zinc-50 pr-1.5 pl-4 focus-within:border-brand-500 dark:border-zinc-700 dark:bg-zinc-950"
>
  <label class="sr-only" for="answer">Your answer</label>
  <input
    id="answer"
    bind:this={input}
    bind:value
    oninput={clean}
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        // this Enter submits; it must not also reach the "Enter = Continue" shortcut
        e.preventDefault();
        e.stopPropagation();
        if (valid(value)) onsubmit();
      }
    }}
    class="!m-0 min-w-0 flex-1 !rounded-none !border-0 !bg-transparent !p-0 text-2xl font-semibold tabular-nums !shadow-none !ring-0"
    inputmode="numeric"
    autocomplete="off"
    enterkeyhint="go"
    placeholder="Your answer"
  />
  <button
    type="button"
    class="size-10 shrink-0 rounded-lg bg-zinc-200 text-lg font-bold dark:bg-zinc-800"
    aria-label="Make it negative or positive"
    onclick={() => {
      value = value.startsWith('-') ? value.slice(1) : '-' + value;
      input?.focus();
    }}>±</button
  >
</div>
