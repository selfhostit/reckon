import type { LessonFamily, Mode } from './practice';

// Full-screen moments on top of the tabs: a lesson, a mock test, and the
// result that follows. The tabs themselves have #addresses (Home.svelte).
export type Screen =
  | { name: 'tabs' }
  | { name: 'lesson'; family: LessonFamily }
  | { name: 'test'; mode: Mode }
  | { name: 'result'; id: string };

class Nav {
  screen = $state<Screen>({ name: 'tabs' });

  constructor() {
    // Back closes a lesson, test or result instead of leaving the app
    addEventListener('popstate', () => {
      if (this.screen.name !== 'tabs') this.screen = { name: 'tabs' };
    });
  }

  open(screen: Screen) {
    if (this.screen.name === 'tabs') history.pushState(null, '');
    this.screen = screen;
    scrollTo(0, 0);
  }

  /** Back to the tabs, on the given one. */
  tab(id: string) {
    this.screen = { name: 'tabs' };
    if (location.hash !== `#${id}`) location.hash = id;
    scrollTo(0, 0);
  }
}

export const nav = new Nav();
