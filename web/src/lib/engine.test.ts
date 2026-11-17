import { describe, expect, it } from 'vitest';
import {
  FAMILIES,
  estimate,
  fmt,
  makeItem,
  nextAdaptive,
  pCorrect,
  thetaToStanine,
  type Family,
  type Item,
  type Response,
} from './engine';

const families = Object.values(FAMILIES);
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Every visible number of a question, with null for the missing one. */
function cells(it: Item) {
  const v = it.view;
  if (v.kind === 'series') return v.cells;
  if (v.kind === 'grid') return v.cells.flat();
  if (v.kind === 'pairs') return v.pairs.flat();
  return v.figs.flatMap((f) => [...f.outer, f.centre]);
}

/** Works out a sum such as "4 × 6 + 3 = 27" and says whether it is right. */
function sumIsRight(line: string): boolean {
  let l = line.replace(' ✓', '').replace('work backwards: ', '');
  if (l.includes('→')) l = l.split('→')[1];
  if (l.includes('?')) return true; // an equation still to solve
  const [lhs, rhs] = l.split(' = ');
  const expr = lhs
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/÷/g, '/')
    .replace(
      /(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
      (_, b, s: string) => `${b}**${[...s].map((c) => SUP.indexOf(c)).join('')}`,
    );
  expect(expr).toMatch(/^[\d\s+\-*/()]+$/);
  return Function(`return (${expr})`)() === Number(rhs.replace('−', '-'));
}

describe('questions', () => {
  for (const fam of families) {
    for (let level = fam.min; level <= fam.max; level++) {
      it(`${fam.id} level ${level}: whole numbers, one gap, and a solution whose sums add up`, () => {
        for (let n = 0; n < 150; n++) {
          const it = makeItem(fam.id, level);
          const cs = cells(it);
          expect(cs.filter((c) => c === null)).toHaveLength(1);
          for (const c of cs)
            if (c !== null) expect(Number.isInteger(c) && c >= 0 && c <= 5000).toBe(true);
          expect(Number.isInteger(it.answer) && it.answer >= 0).toBe(true);
          expect(it.think.length).toBeGreaterThan(2);
          expect(it.nudge).not.toBe('');
          expect(JSON.stringify(it)).not.toMatch(/undefined|NaN/);
          const last = it.guide[it.guide.length - 1];
          expect(last.final && last.t.includes(fmt(it.answer))).toBe(true);
          for (const step of it.guide) {
            for (const line of step.lines ?? []) expect(sumIsRight(line), line).toBe(true);
            for (const h of step.hl ?? []) expect(h).toBeLessThan(cs.length);
          }
        }
      });
    }
  }

  it('a series shows the gaps under its boxes only when gaps are the pattern', () => {
    for (let n = 0; n < 100; n++) {
      const it = makeItem('series', 1);
      expect(it.view.kind === 'series' && it.view.diffs).toBe(true);
      expect(it.full?.length).toBe(cells(it).length);
    }
  });
});

describe('adaptive scoring', () => {
  it('starts in the middle with a wide margin', () => {
    const e = estimate([]);
    expect(Math.abs(e.theta)).toBeLessThan(0.01);
    expect(e.se).toBeGreaterThan(0.9);
  });

  it('moves up with right answers and down with wrong ones', () => {
    const hard: Response = { b: 1.4, correct: true };
    const easy: Response = { b: -1.4, correct: false };
    expect(estimate([hard, hard]).theta).toBeGreaterThan(0.5);
    expect(estimate([easy, easy]).theta).toBeLessThan(-0.5);
  });

  it('finds a simulated candidate within about one stanine after 15 questions', () => {
    for (const truth of [-1.5, 0, 1.5]) {
      let sq = 0;
      const runs = 60;
      for (let r = 0; r < runs; r++) {
        const responses: Response[] = [];
        const history: { family: Family }[] = [];
        for (let q = 0; q < 15; q++) {
          const it = nextAdaptive(responses, history);
          history.push(it);
          responses.push({ b: it.b, correct: Math.random() < pCorrect(truth, it.b) });
        }
        sq += (estimate(responses).theta - truth) ** 2;
      }
      // 0.6 on this scale is 1.2 stanines
      expect(Math.sqrt(sq / runs)).toBeLessThan(0.6);
    }
  });

  it('asks for every question type in turn', () => {
    const history: { family: Family }[] = [];
    for (let q = 0; q < 8; q++) history.push(nextAdaptive([], history));
    expect(new Set(history.map((h) => h.family)).size).toBe(4);
  });

  it('maps ability to the 1-9 stanine scale', () => {
    expect(thetaToStanine(0)).toBe(5);
    expect(thetaToStanine(-5)).toBe(1);
    expect(thetaToStanine(5)).toBe(9);
  });
});
