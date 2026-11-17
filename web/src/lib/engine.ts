/* The question engine: generators for four kinds of numerical reasoning
   question at levels 1-9, their plain-language help, and adaptive scoring
   (a 2PL item response model with an EAP ability estimate). It has no
   dependencies, so it is tested on its own (engine.test.ts). */

export type Family = 'series' | 'grid' | 'shapes' | 'pairs';
export type Cell = number | null;
type Sym = number | string;
export type View =
  | { kind: 'series'; cells: Cell[]; diffs: boolean }
  | { kind: 'grid'; cells: Cell[][] }
  | { kind: 'plus' | 'tri'; figs: { outer: Cell[]; centre: Cell }[] }
  | { kind: 'pairs'; pairs: Cell[][] };
/** One step of a solution walkthrough. `hl` are cell indexes to highlight (see below). */
export interface GuideStep {
  t: string;
  lines?: string[];
  hl?: number[];
  gaps?: boolean;
  reveal?: boolean;
  final?: boolean;
}
export interface Item {
  id: string;
  family: Family;
  level: number;
  /** difficulty on the ability scale */
  b: number;
  prompt: string;
  view: View;
  answer: number;
  /** the whole series, missing number included (series only) */
  full?: number[];
  rule: string;
  /** how to think about this kind of question (the hint, part 1) */
  think: string[];
  /** a pointer for this question that doesn't give the answer away (the hint, part 2) */
  nudge: string;
  guide: GuideStep[];
  /** a short version of the guide, for feedback */
  steps: string[];
}
export interface Response {
  b: number;
  correct: boolean;
}
type Range = [number, number];
interface Op {
  t: string;
  f: (v: number) => number;
}
interface Seq {
  seq: number[];
  free: number[];
  uses: (i: number) => number[];
  how: (i: number) => string;
  interleaved?: boolean;
}
type SeriesKind = 'gaps' | 'ratio' | 'alt' | 'inter' | 'recur' | 'known';
type SeriesRule = Seq & { kind: SeriesKind; rule: string; nudge: string };
interface GridRule {
  id: string;
  f?: (a: number, b: number, k: number) => number;
  e?: (a: Sym, b: Sym, k: number) => string;
  say?: string | ((k: number) => string);
  nudge?: string;
  ra?: Range;
  rb?: Range;
  k?: boolean;
  kr?: Range;
}
interface ShapeRule {
  k: 'plus' | 'tri';
  f: (...v: number[]) => number;
  e: (...v: Sym[]) => string;
  say: string;
  nudge: string;
  rng: Range;
  ok?: (v: number) => boolean;
}
interface PairsRule {
  f: (x: number, k: number) => number;
  e: (x: Sym, k: number) => string;
  say: (k: number) => string;
  nudge: string;
  xr: Range;
  kr?: Range;
}

/* Reckon engine: item generators (levels 1-9), plain-language help, adaptive scoring (2PL IRT, EAP).
 Framework-free so it can move into a Svelte/plasto app unchanged.

 Every item carries:
   answer          the missing number
   think[]         "how to think about this type" (hint, part 1)
   nudge           a pointer for this specific question that does not give the answer away (hint, part 2)
   guide[]         step-by-step solution: { t: text, lines?: [worked sums], hl?: [cell indexes], gaps?: bool, reveal?: bool }
   steps[]         short text version of the guide (used in feedback and review)
 Cell indexes for highlights:
   series i | grid r*3+c | plus figure f: outer j -> f*5+j (top,left,right,bottom), centre f*5+4
   tri figure f: corner j -> f*4+j (top,left,right), centre f*4+3 | pairs p: input p*2, output p*2+1 */
const R = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = <T>(arr: readonly T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = R(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const distinct = (n: number, lo: number, hi: number): number[] => {
  const s = new Set<number>();
  let guard = 0;
  while (s.size < n && guard++ < 500) s.add(R(lo, hi));
  return [...s];
};
const X = '×',
  M = '−';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: Sym): string =>
  String(n)
    .split('')
    .map((d) => SUP[+d] ?? d)
    .join('');
export const fmt = (n: number): string => (n < 0 ? M + Math.abs(n) : String(n));
export const LEVEL_B = (lvl: number): number => (lvl - 5) * 0.7; // item difficulty on the ability (logit) scale
const range = (a: number, b: number): number[] =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ================= SERIES ================= */
// Building blocks. Each returns { seq, how(i): plain sum for box i, uses(i): boxes it is built from, free: boxes that are free starting values }.
const op = (t: string, f: (v: number) => number): Op => ({ t, f });
const add = (d: number): Op =>
  d >= 0 ? op('+ ' + d, (v) => v + d) : op(M + ' ' + -d, (v) => v + d);
const mul = (k: number): Op => op(X + ' ' + k, (v) => v * k);
const div = (k: number): Op => op('÷ ' + k, (v) => v / k);
function chain(a: number, ops: Op[]): Seq {
  const s = [a];
  ops.forEach((o) => s.push(o.f(s[s.length - 1])));
  return {
    seq: s,
    free: [0],
    uses: (i) => [i - 1],
    how: (i) => `${fmt(s[i - 1])} ${ops[i - 1].t} = ${fmt(s[i])}`,
  };
}
function formula(
  n0: number,
  len: number,
  f: (n: number) => number,
  txt: (n: number) => string,
): Seq {
  const s = range(0, len - 1).map((i) => f(n0 + i));
  return { seq: s, free: [], uses: () => [], how: (i) => `${txt(n0 + i)} = ${fmt(s[i])}` };
}
function recur(
  init: number[],
  len: number,
  f: (p: number[]) => number,
  txt: (p: number[]) => string,
): Seq {
  // txt(prev terms array) -> expression text
  const k = init.length,
    s = init.slice();
  while (s.length < len) s.push(f(s.slice(-k)));
  return {
    seq: s,
    free: range(0, k - 1),
    uses: (i) => range(i - k, i - 1),
    how: (i) => `${txt(s.slice(i - k, i))} = ${fmt(s[i])}`,
  };
}
function interleave(c1: Seq, c2: Seq): Seq {
  const s: number[] = [];
  const n = c1.seq.length + c2.seq.length;
  for (let i = 0; i < n; i++) s.push(i % 2 ? c2.seq[(i - 1) / 2] : c1.seq[i / 2]);
  const map = (i: number): [Seq, number, number] => (i % 2 ? [c2, (i - 1) / 2, 1] : [c1, i / 2, 0]);
  return {
    seq: s,
    interleaved: true,
    free: [...c1.free.map((j) => 2 * j), ...c2.free.map((j) => 2 * j + 1)],
    uses: (i) => {
      const [c, j, o] = map(i);
      return c.uses(j).map((u) => 2 * u + o);
    },
    how: (i) => {
      const [c, j] = map(i);
      return c.how(j);
    },
  };
}
const rep = (n: number, o: Op): Op[] => Array(n).fill(o);
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
const FIB = [1, 1, 2, 3, 5, 8, 13, 21];
const tri = (n: number) => (n * (n + 1)) / 2;
const sq = (n: number) => `${n} ${X} ${n}`;
const cube = (n: number) => `${n} ${X} ${n} ${X} ${n}`;
const sgnTxt = (c: number) => (c > 0 ? '+ ' + c : M + ' ' + -c);

// kind: what to look at first (drives the first solution step)
// gaps = change between neighbours, ratio = multiplying, alt = operations take turns,
// inter = two series mixed, recur = built from earlier boxes, known = a familiar series
const sr = (s: Seq, m: { kind: SeriesKind; rule: string; nudge: string }): SeriesRule => ({
  ...s,
  ...m,
});
const S: Record<number, (() => SeriesRule)[]> = {};
S[1] = [
  () => {
    const d = R(2, 9);
    return sr(chain(R(1, 20), rep(5, add(d))), {
      kind: 'gaps',
      rule: `Add ${d} each time.`,
      nudge: 'The numbers climb slowly and evenly. By how much each step?',
    });
  },
  () => {
    const d = R(2, 9);
    return sr(chain(R(55, 99), rep(5, add(-d))), {
      kind: 'gaps',
      rule: `Take away ${d} each time.`,
      nudge: 'The numbers go down evenly. By how much each step?',
    });
  },
];
S[2] = [
  () =>
    sr(chain(R(1, 7), rep(5, mul(2))), {
      kind: 'ratio',
      rule: 'Double the number each time (× 2).',
      nudge: 'Each jump is bigger than the last one. Compare each number with the one before it.',
    }),
  () => {
    const d = R(11, 19);
    return sr(chain(R(10, 60), rep(5, add(d))), {
      kind: 'gaps',
      rule: `Add ${d} each time.`,
      nudge: 'The steps are bigger, but still even.',
    });
  },
  () => {
    const s0 = R(1, 3);
    return sr(
      chain(
        R(1, 12),
        range(0, 4).map((i) => add(s0 + i)),
      ),
      {
        kind: 'gaps',
        rule: `The amount added goes up by 1 each time: +${s0}, +${s0 + 1}, +${s0 + 2}, …`,
        nudge:
          'Write the change between neighbours under the boxes. Do the changes themselves follow a pattern?',
      },
    );
  },
];
S[3] = [
  () => {
    const d0 = R(1, 5),
      inc = R(2, 4);
    return sr(
      chain(
        R(1, 15),
        range(0, 4).map((i) => add(d0 + inc * i)),
      ),
      {
        kind: 'gaps',
        rule: `The amount added goes up by ${inc} each time: +${d0}, +${d0 + inc}, +${d0 + 2 * inc}, …`,
        nudge: 'Write the change between neighbours. The changes grow in a regular way.',
      },
    );
  },
  () =>
    sr(chain(R(1, 4), rep(5, mul(3))), {
      kind: 'ratio',
      rule: 'Multiply by 3 each time.',
      nudge: 'The numbers grow very fast. Try dividing each number by the one before it.',
    }),
  () =>
    sr(chain(R(1, 5) * 64, rep(5, div(2))), {
      kind: 'ratio',
      rule: 'Halve the number each time (÷ 2).',
      nudge: 'The numbers shrink quickly. Each one is a simple fraction of the one before.',
    }),
  () => {
    const p = R(4, 9),
      q = R(1, p - 1);
    return sr(
      chain(
        R(5, 20),
        range(0, 5).map((i) => (i % 2 ? add(-q) : add(p))),
      ),
      {
        kind: 'alt',
        rule: `Two steps take turns: add ${p}, then take away ${q}, again and again.`,
        nudge:
          'It goes up, then down, then up… Look at the up-steps and the down-steps separately.',
      },
    );
  },
];
S[4] = [
  () => {
    const d1 = R(2, 6),
      d2 = pick([-1, -2, -3, 2, 3, 4]);
    return sr(interleave(chain(R(1, 10), rep(3, add(d1))), chain(R(20, 40), rep(3, add(d2)))), {
      kind: 'inter',
      rule: `Two series are mixed together. Boxes 1, 3, 5, 7 go ${sgnTxt(d1)} each time; boxes 2, 4, 6, 8 go ${sgnTxt(d2)} each time.`,
      nudge: 'Small and large numbers alternate. Read every other box on its own.',
    });
  },
  () => {
    const k = R(1, 4);
    return sr(
      chain(
        R(1, 5),
        range(0, 4).map((i) => (i % 2 ? mul(2) : add(k))),
      ),
      {
        kind: 'alt',
        rule: `Two steps take turns: add ${k}, then double, again and again.`,
        nudge:
          'The jumps are uneven: small, big, small, big. Maybe two different operations take turns.',
      },
    );
  },
  () => {
    const c = pick([1, -1, 2, 3]);
    const o = op(`${X} 2 ${sgnTxt(c)}`, (v) => 2 * v + c);
    return sr(chain(R(1, 5), rep(5, o)), {
      kind: 'ratio',
      rule: `Double the number, then ${c > 0 ? 'add ' + c : 'take away ' + -c}.`,
      nudge:
        'Each number is roughly double the one before, but not exactly. What is left over each time?',
    });
  },
  () =>
    sr(
      formula(R(2, 6), 6, (n) => n * n, sq),
      {
        kind: 'known',
        rule: 'These are square numbers: a number times itself (2 × 2, 3 × 3, 4 × 4, …).',
        nudge: 'These numbers might look familiar from the multiplication tables.',
      },
    ),
];
S[5] = [
  () => {
    const a = R(1, 5);
    return sr(
      recur(
        [a, R(a, 8)],
        7,
        (p) => p[0] + p[1],
        (p) => `${p[0]} + ${p[1]}`,
      ),
      {
        kind: 'recur',
        rule: 'Each number is the two numbers before it added together.',
        nudge: 'Look at three boxes in a row. Can you make the third from the first two?',
      },
    );
  },
  () => {
    const c = pick([-1, 1, 2, 3, -2]);
    const n0 = c < 0 ? R(2, 5) : R(1, 5);
    return sr(
      formula(
        n0,
        6,
        (n) => n * n + c,
        (n) => `${sq(n)} ${sgnTxt(c)}`,
      ),
      {
        kind: 'known',
        rule: `Square numbers ${c > 0 ? 'plus ' + c : 'minus ' + -c}: take a number times itself, then ${c > 0 ? 'add ' + c : 'take away ' + -c}.`,
        nudge:
          'Each number sits just next to a well-known number from the times tables (4, 9, 16, 25, …).',
      },
    );
  },
  () => {
    const d = R(1, 4);
    return sr(
      chain(
        R(1, 15),
        range(0, 4).map((i) => add(d * 2 ** i)),
      ),
      {
        kind: 'gaps',
        rule: `The amount added doubles each time: +${d}, +${2 * d}, +${4 * d}, …`,
        nudge:
          'Write the change between neighbours. How does each change relate to the one before?',
      },
    );
  },
  () => {
    const k = R(1, 5);
    return sr(
      chain(
        R(2, 4),
        range(0, 4).map((i) => (i % 2 ? add(-k) : mul(3))),
      ),
      {
        kind: 'alt',
        rule: `Two steps take turns: multiply by 3, then take away ${k}.`,
        nudge: 'Big jump, small drop, big jump… Two operations take turns.',
      },
    );
  },
  () =>
    sr(
      formula(R(1, 4), 6, (n) => n ** 3, cube),
      {
        kind: 'known',
        rule: 'These are cube numbers: a number times itself, times itself again (2 × 2 × 2, 3 × 3 × 3, …).',
        nudge:
          'Fast growth from small numbers. Think of a number multiplied by itself more than once.',
      },
    ),
];
S[6] = [
  () => {
    const d = R(2, 7);
    return sr(interleave(chain(R(1, 4), rep(3, mul(2))), chain(R(3, 20), rep(3, add(d)))), {
      kind: 'inter',
      rule: `Two series are mixed together. Boxes 1, 3, 5, 7 double each time; boxes 2, 4, 6, 8 go up by ${d}.`,
      nudge: 'The numbers jump around. Read every other box on its own.',
    });
  },
  () =>
    sr(
      chain(
        R(1, 5),
        range(0, 4).map((i) => op(`${X} 2 + ${i + 1}`, (v) => 2 * v + i + 1)),
      ),
      {
        kind: 'ratio',
        rule: 'Double the number, then add 1, then 2, then 3, … (one more each time).',
        nudge:
          'Each number is a little more than double the one before. Is that "little more" changing?',
      },
    ),
  () => {
    const k = R(1, 2);
    return sr(
      chain(
        R(1, 20),
        range(0, 4).map((i) => add((k + i) ** 2)),
      ),
      {
        kind: 'gaps',
        rule: `The amounts added are square numbers: ${range(k, k + 4)
          .map((n) => n * n)
          .join(', ')}.`,
        nudge: 'Write the change between neighbours. Do those changes look familiar?',
      },
    );
  },
  () =>
    sr(
      chain(
        R(1, 3),
        range(1, 5).map((k) => mul(k)),
      ),
      {
        kind: 'ratio',
        rule: 'Multiply by 1, then by 2, then by 3, then by 4, …',
        nudge: 'Divide each number by the one before it. The result changes, but in a simple way.',
      },
    ),
  () => {
    const d0 = R(1, 3);
    return sr(
      chain(
        R(30, 60),
        range(1, 5).map((i) => add(-d0 * i)),
      ),
      {
        kind: 'gaps',
        rule: `Take away ${d0}, then ${2 * d0}, then ${3 * d0}, … (the drop grows by ${d0} each time).`,
        nudge: 'The numbers fall faster and faster. Write the drops under the boxes.',
      },
    );
  },
];
S[7] = [
  () => {
    const s0 = R(0, 2);
    return sr(
      chain(
        R(1, 20),
        range(0, 4).map((i) => add(PRIMES[s0 + i])),
      ),
      {
        kind: 'gaps',
        rule: `The amounts added are prime numbers in order: ${PRIMES.slice(s0, s0 + 5).join(', ')}.`,
        nudge: 'Write the change between neighbours. Those changes are a famous list of numbers.',
      },
    );
  },
  () => {
    const p = R(2, 6),
      q = R(1, 5);
    const ops = [add(p), mul(2), add(-q)];
    return sr(
      chain(
        R(1, 6),
        range(0, 6).map((i) => ops[i % 3]),
      ),
      {
        kind: 'alt',
        rule: `Three steps repeat in a cycle: add ${p}, double, take away ${q}, then start again.`,
        nudge: 'No single step works. The pattern may repeat every three steps.',
      },
    );
  },
  () => {
    const s0 = R(1, 3);
    return sr(
      chain(
        R(1, 15),
        range(0, 4).map((i) => add(tri(s0 + i))),
      ),
      {
        kind: 'gaps',
        rule: `The amounts added are ${range(0, 4)
          .map((i) => tri(s0 + i))
          .join(
            ', ',
          )}, and those go up by ${s0 + 1}, ${s0 + 2}, ${s0 + 3}, … (a pattern inside the pattern).`,
        nudge: 'Write the changes between neighbours, then the changes between those changes.',
      },
    );
  },
  () =>
    sr(
      recur(
        [R(1, 2), R(1, 3), R(2, 4)],
        7,
        (p) => p[0] + p[1] + p[2],
        (p) => p.join(' + '),
      ),
      {
        kind: 'recur',
        rule: 'Each number is the three numbers before it added together.',
        nudge: 'Adding the two previous numbers is not quite enough. Try more of them.',
      },
    ),
  () => {
    const k = R(1, 3);
    return sr(
      chain(
        R(3, 5),
        range(1, 5).map((i) => op(`${X} 2 ${M} ${k * i}`, (v) => 2 * v - k * i)),
      ),
      {
        kind: 'ratio',
        rule: `Double the number, then take away ${k}, then ${2 * k}, then ${3 * k}, … (more each time).`,
        nudge: 'Each number is a bit less than double the one before. Is the shortfall changing?',
      },
    );
  },
];
S[8] = [
  () =>
    sr(
      recur(
        [R(1, 3), R(2, 3)],
        6,
        (p) => p[0] * p[1],
        (p) => `${p[0]} ${X} ${p[1]}`,
      ),
      {
        kind: 'recur',
        rule: 'Each number is the two numbers before it multiplied together.',
        nudge:
          'Look at three boxes in a row. The third is built from the first two, but not by adding.',
      },
    ),
  () =>
    sr(
      formula(
        R(1, 6),
        6,
        (n) => n * (n + 1),
        (n) => `${n} ${X} ${n + 1}`,
      ),
      {
        kind: 'known',
        rule: 'Each number is a number times the next number up: 2 × 3, 3 × 4, 4 × 5, …',
        nudge: 'Try to split each number into two factors that sit next to each other.',
      },
    ),
  () => {
    const off = R(0, 2);
    return sr(
      chain(
        R(1, 10),
        range(0, 4).map((i) => add(FIB[off + i])),
      ),
      {
        kind: 'gaps',
        rule: `The amounts added are ${FIB.slice(off, off + 5).join(', ')}: each one is the two before it added together.`,
        nudge:
          'Write the changes between neighbours. How is each change made from earlier changes?',
      },
    );
  },
  () => {
    const n0 = R(2, 5);
    return sr(
      interleave(
        formula(n0, 4, (n) => n * n, sq),
        chain(R(1, 3), rep(3, mul(3))),
      ),
      {
        kind: 'inter',
        rule: `Two series are mixed together. Boxes 1, 3, 5, 7 are square numbers (${n0} × ${n0}, ${n0 + 1} × ${n0 + 1}, …); boxes 2, 4, 6, 8 multiply by 3.`,
        nudge: 'Read every other box on its own. Each half is a series you know.',
      },
    );
  },
  () => {
    const k = pick([-1, 1, 2]);
    return sr(
      recur(
        [R(1, 4), R(2, 5)],
        7,
        (p) => p[0] + p[1] + k,
        (p) => `${p[0]} + ${p[1]} ${sgnTxt(k)}`,
      ),
      {
        kind: 'recur',
        rule: `Add the two numbers before it, then ${k > 0 ? 'add ' + k : 'take away ' + -k}.`,
        nudge: 'Adding the two previous numbers almost works. What is the small difference?',
      },
    );
  },
];
S[9] = [
  () => {
    let d = R(2, 4);
    const ops = [];
    for (let i = 0; i < 5; i++) {
      ops.push(add(d));
      d = 2 * d - 1;
    }
    return sr(chain(R(1, 10), ops), {
      kind: 'gaps',
      rule: `The amounts added follow their own rule: each one is double the previous one, minus 1 (${ops.map((o) => o.t.replace('+ ', '')).join(', ')}).`,
      nudge:
        'Write the changes between neighbours. How is each change made from the one before it?',
    });
  },
  () =>
    sr(
      recur(
        [1, R(2, 4)],
        6,
        (p) => 3 * p[1] - p[0],
        (p) => `3 ${X} ${p[1]} ${M} ${p[0]}`,
      ),
      {
        kind: 'recur',
        rule: 'Each number is 3 times the number before it, minus the number before that.',
        nudge:
          'Each number is close to 3 times the previous one. Compare the shortfall with earlier boxes.',
      },
    ),
  () =>
    sr(
      chain(
        R(2, 4),
        range(0, 5).map((i) => (i % 2 ? add(-(i + 1) / 2) : mul(3))),
      ),
      {
        kind: 'alt',
        rule: 'Two steps take turns: multiply by 3, then take away 1, 2, 3, … (one more each time).',
        nudge: 'Big jumps and small drops take turns, and the drops are not all the same.',
      },
    ),
  () =>
    sr(
      formula(
        R(1, 5),
        6,
        (n) => n * n * (n + 1),
        (n) => `${n} ${X} ${n} ${X} ${n + 1}`,
      ),
      {
        kind: 'known',
        rule: 'Each number is a square number times the next number up: 2 × 2 × 3, 3 × 3 × 4, …',
        nudge: 'Break each number into factors. A square number is hiding in each one.',
      },
    ),
  () => {
    const d = R(3, 7);
    const a = R(1, 3);
    return sr(
      interleave(
        recur(
          [a, R(2, 5)],
          5,
          (p) => p[0] + p[1],
          (p) => `${p[0]} + ${p[1]}`,
        ),
        chain(50, rep(3, add(-d))),
      ),
      {
        kind: 'inter',
        rule: `Two series are mixed together. In boxes 1, 3, 5, 7, 9 each number is the two before it (in that series) added together; boxes 2, 4, 6, 8 go down by ${d}.`,
        nudge:
          'Read every other box on its own. One half goes down steadily; the other builds on itself.',
      },
    );
  },
];

export const THINK: Record<'series' | 'grid' | 'plus' | 'tri' | 'pairs', string[]> = {
  series: [
    'Read the row from left to right. Is it going up or down? Slowly or quickly?',
    'Slow, even steps usually mean adding or taking away. Very fast growth usually means multiplying.',
    'Write the change between each pair of neighbours under the boxes. The pattern is often hiding in those changes.',
    'If the numbers jump up and down, read every other box on its own: two series may be mixed together.',
  ],
  grid: [
    'Think of each row as a little sum: the first two numbers are combined to make the third.',
    'Pick a row with no ? and try the simplest ideas first: add, take away, multiply.',
    'Whatever you find must work for every complete row. If no row rule works, try the columns instead.',
    'Then use the same rule on the row with the ?.',
  ],
  plus: [
    'Every figure follows the same recipe: the four outer numbers are combined to make the centre.',
    'Start with a complete figure. Add all four outer numbers first. Is the centre bigger or smaller than that?',
    'If adding is too small, some numbers are probably multiplied. Try pairing opposite boxes: top with bottom, left with right.',
    'Check your idea on the second figure, then use it on the figure with the ?.',
  ],
  tri: [
    'Every triangle follows the same recipe: the three corners are combined to make the number in the middle.',
    'Start with a complete triangle. Add the corners first. Is the middle bigger or smaller than that?',
    'If adding is too small, try multiplying two of the corners and then adding or taking away the third.',
    'Check your idea on the other triangle, then use it on the one with the ?.',
  ],
  pairs: [
    'Each left number goes through the same hidden "machine" and comes out as the right number.',
    'Compare sizes: if outputs are a bit bigger, think adding. About double or triple, think multiplying. Growing much faster, think squaring (a number times itself).',
    'Test your idea on every pair, not just the first one. Many ideas work once, but only one works for all.',
    'Then put the last number through the same machine.',
  ],
};
const BACKWARDS =
  'Here the ? is one of the starting numbers, not the result. Find the rule first, then work backwards: which number would make the rule come out right?';

function genSeries(level: number): Omit<Item, 'id' | 'b' | 'prompt'> {
  let r: SeriesRule | null = null,
    g = 0;
  while (!r && g++ < 50) {
    r = pick(S[level])();
    if (r && r.seq.some((v) => v < 0 || v > 5000 || !Number.isInteger(v))) r = null;
  }
  if (!r) throw new Error(`no series at level ${level}`);
  const rr: SeriesRule = r;
  const s = rr.seq,
    n = s.length;
  const allowed = range(0, n - 1).filter((i) => !rr.free.includes(i));
  let miss;
  if (level <= 3) miss = n - 1;
  else if (level <= 6)
    miss =
      Math.random() < 0.6
        ? n - 1
        : pick(allowed.filter((i) => i >= 2 && i <= n - 2).concat([n - 1]));
  else miss = pick(allowed.filter((i) => i >= 2));
  const answer = s[miss];
  const cells = s.map((v, i) => (i === miss ? null : v));

  // Solution guide
  const known = (i: number) => i !== miss && !rr.uses(i).includes(miss);
  const examples = allowed.filter((i) => known(i)).slice(0, 3);
  const guide: GuideStep[] = [];
  const first = (
    {
      gaps: 'Compare each box with the one before it. Write down how much it changes:',
      ratio:
        'The numbers change by more and more, so compare each box with the one before it using multiplication:',
      alt: 'Write down how you get from each box to the next one:',
      inter: 'The row jumps around, so read every other box on its own:',
      recur: 'Look at three boxes in a row and see how the last one is made from the earlier ones:',
      known: 'Compare each box with numbers you know from the times tables:',
    } as Record<SeriesKind, string>
  )[rr.kind];
  guide.push({
    t: first,
    lines: examples.map((i) => rr.how(i)),
    hl: [...new Set(examples.flatMap((i) => [...rr.uses(i), i]))],
    gaps: rr.kind === 'gaps',
  });
  guide.push({ t: 'So the pattern is: ' + lower(rr.rule), hl: [] });
  guide.push({
    t: 'Use the pattern for the ? box:',
    lines: [rr.how(miss)],
    hl: [...rr.uses(miss), miss],
    reveal: true,
  });
  const after = range(miss + 1, n - 1).find((j) => rr.uses(j).includes(miss));
  if (after !== undefined)
    guide.push({
      t: 'Check: the next box in the pattern works too.',
      lines: [rr.how(after) + ' ✓'],
      hl: [...rr.uses(after), after],
      reveal: true,
    });
  guide.push({
    t: `So the missing number is ${fmt(answer)}.`,
    hl: [miss],
    reveal: true,
    final: true,
  });

  return {
    family: 'series',
    level,
    view: { kind: 'series', cells, diffs: rr.kind === 'gaps' },
    answer,
    full: s,
    rule: rr.rule,
    think: THINK.series,
    nudge: rr.nudge,
    guide,
    steps: [rr.rule, `${rr.how(miss)}, so the missing number is ${fmt(answer)}.`],
  };
}
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/* ================= FORMULA RULES: grids ================= */
// f: rule, e: sum with numbers, say: plain words, nudge: pointer without the answer
const G: Record<number, GridRule[]> = {
  2: [
    {
      id: 'add',
      f: (a, b) => a + b,
      e: (a, b) => `${a} + ${b}`,
      say: 'add the first two numbers',
      nudge: 'The third number is about the size of the first two together.',
      ra: [1, 25],
      rb: [1, 25],
    },
    { id: 'rowsum' },
  ],
  3: [
    {
      id: 'sub',
      f: (a, b) => a - b,
      e: (a, b) => `${a} ${M} ${b}`,
      say: 'take the second number away from the first',
      nudge: 'The third number is smaller than the first one. Something is being taken away.',
      ra: [12, 50],
      rb: [1, 11],
    },
    {
      id: 'add2',
      f: (a, b) => a + b,
      e: (a, b) => `${a} + ${b}`,
      say: 'add the first two numbers',
      nudge: 'The third number is about the size of the first two together.',
      ra: [15, 70],
      rb: [15, 70],
    },
  ],
  4: [
    {
      id: 'mul',
      f: (a, b) => a * b,
      e: (a, b) => `${a} ${X} ${b}`,
      say: 'multiply the first two numbers',
      nudge: 'The third number is much bigger than the first two. Think multiplication.',
      ra: [2, 9],
      rb: [2, 9],
    },
    { id: 'colsum' },
    {
      id: 'a2b',
      f: (a, b) => a + 2 * b,
      e: (a, b) => `${a} + 2 ${X} ${b}`,
      say: 'add the first number to double the second',
      nudge:
        'Adding the first two gets close but falls short. One of the numbers seems to count twice.',
      ra: [1, 20],
      rb: [1, 12],
    },
  ],
  5: [
    {
      id: 'sumx2',
      f: (a, b) => (a + b) * 2,
      e: (a, b) => `(${a} + ${b}) ${X} 2`,
      say: 'add the first two numbers, then double the total',
      nudge: 'Add the first two numbers and compare that total with the third number.',
      ra: [1, 15],
      rb: [1, 15],
    },
    {
      id: 'mulk',
      k: true,
      f: (a, b, k) => a * b + k,
      e: (a, b, k) => `${a} ${X} ${b} + ${k}`,
      say: (k) => `multiply the first two numbers, then add ${k}`,
      nudge: 'Multiplying gets very close. Look at what is left over: it is the same in every row.',
      ra: [2, 9],
      rb: [2, 9],
    },
    {
      id: 'addk',
      k: true,
      f: (a, b, k) => a + b + k,
      e: (a, b, k) => `${a} + ${b} + ${k}`,
      say: (k) => `add the first two numbers, then add ${k} more`,
      nudge: 'Adding gets close. Look at what is left over: it is the same in every row.',
      ra: [3, 30],
      rb: [3, 30],
    },
  ],
  6: [
    {
      id: 'sqb',
      f: (a, b) => a * a + b,
      e: (a, b) => `${a} ${X} ${a} + ${b}`,
      say: 'multiply the first number by itself, then add the second',
      nudge:
        'The first number seems to matter much more than the second. Try multiplying it by itself.',
      ra: [2, 9],
      rb: [1, 15],
    },
    {
      id: 'mulmina',
      f: (a, b) => a * b - a,
      e: (a, b) => `${a} ${X} ${b} ${M} ${a}`,
      say: 'multiply the first two numbers, then take the first number away again',
      nudge:
        'Multiplying the first two overshoots a little. Compare the overshoot with the first number.',
      ra: [2, 9],
      rb: [2, 9],
    },
    {
      id: 'diffk',
      k: true,
      kr: [2, 4],
      f: (a, b, k) => (a - b) * k,
      e: (a, b, k) => `(${a} ${M} ${b}) ${X} ${k}`,
      say: (k) => `find the difference between the first two numbers, then multiply it by ${k}`,
      nudge:
        'Start with the difference between the first two numbers, then compare it with the third.',
      ra: [8, 20],
      rb: [1, 7],
    },
  ],
  7: [
    {
      id: 'sqdiff',
      f: (a, b) => a * a - b * b,
      e: (a, b) => `${a} ${X} ${a} ${M} ${b} ${X} ${b}`,
      say: 'multiply each number by itself, then take the second result away from the first',
      nudge: 'Square numbers (25, 36, 49, …) are involved, with something taken away.',
      ra: [5, 12],
      rb: [1, 4],
    },
    {
      id: 'mulminsum',
      f: (a, b) => a * b - (a + b),
      e: (a, b) => `${a} ${X} ${b} ${M} ${a} ${M} ${b}`,
      say: 'multiply the two numbers, then take both of them away',
      nudge: 'Multiplying overshoots. Compare the overshoot with the two numbers.',
      ra: [3, 9],
      rb: [3, 9],
    },
    {
      id: 'mulplussum',
      f: (a, b) => a * b + a + b,
      e: (a, b) => `${a} ${X} ${b} + ${a} + ${b}`,
      say: 'multiply the two numbers, then add both of them',
      nudge: 'Multiplying falls short. Compare what is missing with the two numbers.',
      ra: [2, 9],
      rb: [2, 9],
    },
    {
      id: 'mulb1',
      f: (a, b) => a * (b + 1),
      e: (a, b) => `${a} ${X} (${b} + 1)`,
      say: 'add 1 to the second number, then multiply by the first',
      nudge: 'Multiplying the two falls short by exactly one more of the first number.',
      ra: [2, 12],
      rb: [2, 9],
    },
  ],
  8: [
    {
      id: 'sqsum',
      f: (a, b) => a * a + b * b,
      e: (a, b) => `${a} ${X} ${a} + ${b} ${X} ${b}`,
      say: 'multiply each number by itself, then add the two results',
      nudge: 'Square numbers (1, 4, 9, 16, 25, …) are involved twice.',
      ra: [1, 9],
      rb: [1, 9],
    },
    {
      id: 'sumsq',
      f: (a, b) => (a + b) ** 2,
      e: (a, b) => `(${a} + ${b}) ${X} (${a} + ${b})`,
      say: 'add the two numbers, then multiply the total by itself',
      nudge: 'All the results are square numbers (a number times itself). Which number?',
      ra: [1, 7],
      rb: [1, 7],
    },
    {
      id: 'sqminb',
      f: (a, b) => a * a - b,
      e: (a, b) => `${a} ${X} ${a} ${M} ${b}`,
      say: 'multiply the first number by itself, then take away the second',
      nudge: 'Each result is just under a square number.',
      ra: [4, 12],
      rb: [1, 15],
    },
    {
      id: 'mul2minb',
      f: (a, b) => 2 * a * b - b,
      e: (a, b) => `2 ${X} ${a} ${X} ${b} ${M} ${b}`,
      say: 'multiply the two numbers, double that, then take away the second number',
      nudge: 'Multiplying gives roughly half of the result.',
      ra: [2, 9],
      rb: [2, 9],
    },
  ],
  9: [
    {
      id: 'sqsumina',
      f: (a, b) => a * a + b * b - a,
      e: (a, b) => `${a} ${X} ${a} + ${b} ${X} ${b} ${M} ${a}`,
      say: 'multiply each number by itself, add the results, then take away the first number',
      nudge: 'Two square numbers are involved, plus a small correction.',
      ra: [2, 9],
      rb: [1, 8],
    },
    {
      id: 'aab',
      f: (a, b) => a * (a + b),
      e: (a, b) => `${a} ${X} (${a} + ${b})`,
      say: 'add the two numbers, then multiply the total by the first number',
      nudge: 'Try adding the two numbers first, and then a multiplication.',
      ra: [2, 9],
      rb: [1, 9],
    },
    {
      id: 'mulminsqb',
      f: (a, b) => a * b - b * b,
      e: (a, b) => `${a} ${X} ${b} ${M} ${b} ${X} ${b}`,
      say: 'multiply the two numbers, then take away the second number times itself',
      nudge: 'Multiplying overshoots. The overshoot depends only on the second number.',
      ra: [5, 12],
      rb: [1, 4],
    },
    {
      id: 'cubeminb',
      f: (a, b) => a ** 3 - b,
      e: (a, b) => `${a} ${X} ${a} ${X} ${a} ${M} ${b}`,
      say: 'multiply the first number by itself twice (a cube), then take away the second',
      nudge: 'Each result is just under a cube number (8, 27, 64, 125, …).',
      ra: [2, 6],
      rb: [1, 20],
    },
  ],
};
const sayOf = (rule: GridRule, k: number): string =>
  typeof rule.say === 'function' ? rule.say(k) : (rule.say ?? '');
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Solve f(..x..) = target for one unknown argument by brute force; return value if unique non-negative integer.
function solveUnique(fn: (x: number) => boolean, lo = 0, hi = 300): number | null {
  const sols: number[] = [];
  for (let x = lo; x <= hi; x++)
    if (fn(x)) {
      sols.push(x);
      if (sols.length > 1) return null;
    }
  return sols.length === 1 ? sols[0] : null;
}
const rowIdx = (r: number) => [r * 3, r * 3 + 1, r * 3 + 2];
const colIdx = (c: number) => [c, 3 + c, 6 + c];

function genGrid(level: number): Omit<Item, 'id' | 'b' | 'prompt'> {
  const rule = pick(G[level]);
  const rows: number[][] = [];
  const base = { family: 'grid' as const, level, think: THINK.grid };
  if (rule.id === 'rowsum') {
    const S0 = R(20, 45);
    for (let i = 0; i < 3; i++) {
      const a = R(1, S0 - 10),
        b = R(1, S0 - a - 1);
      rows.push([a, b, S0 - a - b]);
    }
    const mr = R(0, 2),
      mc = R(0, 2),
      ans = rows[mr][mc];
    const cells = rows.map((r, i) => r.map((v, j) => (i === mr && j === mc ? null : v)));
    const full = [0, 1, 2].filter((i) => i !== mr);
    const known = rows[mr].filter((_, j) => j !== mc),
      part = known[0] + known[1];
    const guide: GuideStep[] = [
      {
        t: 'Here the rule is not "first two make the third". Add up a complete row:',
        lines: [`${rows[full[0]].join(' + ')} = ${S0}`],
        hl: rowIdx(full[0]),
      },
      {
        t: 'Do the same with the other complete row:',
        lines: [`${rows[full[1]].join(' + ')} = ${S0} ✓`],
        hl: rowIdx(full[1]),
      },
      { t: `So every row adds up to the same total: ${S0}.`, hl: [] },
      {
        t: `In the row with the ?, add the two numbers you have, then find what is missing to reach ${S0}:`,
        lines: [`${known[0]} + ${known[1]} = ${part}`, `${S0} ${M} ${part} = ${ans}`],
        hl: rowIdx(mr),
        reveal: true,
      },
      { t: `So the missing number is ${ans}.`, hl: [mr * 3 + mc], reveal: true, final: true },
    ];
    return Object.assign(base, {
      view: { kind: 'grid' as const, cells },
      answer: ans,
      rule: `Every row adds up to ${S0}.`,
      nudge: 'Add up all three numbers in each complete row and compare the totals.',
      guide,
      steps: [`Every row adds up to ${S0}.`, `${S0} ${M} ${part} = ${ans}.`],
    });
  }
  if (rule.id === 'colsum') {
    for (let i = 0; i < 2; i++) rows.push([R(2, 30), R(2, 30), R(2, 30)]);
    rows.push(rows[0].map((v, j) => v + rows[1][j]));
    const mr = Math.random() < 0.35 ? R(0, 1) : 2,
      mc = R(0, 2),
      ans = rows[mr][mc];
    const cells = rows.map((r, i) => r.map((v, j) => (i === mr && j === mc ? null : v)));
    const others = [0, 1, 2].filter((c) => c !== mc);
    const lastLines =
      mr === 2
        ? [`${rows[0][mc]} + ${rows[1][mc]} = ${ans}`]
        : [
            `${mr === 0 ? '?' : rows[0][mc]} + ${mr === 1 ? '?' : rows[1][mc]} = ${rows[2][mc]}`,
            `work backwards: ${rows[2][mc]} ${M} ${rows[1 - mr][mc]} = ${ans}`,
          ];
    const last = lastLines.join(', ');
    const guide: GuideStep[] = [
      {
        t: "Reading across the rows doesn't give a rule here, so read down the columns instead:",
        lines: [`${rows[0][others[0]]} + ${rows[1][others[0]]} = ${rows[2][others[0]]}`],
        hl: colIdx(others[0]),
      },
      {
        t: 'Check the next complete column:',
        lines: [`${rows[0][others[1]]} + ${rows[1][others[1]]} = ${rows[2][others[1]]} ✓`],
        hl: colIdx(others[1]),
      },
      {
        t: 'So in every column, the top number plus the middle number makes the bottom number.',
        hl: [],
      },
      { t: 'Use it on the column with the ?:', lines: lastLines, hl: colIdx(mc), reveal: true },
      { t: `So the missing number is ${ans}.`, hl: [mr * 3 + mc], reveal: true, final: true },
    ];
    return Object.assign(base, {
      view: { kind: 'grid' as const, cells },
      answer: ans,
      rule: 'Down each column: top + middle = bottom.',
      nudge: 'No row rule fits. Try reading down the columns instead.',
      guide,
      steps: ['Down each column: top + middle = bottom.', last + '.'],
    });
  }
  const f = rule.f!,
    e = rule.e!,
    ra = rule.ra!,
    rb = rule.rb!;
  const k = rule.k ? R(...(rule.kr ?? [1, 5])) : 0;
  let g = 0;
  while (rows.length < 3 && g++ < 200) {
    const a = R(...ra),
      b = R(...rb),
      c = f(a, b, k);
    if (c < 0 || c > 4000 || !Number.isInteger(c)) continue;
    if (rows.some((r) => r[0] === a && r[1] === b)) continue;
    rows.push([a, b, c]);
  }
  const mr = R(0, 2);
  let mc = 2;
  if (level >= 6 && Math.random() < 0.45) {
    const cand = R(0, 1);
    const [a, b, c] = rows[mr];
    if (solveUnique((x) => (cand === 0 ? f(x, b, k) : f(a, x, k)) === c) !== null) mc = cand;
  }
  const ans = rows[mr][mc];
  const cells = rows.map((r, i) => r.map((v, j) => (i === mr && j === mc ? null : v)));
  const full = [0, 1, 2].filter((i) => i !== mr),
    say = sayOf(rule, k);
  const r0 = rows[full[0]],
    r1 = rows[full[1]],
    m = rows[mr];
  const guide: GuideStep[] = [
    {
      t: `Start with a complete row: ${r0[0]}, ${r0[1]} and ${r0[2]}. Ask yourself: how can ${r0[0]} and ${r0[1]} be combined to make ${r0[2]}?`,
      hl: rowIdx(full[0]),
    },
    {
      t: `It works if you ${say}:`,
      lines: [`${e(r0[0], r0[1], k)} = ${r0[2]}`],
      hl: rowIdx(full[0]),
    },
    {
      t: 'Check the same rule on the other complete row:',
      lines: [`${e(r1[0], r1[1], k)} = ${r1[2]} ✓`],
      hl: rowIdx(full[1]),
    },
  ];
  let last;
  if (mc === 2) {
    last = `${e(m[0], m[1], k)} = ${ans}`;
    guide.push({
      t: 'Now use it on the row with the ?:',
      lines: [last],
      hl: rowIdx(mr),
      reveal: true,
    });
  } else {
    const lhs = e(mc === 0 ? '?' : m[0], mc === 1 ? '?' : m[1], k);
    last = `${e(mc === 0 ? ans : m[0], mc === 1 ? ans : m[1], k)} = ${m[2]}`;
    guide.push({
      t: `In the row with the ?, the missing number is one of the first two, so work backwards. You need: ${lhs} = ${m[2]}.`,
      hl: rowIdx(mr),
    });
    guide.push({
      t: `Try numbers until it fits. ${ans} works:`,
      lines: [last + ' ✓'],
      hl: rowIdx(mr),
      reveal: true,
    });
  }
  guide.push({
    t: `So the missing number is ${ans}.`,
    hl: [mr * 3 + mc],
    reveal: true,
    final: true,
  });
  return Object.assign(base, {
    view: { kind: 'grid' as const, cells },
    answer: ans,
    rule: `In every row: ${say}.`,
    nudge: mc === 2 ? (rule.nudge ?? '') : rule.nudge + ' ' + BACKWARDS,
    guide,
    steps: [cap(say) + ' (in every row).', last + '.'],
  });
}

/* ================= SHAPES: plus-shaped box clusters + triangles ================= */
// plus: centre = f(top, left, right, bottom); tri: centre = f(top, left, right)
const P: Record<number, ShapeRule[]> = {
  3: [
    {
      k: 'plus',
      f: (t, l, r, b) => t + l + r + b,
      e: (t, l, r, b) => `${t} + ${l} + ${r} + ${b}`,
      say: 'add up all four outer numbers',
      nudge: 'Start simple: what do the outer numbers add up to?',
      rng: [1, 12],
    },
    {
      k: 'tri',
      f: (a, b, c) => a + b + c,
      e: (a, b, c) => `${a} + ${b} + ${c}`,
      say: 'add up the three corners',
      nudge: 'Start simple: what do the corners add up to?',
      rng: [2, 20],
    },
  ],
  4: [
    {
      k: 'plus',
      f: (t, l, r, b) => t + b - (l + r),
      e: (t, l, r, b) => `(${t} + ${b}) ${M} (${l} + ${r})`,
      say: 'add top and bottom, add left and right, then take the second total away from the first',
      nudge:
        'The centre is smaller than the outer numbers together. Pair opposite boxes and compare the pairs.',
      rng: [1, 20],
      ok: (v) => v > 0,
    },
    {
      k: 'tri',
      f: (a, b, c) => a + b - c,
      e: (a, b, c) => `${a} + ${b} ${M} ${c}`,
      say: 'add the top and left corners, then take away the right corner',
      nudge:
        'The middle is smaller than all three corners together. One corner seems to be taken away.',
      rng: [2, 25],
      ok: (v) => v > 0,
    },
  ],
  5: [
    {
      k: 'plus',
      f: (t, l, r, b) => t * b + l + r,
      e: (t, l, r, b) => `${t} ${X} ${b} + ${l} + ${r}`,
      say: 'multiply top by bottom, then add the left and right numbers',
      nudge:
        'Adding everything is too small, so something is multiplied. Try the top and bottom pair.',
      rng: [1, 9],
    },
    {
      k: 'tri',
      f: (a, b, c) => a * b - c,
      e: (a, b, c) => `${a} ${X} ${b} ${M} ${c}`,
      say: 'multiply the top and left corners, then take away the right corner',
      nudge: 'Multiplying two of the corners overshoots a little. What could bring it back down?',
      rng: [2, 12],
      ok: (v) => v > 0,
    },
  ],
  6: [
    {
      k: 'plus',
      f: (t, l, r, b) => t * b - l * r,
      e: (t, l, r, b) => `${t} ${X} ${b} ${M} ${l} ${X} ${r}`,
      say: 'multiply top by bottom, multiply left by right, then take the second result away from the first',
      nudge:
        'Pair opposite boxes and multiply each pair. Then compare the two results with the centre.',
      rng: [1, 9],
      ok: (v) => v > 0,
    },
    {
      k: 'tri',
      f: (a, b, c) => (a + b) * c,
      e: (a, b, c) => `(${a} + ${b}) ${X} ${c}`,
      say: 'add the top and left corners, then multiply by the right corner',
      nudge: 'The middle is big, so something is multiplied. Try adding two corners first.',
      rng: [1, 9],
    },
  ],
  7: [
    {
      k: 'plus',
      f: (t, l, r, b) => (t + b) * (l - r),
      e: (t, l, r, b) => `(${t} + ${b}) ${X} (${l} ${M} ${r})`,
      say: 'add top and bottom, find the difference between left and right, then multiply those two results',
      nudge: 'Pair opposite boxes. One pair is added, the other pair gives a difference.',
      rng: [1, 9],
      ok: (v) => v > 0,
    },
    {
      k: 'tri',
      f: (a, b, c) => a * b * c,
      e: (a, b, c) => `${a} ${X} ${b} ${X} ${c}`,
      say: 'multiply all three corners together',
      nudge: 'The middle is much bigger than the corners. Think multiplication only.',
      rng: [2, 7],
    },
  ],
  8: [
    {
      k: 'plus',
      f: (t, l, r, b) => t * b + l * r,
      e: (t, l, r, b) => `${t} ${X} ${b} + ${l} ${X} ${r}`,
      say: 'multiply top by bottom, multiply left by right, then add the two results',
      nudge: 'Pair opposite boxes and multiply each pair. Then combine the two results.',
      rng: [1, 9],
    },
    {
      k: 'tri',
      f: (a, b, c) => a * a + b * c,
      e: (a, b, c) => `${a} ${X} ${a} + ${b} ${X} ${c}`,
      say: 'multiply the top corner by itself, then add left times right',
      nudge: 'The top corner matters more than the others. Try multiplying it by itself.',
      rng: [1, 9],
    },
  ],
  9: [
    {
      k: 'plus',
      f: (t, l, r, b) => t * t - l * r + b,
      e: (t, l, r, b) => `${t} ${X} ${t} ${M} ${l} ${X} ${r} + ${b}`,
      say: 'multiply the top number by itself, take away left times right, then add the bottom number',
      nudge:
        'The top number plays a special role: try multiplying it by itself. Left and right work as a pair.',
      rng: [1, 9],
      ok: (v) => v > 0,
    },
    {
      k: 'tri',
      f: (a, b, c) => (a - b) * (a + c),
      e: (a, b, c) => `(${a} ${M} ${b}) ${X} (${a} + ${c})`,
      say: 'find the difference between the top and left corners, add the top and right corners, then multiply those two results',
      nudge: 'The top corner is used twice: once with the left corner and once with the right one.',
      rng: [1, 12],
      ok: (v) => v > 0,
    },
  ],
};
function genShapes(level: number): Omit<Item, 'id' | 'b' | 'prompt'> {
  const rule = pick(P[level]);
  const isPlus = rule.k === 'plus',
    n = isPlus ? 4 : 3,
    stride = isPlus ? 5 : 4;
  const figs: { outer: number[]; centre: number }[] = [];
  let g = 0;
  while (figs.length < 3 && g++ < 500) {
    const outer = distinct(n, ...rule.rng);
    if (outer.length < n) continue;
    const c = rule.f(...outer);
    if ((rule.ok && !rule.ok(c)) || c > 2000 || c < 0) continue;
    figs.push({ outer, centre: c });
  }
  const target = figs[2];
  let miss = -1; // -1 = centre
  if (level >= 6 && Math.random() < 0.45) {
    const idx = R(0, n - 1);
    const u = solveUnique(
      (x) => {
        const o = target.outer.slice();
        o[idx] = x;
        return rule.f(...o) === target.centre;
      },
      0,
      100,
    );
    if (u !== null) miss = idx;
  }
  const answer = miss === -1 ? target.centre : target.outer[miss];
  const fig = (f: number) => range(f * stride, f * stride + stride - 1);
  const word = isPlus ? 'outer numbers' : 'corners';
  const f0 = figs[0],
    f1 = figs[1];
  const guide: GuideStep[] = [
    {
      t: `Start with the first figure. The ${word} are ${f0.outer.join(', ')} and the centre is ${f0.centre}. Ask yourself: how could the ${word} make ${f0.centre}?`,
      hl: fig(0),
    },
    {
      t: `It works if you ${rule.say}:`,
      lines: [`${rule.e(...f0.outer)} = ${f0.centre}`],
      hl: fig(0),
    },
    {
      t: 'Check the same recipe on the second figure:',
      lines: [`${rule.e(...f1.outer)} = ${f1.centre} ✓`],
      hl: fig(1),
    },
  ];
  let last;
  if (miss === -1) {
    last = `${rule.e(...target.outer)} = ${answer}`;
    guide.push({ t: 'Now use it on the last figure:', lines: [last], hl: fig(2), reveal: true });
  } else {
    const lhs = rule.e(...target.outer.map((v, i) => (i === miss ? '?' : v)));
    last = `${rule.e(...target.outer)} = ${target.centre}`;
    guide.push({
      t: `In the last figure the centre is known (${target.centre}) and one of the ${word} is missing, so work backwards. You need: ${lhs} = ${target.centre}.`,
      hl: fig(2),
    });
    guide.push({
      t: `Try numbers until it fits. ${answer} works:`,
      lines: [last + ' ✓'],
      hl: fig(2),
      reveal: true,
    });
  }
  guide.push({
    t: `So the missing number is ${answer}.`,
    hl: [miss === -1 ? 2 * stride + stride - 1 : 2 * stride + miss],
    reveal: true,
    final: true,
  });
  const view = {
    kind: rule.k,
    figs: figs.map((fg, i) => ({
      outer: fg.outer.map((v, j) => (i === 2 && j === miss ? null : v)),
      centre: i === 2 && miss === -1 ? null : fg.centre,
    })),
  };
  return {
    family: 'shapes',
    level,
    view,
    answer,
    rule: `Centre: ${rule.say}.`,
    think: THINK[rule.k],
    nudge: miss === -1 ? rule.nudge : rule.nudge + ' ' + BACKWARDS,
    guide,
    steps: [cap(rule.say) + '.', last + '.'],
  };
}

/* ================= FUNCTION BOXES: x -> f(x) ================= */
const F: Record<number, PairsRule[]> = {
  3: [
    {
      f: (x, k) => 2 * x + k,
      e: (x, k) => `2 ${X} ${x} + ${k}`,
      say: (k) => `double the number, then add ${k}`,
      nudge: 'Each output is a bit more than double its input.',
      xr: [2, 15],
      kr: [1, 5],
    },
    {
      f: (x, k) => 3 * x - k,
      e: (x, k) => `3 ${X} ${x} ${M} ${k}`,
      say: (k) => `multiply by 3, then take away ${k}`,
      nudge: 'Each output is a bit less than three times its input.',
      xr: [2, 15],
      kr: [1, 4],
    },
  ],
  4: [
    {
      f: (x, k) => 4 * x + k,
      e: (x, k) => `4 ${X} ${x} + ${k}`,
      say: (k) => `multiply by 4, then add ${k}`,
      nudge: 'Each output is a bit more than four times its input.',
      xr: [2, 15],
      kr: [1, 6],
    },
    {
      f: (x) => x * x,
      e: (x) => `${x} ${X} ${x}`,
      say: () => 'multiply the number by itself',
      nudge: 'The outputs grow much faster than the inputs. Think of the times tables.',
      xr: [2, 12],
    },
    {
      f: (x, k) => 5 * x - k,
      e: (x, k) => `5 ${X} ${x} ${M} ${k}`,
      say: (k) => `multiply by 5, then take away ${k}`,
      nudge: 'Each output is a bit less than five times its input.',
      xr: [2, 12],
      kr: [1, 6],
    },
  ],
  5: [
    {
      f: (x, k) => x * x + k,
      e: (x, k) => `${x} ${X} ${x} + ${k}`,
      say: (k) => `multiply the number by itself, then add ${k}`,
      nudge: 'Each output is just above a number from the times tables: the input times itself.',
      xr: [2, 11],
      kr: [1, 6],
    },
    {
      f: (x) => x * (x + 1),
      e: (x) => `${x} ${X} ${typeof x === 'number' ? x + 1 : `(${x} + 1)`}`,
      say: () => 'multiply the number by the next number up',
      nudge: 'The output is a bit more than the input times itself.',
      xr: [2, 12],
    },
    {
      f: (x, k) => x * x - k,
      e: (x, k) => `${x} ${X} ${x} ${M} ${k}`,
      say: (k) => `multiply the number by itself, then take away ${k}`,
      nudge: 'Each output is just below the input times itself.',
      xr: [3, 11],
      kr: [1, 5],
    },
  ],
  6: [
    {
      f: (x) => x * x - x,
      e: (x) => `${x} ${X} ${x} ${M} ${x}`,
      say: () => 'multiply the number by itself, then take the number away again',
      nudge:
        'The output is a bit less than the input times itself, and the shortfall grows with the input.',
      xr: [2, 12],
    },
    {
      f: (x, k) => 2 * x * x - k,
      e: (x, k) => `2 ${X} ${x} ${X} ${x} ${M} ${k}`,
      say: (k) => `multiply the number by itself, double it, then take away ${k}`,
      nudge: 'The outputs are close to double the input times itself.',
      xr: [2, 9],
      kr: [1, 5],
    },
    {
      f: (x) => x ** 3,
      e: (x) => `${x} ${X} ${x} ${X} ${x}`,
      say: () => 'multiply the number by itself, and by itself again',
      nudge: 'The outputs explode. A number multiplied by itself more than once.',
      xr: [2, 8],
    },
  ],
  7: [
    {
      f: (x, k) => (x + k) ** 2,
      e: (x, k) => `(${x} + ${k}) ${X} (${x} + ${k})`,
      say: (k) => `add ${k}, then multiply the result by itself`,
      nudge:
        'All the outputs are square numbers (a number times itself). Which number, compared with the input?',
      xr: [1, 9],
      kr: [1, 4],
    },
    {
      f: (x, k) => x ** 3 + k,
      e: (x, k) => `${x} ${X} ${x} ${X} ${x} + ${k}`,
      say: (k) => `multiply the number by itself twice, then add ${k}`,
      nudge: 'The outputs are just above cube numbers (8, 27, 64, 125, …).',
      xr: [2, 7],
      kr: [1, 5],
    },
    {
      f: (x, k) => x * (x - k),
      e: (x, k) => `${x} ${X} (${x} ${M} ${k})`,
      say: (k) => `multiply the number by the number that is ${k} lower`,
      nudge: 'The output is a bit less than the input times itself.',
      xr: [5, 14],
      kr: [1, 4],
    },
  ],
  8: [
    {
      f: (x) => x ** 3 - x,
      e: (x) => `${x} ${X} ${x} ${X} ${x} ${M} ${x}`,
      say: () => 'multiply the number by itself twice, then take the number away',
      nudge: 'The outputs are just below cube numbers (8, 27, 64, …).',
      xr: [2, 8],
    },
    {
      f: (x, k) => 2 ** x + k,
      e: (x, k) => `2${x === '?' ? '^?' : sup(x)} + ${k}`,
      say: (k) => `multiply 2 by itself that many times, then add ${k}`,
      nudge:
        'The outputs roughly double every time the input goes up by one. Think of 2, 4, 8, 16, 32, …',
      xr: [1, 9],
      kr: [1, 5],
    },
    {
      f: (x) => 2 * x * x + x,
      e: (x) => `2 ${X} ${x} ${X} ${x} + ${x}`,
      say: () => 'multiply the number by itself, double it, then add the number',
      nudge: 'The outputs are a bit more than double the input times itself.',
      xr: [2, 10],
    },
  ],
  9: [
    {
      f: (x) => x ** 3 - x * x,
      e: (x) => `${x} ${X} ${x} ${X} ${x} ${M} ${x} ${X} ${x}`,
      say: () => 'multiply the number by itself twice, then take away the number times itself',
      nudge: 'The outputs are below cube numbers, and the gap grows quickly.',
      xr: [2, 8],
    },
    {
      f: (x) => (x * x + 1) * 2,
      e: (x) => `(${x} ${X} ${x} + 1) ${X} 2`,
      say: () => 'multiply the number by itself, add 1, then double',
      nudge: 'Halve each output first. What is left looks familiar.',
      xr: [2, 10],
    },
    {
      f: (x) => 2 ** x - x,
      e: (x) => `2${x === '?' ? '^?' : sup(x)} ${M} ${x}`,
      say: () => 'multiply 2 by itself that many times, then take the number away',
      nudge: 'The outputs roughly double every step, minus a little. Think of 2, 4, 8, 16, 32, …',
      xr: [2, 10],
    },
  ],
};
function genPairs(level: number): Omit<Item, 'id' | 'b' | 'prompt'> {
  const rule = pick(F[level]);
  const k = rule.kr ? R(...rule.kr) : 0;
  const xs = distinct(4, ...rule.xr);
  const ordered = level <= 4 ? xs.sort((a, b) => a - b) : xs;
  const pairs = ordered.map((x) => [x, rule.f(x, k)]);
  let missIn = level >= 7 && Math.random() < 0.4;
  if (missIn) {
    const t = pairs[3][1];
    if (solveUnique((x) => rule.f(x, k) === t, 0, 60) === null) missIn = false;
  }
  const answer = missIn ? pairs[3][0] : pairs[3][1];
  const say = rule.say(k);
  const pr = (p: number) => [p * 2, p * 2 + 1];
  const [p0, p1, p2, p3] = pairs;
  const guide: GuideStep[] = [
    {
      t: `Start with the first box: ${p0[0]} goes in and ${p0[1]} comes out. Lots of rules could do that, so keep an open mind and test every idea on the other boxes too.`,
      hl: pr(0),
    },
    {
      t: `The rule that works for all of them: ${say}.`,
      lines: [
        `${p0[0]} → ${rule.e(p0[0], k)} = ${p0[1]}`,
        `${p1[0]} → ${rule.e(p1[0], k)} = ${p1[1]} ✓`,
        `${p2[0]} → ${rule.e(p2[0], k)} = ${p2[1]} ✓`,
      ],
      hl: [...pr(0), ...pr(1), ...pr(2)],
    },
  ];
  let last;
  if (!missIn) {
    last = `${p3[0]} → ${rule.e(p3[0], k)} = ${answer}`;
    guide.push({
      t: 'Now put the last number through the same machine:',
      lines: [last],
      hl: pr(3),
      reveal: true,
    });
  } else {
    last = `${answer} → ${rule.e(answer, k)} = ${p3[1]}`;
    guide.push({
      t: `In the last box, the output (${p3[1]}) is known and the input is missing, so work backwards: which number would come out as ${p3[1]}?`,
      hl: pr(3),
    });
    guide.push({
      t: `Try numbers until it fits. ${answer} works:`,
      lines: [last + ' ✓'],
      hl: pr(3),
      reveal: true,
    });
  }
  guide.push({
    t: `So the missing number is ${answer}.`,
    hl: [missIn ? 6 : 7],
    reveal: true,
    final: true,
  });
  return {
    family: 'pairs',
    level,
    view: {
      kind: 'pairs',
      pairs: pairs.map((p, i) => (i < 3 ? p : missIn ? [null, p[1]] : [p[0], null])),
    },
    answer,
    rule: `The machine: ${say}.`,
    think: THINK.pairs,
    nudge: missIn ? rule.nudge + ' ' + BACKWARDS : rule.nudge,
    guide,
    steps: [cap(say) + '.', last + '.'],
  };
}

/* ================= REGISTRY ================= */
export const FAMILIES: Record<
  Family,
  {
    id: Family;
    name: string;
    short: string;
    min: number;
    max: number;
    gen: (level: number) => Omit<Item, 'id' | 'b' | 'prompt'>;
    blurb: string;
  }
> = {
  series: {
    id: 'series',
    name: 'Number series',
    short: 'Series',
    min: 1,
    max: 9,
    gen: genSeries,
    blurb: 'Find the missing number in a row of boxes.',
  },
  grid: {
    id: 'grid',
    name: 'Number grids',
    short: 'Grids',
    min: 2,
    max: 9,
    gen: genGrid,
    blurb: 'A 3 × 3 grid where rows or columns follow one rule.',
  },
  shapes: {
    id: 'shapes',
    name: 'Number figures',
    short: 'Figures',
    min: 3,
    max: 9,
    gen: genShapes,
    blurb: 'The centre is built from the numbers around it.',
  },
  pairs: {
    id: 'pairs',
    name: 'Function boxes',
    short: 'Functions',
    min: 3,
    max: 9,
    gen: genPairs,
    blurb: 'One hidden operation turns each input into its output.',
  },
};
const PROMPTS: Record<Family, string> = {
  series: 'Which number replaces the question mark?',
  grid: 'Which number replaces the question mark in the grid?',
  shapes: 'The figures follow the same rule. Which number replaces the question mark?',
  pairs:
    'Every input goes through the same hidden operation. Which number replaces the question mark?',
};

let uid = 0;
export function makeItem(family: Family, level: number): Item {
  const fam = FAMILIES[family];
  const lvl = Math.max(fam.min, Math.min(fam.max, level));
  return {
    ...fam.gen(lvl),
    id: 'q' + Date.now().toString(36) + (uid++).toString(36),
    b: LEVEL_B(lvl),
    prompt: PROMPTS[family],
  };
}

/* ================= ADAPTIVE SCORING (2PL IRT, EAP with N(0,1) prior) ================= */
const A = 1.3; // discrimination
const GRID = Array.from({ length: 121 }, (_, i) => -4 + i * (8 / 120));
export const pCorrect = (theta: number, b: number): number => 1 / (1 + Math.exp(-A * (theta - b)));
export function estimate(responses: Response[]): { theta: number; se: number } {
  let w = GRID.map((t) => Math.exp((-t * t) / 2));
  for (const r of responses)
    w = w.map((wi, i) => {
      const p = pCorrect(GRID[i], r.b);
      return wi * (r.correct ? p : 1 - p);
    });
  const s = w.reduce((a, b) => a + b, 0);
  const mean = w.reduce((a, wi, i) => a + wi * GRID[i], 0) / s;
  const sd = Math.sqrt(w.reduce((a, wi, i) => a + wi * (GRID[i] - mean) ** 2, 0) / s);
  return { theta: mean, se: sd };
}
export const thetaToLevel = (theta: number): number =>
  Math.max(1, Math.min(9, Math.round(theta / 0.7 + 5)));
export const thetaToStanine = (theta: number): number =>
  Math.max(1, Math.min(9, Math.round(5 + 2 * theta)));
const erf = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
export const percentile = (theta: number): number => Math.round(50 * (1 + erf(theta / Math.SQRT2)));

/** The next question of an adaptive test: aimed at the current ability estimate, rotating question types. */
export function nextAdaptive(responses: Response[], history: { family: Family }[]): Item {
  const est = estimate(responses);
  let lvl = responses.length === 0 ? 4 : thetaToLevel(est.theta);
  if (responses.length > 0 && Math.random() < 0.25) lvl += pick([-1, 1]);
  lvl = Math.max(1, Math.min(9, lvl));
  const recent = history.slice(-2).map((h) => h.family);
  let fams = Object.values(FAMILIES).filter((f) => lvl >= f.min && !recent.includes(f.id));
  if (!fams.length) fams = Object.values(FAMILIES).filter((f) => lvl >= f.min);
  const counts: Partial<Record<Family, number>> = {};
  history.forEach((h) => (counts[h.family] = (counts[h.family] || 0) + 1));
  fams.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
  const least = fams.filter((f) => (counts[f.id] || 0) === (counts[fams[0].id] || 0));
  return makeItem(pick(least).id, lvl);
}
