import {
  FAMILIES,
  estimate,
  percentile,
  thetaToLevel,
  thetaToStanine,
  type Family,
  type Item,
} from './engine';

// Scoring, levels, streaks and XP: the rules of the game, kept free of the
// server so they are easy to test (practice.test.ts).

export const FAMILY_IDS = Object.keys(FAMILIES) as Family[];
export type LessonFamily = Family | 'mix';
export type Mode = 'full' | 'quick';

export const MODES: Record<Mode, { n: number; ms: number; label: string; desc: string }> = {
  full: { n: 15, ms: 30 * 60_000, label: 'Full mock test', desc: '15 questions · 30 minutes' },
  quick: { n: 8, ms: 12 * 60_000, label: 'Quick check', desc: '8 questions · 12 minutes' },
};
export const LESSON_LENGTH = 8;
/** right answers a lesson needs to move up a level */
export const PASS = 6;
export const DAILY_GOALS = [20, 50, 100] as const;

/** One answered question. `given` is null for a skipped one. */
export interface Answer {
  item: Item;
  given: number | null;
  correct: boolean;
  ms: number;
  /** the hint was opened */
  hinted?: boolean;
  /** the step-by-step solution was opened */
  solved?: boolean;
}

/** Per question type: [answered, right on your own, total milliseconds] */
export type FamilyTally = Partial<Record<Family, [number, number, number]>>;

export interface Result {
  /** right answers found without the solution */
  correct: number;
  answered: number;
  fam: FamilyTally;
  // lessons
  bonus?: number;
  change?: number;
  helped?: number;
  xp?: number;
  // tests
  theta?: number;
  se?: number;
  stanine?: number;
  lo?: number;
  hi?: number;
  pct?: number;
  timeout?: boolean;
  maxLevel?: number;
  bumped?: boolean;
}

export interface SessionSummary {
  id: string;
  kind: 'practice' | 'test';
  family: LessonFamily | '';
  mode: Mode | '';
  level: number;
  level_after: number;
  started: string;
  ended: string;
  result: Result;
}

export interface Progress {
  xp: number;
  daily_goal: number;
  skills: Record<Family, { level: number }>;
  /** XP per day, by local date */
  days: Record<string, number>;
  reminders: boolean;
}

export function newProgress(): Progress {
  return {
    xp: 0,
    daily_goal: 50,
    skills: Object.fromEntries(
      FAMILY_IDS.map((f) => [f, { level: FAMILIES[f].min }]),
    ) as Progress['skills'],
    days: {},
    reminders: false,
  };
}

/** A local date as YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** PocketBase dates ("2026-11-17 10:00:00.000Z") as milliseconds. */
export const toMs = (date: string) => Date.parse(date.replace(' ', 'T'));
export const toDate = (ms: number) => new Date(ms).toISOString().replace('T', ' ');

/** A right answer found without the step-by-step solution. */
export const earned = (a: Answer) => a.correct && !a.solved;

/** XP for one lesson answer: 10 on your own, 5 with the hint, nothing with the solution. */
export const xpFor = (a: Answer) => (earned(a) ? (a.hinted ? 5 : 10) : 0);

/** Days in a row with XP, counting today, or up to yesterday if today has none yet. */
export function streak(days: Record<string, number>, now = new Date()): number {
  const d = new Date(now);
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[dayKey(d)] > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Adds XP to today, keeping about a year of days. */
export function withXp(p: Progress, xp: number, now = new Date()): Progress {
  if (xp <= 0) return p;
  const days = { ...p.days, [dayKey(now)]: (p.days[dayKey(now)] ?? 0) + xp };
  const keys = Object.keys(days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete days[k];
  return { ...p, xp: p.xp + xp, days };
}

export function tally(answers: Answer[]): FamilyTally {
  const t: FamilyTally = {};
  for (const a of answers) {
    const f = (t[a.item.family] ??= [0, 0, 0]);
    f[0]++;
    if (earned(a)) f[1]++;
    f[2] += a.ms;
  }
  return t;
}

/** Accuracy and pace per question type over the last sessions that had it. */
export function familyStats(sessions: SessionSummary[], fam: Family, lastAnswers = 40) {
  let n = 0,
    right = 0,
    ms = 0;
  for (const s of [...sessions].sort((a, b) => toMs(b.started) - toMs(a.started))) {
    const t = s.result.fam?.[fam];
    if (!t) continue;
    n += t[0];
    right += t[1];
    ms += t[2];
    if (n >= lastAnswers) break;
  }
  return n ? { n, acc: right / n, avgMs: ms / n } : { n: 0, acc: null, avgMs: null };
}

/** The skill to practise next: one barely tried, else the least accurate. */
export function recommended(p: Progress, sessions: SessionSummary[]): Family {
  let best: Family = 'series',
    score = Infinity;
  for (const f of FAMILY_IDS) {
    const st = familyStats(sessions, f);
    const s = st.n < 5 ? -1 + p.skills[f].level / 100 : (st.acc ?? 0);
    if (s < score) [score, best] = [s, f];
  }
  return best;
}

/** Eight questions: two to warm up a level below, five at your level, one challenge above. */
export function lessonPlan(p: Progress, fam: LessonFamily, shuffle: <T>(a: T[]) => T[]) {
  const fams =
    fam === 'mix'
      ? shuffle([...FAMILY_IDS, ...FAMILY_IDS])
      : Array<Family>(LESSON_LENGTH).fill(fam);
  const offsets = [-1, -1, 0, 0, 0, 0, 0, 1];
  return fams.map((f, i) => ({
    family: f,
    level: Math.max(FAMILIES[f].min, Math.min(9, p.skills[f].level + offsets[i])),
  }));
}

/** A lesson's effect on the level: up with 6 or more right, down with 2 or fewer. */
export function levelAfterLesson(level: number, min: number, correct: number) {
  if (correct >= PASS && level < 9) return { level: level + 1, change: 1 };
  if (correct <= 2 && level > min) return { level: level - 1, change: -1 };
  return { level, change: 0 };
}

/** The score of a mock test. */
export function testResult(answers: Answer[], timeout: boolean): Result {
  const est = estimate(answers.map((a) => ({ b: a.item.b, correct: a.correct })));
  return {
    correct: answers.filter((a) => a.correct).length,
    answered: answers.length,
    fam: tally(answers),
    theta: est.theta,
    se: est.se,
    stanine: thetaToStanine(est.theta),
    lo: thetaToStanine(est.theta - est.se),
    hi: thetaToStanine(est.theta + est.se),
    pct: percentile(est.theta),
    timeout,
    maxLevel: Math.max(0, ...answers.filter((a) => a.correct).map((a) => a.item.level)),
  };
}

/** Raises practice levels that are well below a test result; never lowers them. */
export function levelsAfterTest(p: Progress, theta: number) {
  const target = Math.max(1, thetaToLevel(theta) - 1);
  let bumped = false;
  const skills = { ...p.skills };
  for (const f of FAMILY_IDS) {
    const t = Math.max(FAMILIES[f].min, target);
    if (skills[f].level < t) {
      skills[f] = { level: t };
      bumped = true;
    }
  }
  return { skills, bumped };
}

export const STANINE_WORDS = [
  '',
  'Well below average',
  'Well below average',
  'Below average',
  'Slightly below average',
  'Average',
  'Slightly above average',
  'Above average',
  'Well above average',
  'Well above average',
];

/** A typed answer is a whole number, maybe negative. */
export const validAnswer = (v: string) => /^-?\d+$/.test(v.trim());

/** Seconds, short: "4.2s", "38s". */
export const secs = (ms: number) =>
  (ms < 10_000 ? (ms / 1000).toFixed(1) : String(Math.round(ms / 1000))) + 's';

/** Minutes and seconds: "2:05". */
export function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
