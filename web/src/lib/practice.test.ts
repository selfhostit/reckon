import { describe, expect, it } from 'vitest';
import { makeItem } from './engine';
import {
  dayKey,
  familyStats,
  lessonPlan,
  levelAfterLesson,
  levelsAfterTest,
  newProgress,
  recommended,
  streak,
  tally,
  testResult,
  withXp,
  xpFor,
  type Answer,
  type SessionSummary,
} from './practice';

const answer = (correct: boolean, extra: Partial<Answer> = {}): Answer => ({
  item: makeItem('series', 3),
  given: correct ? 1 : 2,
  correct,
  ms: 10_000,
  ...extra,
});

describe('XP', () => {
  it('pays 10 on your own, 5 with the hint and nothing with the solution', () => {
    expect(xpFor(answer(true))).toBe(10);
    expect(xpFor(answer(true, { hinted: true }))).toBe(5);
    expect(xpFor(answer(true, { solved: true }))).toBe(0);
    expect(xpFor(answer(false))).toBe(0);
  });

  it('adds to today and keeps about a year', () => {
    let p = newProgress();
    const day = new Date(2026, 0, 1);
    for (let i = 0; i < 450; i++) {
      p = withXp(p, 10, day);
      day.setDate(day.getDate() + 1);
    }
    expect(p.xp).toBe(4500);
    expect(Object.keys(p.days)).toHaveLength(400);
  });
});

describe('streak', () => {
  const now = new Date(2026, 10, 17, 9);
  it('counts days in a row up to today', () => {
    expect(streak({ '2026-11-15': 10, '2026-11-16': 10, '2026-11-17': 5 }, now)).toBe(3);
  });
  it('still counts up to yesterday before today is done', () => {
    expect(streak({ '2026-11-15': 10, '2026-11-16': 10 }, now)).toBe(2);
  });
  it('breaks on a missed day', () => {
    expect(streak({ '2026-11-14': 10, '2026-11-16': 10 }, now)).toBe(1);
    expect(streak({ '2026-11-15': 10 }, now)).toBe(0);
  });
  it('uses local dates', () => expect(dayKey(now)).toBe('2026-11-17'));
});

describe('levels', () => {
  it('goes up with 6 right, down with 2 or fewer, never past 1-9 or below the minimum', () => {
    expect(levelAfterLesson(3, 1, 6)).toEqual({ level: 4, change: 1 });
    expect(levelAfterLesson(9, 1, 8)).toEqual({ level: 9, change: 0 });
    expect(levelAfterLesson(3, 1, 4)).toEqual({ level: 3, change: 0 });
    expect(levelAfterLesson(3, 1, 2)).toEqual({ level: 2, change: -1 });
    expect(levelAfterLesson(3, 3, 0)).toEqual({ level: 3, change: 0 });
  });

  it('plans a lesson around your level, with a challenge at the end', () => {
    const p = newProgress();
    p.skills.series.level = 5;
    const plan = lessonPlan(p, 'series', (a) => a);
    expect(plan.map((q) => q.level)).toEqual([4, 4, 5, 5, 5, 5, 5, 6]);
    const mix = lessonPlan(p, 'mix', (a) => a);
    expect(new Set(mix.map((q) => q.family)).size).toBe(4);
    // figures start at level 3, so a level-3 warm-up stays at 3
    expect(lessonPlan(newProgress(), 'shapes', (a) => a)[0].level).toBe(3);
  });

  it('raises levels after a strong test but never lowers them', () => {
    const p = newProgress();
    p.skills.grid.level = 8;
    const { skills, bumped } = levelsAfterTest(p, 1.4); // about level 7
    expect(bumped).toBe(true);
    expect(skills.series.level).toBe(6);
    expect(skills.grid.level).toBe(8);
  });
});

describe('stats', () => {
  const session = (started: string, fam: SessionSummary['result']['fam']): SessionSummary => ({
    id: started,
    kind: 'practice',
    family: 'series',
    mode: '',
    level: 1,
    level_after: 1,
    started,
    ended: started,
    result: { correct: 0, answered: 0, fam },
  });

  it('tallies answers per type, counting solved ones as not your own', () => {
    expect(tally([answer(true), answer(true, { solved: true }), answer(false)])).toEqual({
      series: [3, 1, 30_000],
    });
  });

  it('looks at the newest answers first', () => {
    const old = session('2026-01-01 10:00:00.000Z', { grid: [40, 0, 40_000] });
    const recent = session('2026-11-01 10:00:00.000Z', { grid: [40, 40, 400_000] });
    expect(familyStats([old, recent], 'grid')).toEqual({ n: 40, acc: 1, avgMs: 10_000 });
  });

  it('recommends a skill you have barely tried, then your weakest', () => {
    const p = newProgress();
    const s = [
      session('2026-11-01 10:00:00.000Z', {
        series: [10, 9, 1],
        grid: [10, 3, 1],
        shapes: [10, 8, 1],
        pairs: [10, 7, 1],
      }),
    ];
    expect(recommended(p, s)).toBe('grid');
    expect(recommended(p, [])).toBe('series');
  });
});

describe('test results', () => {
  it('scores more right answers on harder questions higher', () => {
    const hard = Array.from({ length: 10 }, () => ({ ...answer(true), item: makeItem('grid', 8) }));
    const easy = Array.from({ length: 10 }, () => ({
      ...answer(false),
      item: makeItem('grid', 2),
    }));
    const strong = testResult(hard, false);
    const weak = testResult(easy, false);
    expect(strong.stanine).toBeGreaterThan(6);
    expect(weak.stanine).toBeLessThan(4);
    expect(strong.lo).toBeLessThanOrEqual(strong.stanine!);
    expect(strong.maxLevel).toBe(8);
    expect(weak.maxLevel).toBe(0);
  });
});
