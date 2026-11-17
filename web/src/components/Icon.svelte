<script lang="ts" module>
  // Line icons, drawn on a 24 × 24 grid.
  export const icons = {
    today: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    practice: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7',
    test: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9 2h6',
    progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    flame:
      'M12 2c1 3.5-1.5 5-1.5 7.5 0 1.2.8 2 1.8 2 1.5 0 2.2-1.6 1.7-3.5 2.8 1.7 4.5 4.6 4.5 7.5a6.5 6.5 0 0 1-13 0C5.5 10 12 7.5 12 2z',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z',
    route:
      'M6 21.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5',
    chev: 'M9 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
    play: 'M8 5.5v13l11-6.5z',
    shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
    arrow: 'M2 12h18M14 6l6 6-6 6',
    series: 'M2 8h6v8H2zM9 8h6v8H9zM16 8h6v8h-6z',
    grid: 'M3 3h5v5H3zM10 3h5v5h-5zM17 3h4v5h-4zM3 10h5v5H3zM10 10h5v5h-5zM17 10h4v5h-4zM3 17h5v4H3zM10 17h5v4h-5zM17 17h4v4h-4z',
    shapes: 'M9 2h6v6H9zM2 9h6v6H2zM9 9h6v6H9zM16 9h6v6h-6zM9 16h6v6H9z',
    pairs: 'M2 7h7v10H2zM15 7h7v10h-7zM10.5 12h3M12 10l2 2-2 2',
    mix: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  } as const;
  export type IconName = keyof typeof icons;
</script>

<script lang="ts">
  let {
    name,
    class: cls = 'size-5',
    fill = false,
  }: { name: IconName; class?: string; fill?: boolean } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  class={cls}
  fill={fill ? 'currentColor' : 'none'}
  stroke={fill ? 'none' : 'currentColor'}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={icons[name]} /></svg
>
