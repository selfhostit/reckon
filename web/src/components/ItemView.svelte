<script lang="ts">
  import { fmt, type Cell, type Item } from '../lib/engine';
  import Icon from './Icon.svelte';

  // The picture of a question. `reveal` fills in the missing number (green when
  // right, red when wrong, blue when shown by the solution); `hl` highlights the
  // boxes the current solution step is about; `gaps` writes the change between
  // neighbours under a series ("partial" hides the ones that touch the gap).
  let {
    item,
    reveal = null,
    hl = new Set<number>(),
    gaps = null,
  }: {
    item: Item;
    reveal?: { state: 'ok' | 'bad' | 'help'; answer: number } | null;
    hl?: Set<number>;
    gaps?: 'partial' | 'full' | null;
  } = $props();

  const v = $derived(item.view);
  const revealClass = $derived(reveal ? `is-${reveal.state}` : '');
  const colors = { ok: 'var(--ok)', bad: 'var(--bad)', help: 'var(--help)' };

  const gapRow = $derived.by(() => {
    if (!gaps || v.kind !== 'series' || !v.diffs || !item.full) return null;
    const full = item.full;
    const miss = v.cells.indexOf(null);
    return full
      .slice(1)
      .map((x, i) => (gaps === 'partial' && (i === miss || i + 1 === miss) ? null : x - full[i]));
  });
</script>

{#snippet box(c: Cell, i: number, extra = '')}
  {#if c === null}
    {#if reveal}
      <div class="bx {extra} {revealClass} {hl.has(i) ? 'hl' : ''}">{fmt(reveal.answer)}</div>
    {:else}
      <div class="bx q {extra} {hl.has(i) ? 'hl' : ''}" aria-label="the missing number">?</div>
    {/if}
  {:else}
    <div class="bx {extra} {hl.has(i) ? 'hl' : ''}">{fmt(c)}</div>
  {/if}
{/snippet}

{#if v.kind === 'series'}
  {@const cols = `grid-template-columns: repeat(${v.cells.length}, minmax(0, 64px))`}
  <div class="flex w-full flex-col items-center">
    <div class="grid w-full max-w-xl justify-center gap-[clamp(4px,1.2vw,10px)]" style={cols}>
      {#each v.cells as c, i (i)}{@render box(c, i)}{/each}
    </div>
    {#if gapRow}
      <div
        class="mt-2 grid w-full max-w-xl justify-center gap-[clamp(4px,1.2vw,10px)] text-center text-xs font-bold tabular-nums"
        style={cols}
        aria-label="change between neighbouring boxes"
      >
        {#each gapRow as d, i (i)}
          <span
            class="translate-x-1/2 {d === null
              ? 'text-zinc-400'
              : 'text-blue-600 dark:text-blue-400'}"
            >{d === null ? '?' : (d >= 0 ? '+' : '−') + Math.abs(d)}</span
          >
        {/each}
        <span></span>
      </div>
    {/if}
  </div>
{:else if v.kind === 'grid'}
  <div class="grid grid-cols-3 gap-2.5" style="width: min(100%, 270px)">
    {#each v.cells.flat() as c, i (i)}{@render box(c, i, 'text-[clamp(17px,4.5vw,26px)]')}{/each}
  </div>
{:else if v.kind === 'plus'}
  <div class="flex flex-wrap justify-center gap-[clamp(14px,4vw,34px)]">
    {#each v.figs as f, k (k)}
      {@const B = k * 5}
      <div class="grid grid-cols-3 gap-1" style="width: clamp(108px, 30vw, 158px)">
        <div></div>
        {@render box(f.outer[0], B, 'rounded-lg text-[clamp(13px,3.2vw,18px)]')}
        <div></div>
        {@render box(f.outer[1], B + 1, 'rounded-lg text-[clamp(13px,3.2vw,18px)]')}
        {@render box(f.centre, B + 4, 'c rounded-lg text-[clamp(13px,3.2vw,18px)]')}
        {@render box(f.outer[2], B + 2, 'rounded-lg text-[clamp(13px,3.2vw,18px)]')}
        <div></div>
        {@render box(f.outer[3], B + 3, 'rounded-lg text-[clamp(13px,3.2vw,18px)]')}
        <div></div>
      </div>
    {/each}
  </div>
{:else if v.kind === 'tri'}
  <div class="flex flex-wrap justify-center gap-[clamp(14px,4vw,34px)]">
    {#each v.figs as f, k (k)}
      {@const B = k * 4}
      {@const lit = [0, 1, 2, 3].some((j) => hl.has(B + j))}
      <svg
        viewBox="0 0 160 150"
        class="w-[clamp(120px,30vw,160px)]"
        role="img"
        aria-label="triangle"
      >
        <path
          d="M80 30 L140 128 L20 128 Z"
          fill={lit ? 'var(--help-soft)' : 'var(--box)'}
          stroke={lit ? 'var(--help)' : 'var(--box-line)'}
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        {#each [[80, 30], [20, 128], [140, 128]] as [x, y], j (j)}
          {@const c = f.outer[j]}
          {@const missing = c === null}
          {@const col = missing
            ? reveal
              ? colors[reveal.state]
              : 'var(--ok)'
            : hl.has(B + j)
              ? 'var(--help)'
              : 'var(--box-line)'}
          <circle
            cx={x}
            cy={y}
            r="17"
            fill={missing
              ? reveal
                ? `var(--${reveal.state}-soft)`
                : 'var(--ok-soft)'
              : hl.has(B + j)
                ? 'var(--help-soft)'
                : 'var(--box)'}
            stroke={col}
            stroke-width="2.5"
            stroke-dasharray={missing && !reveal ? '4 3' : undefined}
          />
          <text
            {x}
            y={y + 6}
            text-anchor="middle"
            font-size="17"
            font-weight="600"
            fill={missing ? col : 'var(--ink)'}
            >{missing ? (reveal ? fmt(reveal.answer) : '?') : fmt(c)}</text
          >
        {/each}
        {#if f.centre === null}
          {@const col = reveal ? colors[reveal.state] : 'var(--ok)'}
          <rect
            x="56"
            y="74"
            width="48"
            height="32"
            rx="8"
            fill={reveal ? `var(--${reveal.state}-soft)` : 'var(--ok-soft)'}
            stroke={col}
            stroke-width="2.5"
            stroke-dasharray={reveal ? undefined : '4 3'}
          />
          <text x="80" y="97" text-anchor="middle" font-size="22" font-weight="600" fill={col}
            >{reveal ? fmt(reveal.answer) : '?'}</text
          >
        {:else}
          <text
            x="80"
            y="98"
            text-anchor="middle"
            font-size="24"
            font-weight="600"
            fill={hl.has(B + 3) ? 'var(--help)' : 'var(--ink)'}>{fmt(f.centre)}</text
          >
        {/if}
      </svg>
    {/each}
  </div>
{:else if v.kind === 'pairs'}
  <div class="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
    {#each v.pairs as [x, y], k (k)}
      <div class="grid grid-cols-[clamp(54px,14vw,70px)_44px_clamp(54px,14vw,70px)] items-center">
        {@render box(x, k * 2)}
        <span class="grid place-items-center text-zinc-400"
          ><Icon name="arrow" class="h-5 w-8" /></span
        >
        {@render box(y, k * 2 + 1)}
      </div>
    {/each}
  </div>
{/if}
