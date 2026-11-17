// Takes the phone screenshots for the README and pull requests, in light and
// dark, from a fresh app with three weeks of someone's practice. CI runs it
// against the built app; to run it yourself:
//
//   make build && dist/reckon serve --dir=/tmp/reckon-shots &
//   cd web && npm i --no-save playwright && npx playwright install chromium
//   RECKON_SETUP_CODE=$(cat /tmp/reckon-shots/setup_code) node scripts/screenshots.mjs ../docs/images/screens
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  estimate,
  makeItem,
  nextAdaptive,
  pCorrect,
  percentile,
  thetaToStanine,
} from '../src/lib/engine.ts';

const base = process.env.RECKON_URL ?? 'http://127.0.0.1:8090';
const out = process.argv[2] ?? 'screenshots';
const email = 'sofia@example.com';
const password = 'screenshots123';
mkdirSync(out, { recursive: true });

async function api(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Sofia is preparing for job applications: three weeks of lessons and four
// mock tests, getting better as she goes
if (process.env.RECKON_SETUP_CODE) {
  await api('/api/app/setup', {
    body: { name: 'Sofia', email, password, code: process.env.RECKON_SETUP_CODE },
  });
}
const auth = await api('/api/collections/users/auth-with-password', {
  body: {
    identity: process.env.RECKON_EMAIL ?? email,
    password: process.env.RECKON_PASSWORD ?? password,
  },
});
const token = auth.token;
const user = auth.record.id;

const day = (ago, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() - ago);
  d.setHours(hour, 10, 0, 0);
  return d;
};
const iso = (d) => d.toISOString().replace('T', ' ');
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const families = ['series', 'grid', 'shapes', 'pairs'];
const days = {};
let xp = 0;

function tally(answers) {
  const t = {};
  for (const a of answers) {
    const f = (t[a.item.family] ??= [0, 0, 0]);
    f[0]++;
    if (a.correct) f[1]++;
    f[2] += a.ms;
  }
  return t;
}

async function save(when, session) {
  const ms = session.items.reduce((n, a) => n + a.ms, 0);
  await api('/api/collections/practice_sessions/records', {
    token,
    body: { user, started: iso(when), ended: iso(new Date(+when + ms)), ...session },
  });
}

for (let ago = 20; ago >= 1; ago--) {
  if (ago === 12 || ago === 6) continue; // two days off
  const theta = -0.6 + (20 - ago) * 0.06;
  const family = families[ago % 4];
  const level = Math.min(9, 2 + Math.floor((20 - ago) / 6) + (family === 'series' ? 1 : 0));
  const items = Array.from({ length: 8 }, (_, i) => {
    const item = makeItem(family, level + [-1, -1, 0, 0, 0, 0, 0, 1][i]);
    const correct = Math.random() < pCorrect(theta + 0.4, item.b);
    return {
      item,
      given: correct ? item.answer : item.answer + 1,
      correct,
      ms: 25_000 + Math.random() * 50_000,
    };
  });
  const correct = items.filter((a) => a.correct).length;
  const gained = correct * 10;
  days[key(day(ago))] = gained;
  xp += gained;
  await save(day(ago), {
    kind: 'practice',
    family,
    level,
    level_after: correct >= 6 ? level + 1 : level,
    items,
    result: { correct, answered: 8, fam: tally(items), change: correct >= 6 ? 1 : 0, xp: gained },
  });

  if ([18, 13, 8, 2].includes(ago)) {
    const answers = [];
    for (let q = 0; q < 15; q++) {
      const item = nextAdaptive(
        answers.map((a) => ({ b: a.item.b, correct: a.correct })),
        answers.map((a) => a.item),
      );
      const correct = Math.random() < pCorrect(theta, item.b);
      answers.push({
        item,
        given: correct ? item.answer : item.answer + 2,
        correct,
        ms: 60_000 + Math.random() * 80_000,
      });
    }
    const est = estimate(answers.map((a) => ({ b: a.item.b, correct: a.correct })));
    await save(day(ago, 20), {
      kind: 'test',
      mode: 'full',
      items: answers,
      result: {
        correct: answers.filter((a) => a.correct).length,
        answered: 15,
        fam: tally(answers),
        theta: est.theta,
        se: est.se,
        stanine: thetaToStanine(est.theta),
        lo: thetaToStanine(est.theta - est.se),
        hi: thetaToStanine(est.theta + est.se),
        pct: percentile(est.theta),
        maxLevel: Math.max(0, ...answers.filter((a) => a.correct).map((a) => a.item.level)),
      },
    });
  }
}
days[key(new Date())] = 30;
await api('/api/collections/progress/records', {
  token,
  body: {
    user,
    xp: xp + 30,
    daily_goal: 50,
    days,
    reminders: true,
    skills: { series: { level: 5 }, grid: { level: 4 }, shapes: { level: 4 }, pairs: { level: 4 } },
  },
});

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });
  // a virtual clock, so answers take a realistic time
  await page.clock.install();
  const think = (seconds) => page.clock.fastForward(seconds * 1000);
  const shot = async (name) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${name}${scheme === 'dark' ? '-dark' : ''}.png` });
  };
  const answer = () => page.evaluate(() => window.reckonAnswer);
  const typeAnswer = async (value, seconds = 35) => {
    await think(seconds);
    await page.getByLabel('Your answer').fill(String(value));
    await page.keyboard.press('Enter');
  };

  // lets the script read each answer (src/lib/demo.ts)
  await page.addInitScript(() => localStorage.setItem('reckon.demo', '1'));
  await page.goto(base);
  await page.getByLabel('Email').fill(process.env.RECKON_EMAIL ?? email);
  await page.getByLabel('Password').fill(process.env.RECKON_PASSWORD ?? password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Your level').waitFor();
  await shot('today');

  // a lesson: the hint, the walkthrough, a right answer and a level up
  await page.goto(`${base}/#practice`);
  await page.getByRole('button', { name: /Number grids/ }).click();
  await page.getByRole('button', { name: /Hint/ }).click();
  await shot('hint');
  await page.getByRole('button', { name: /Show solution/ }).click();
  await page
    .getByRole('button', { name: /Next step/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: /Next step/ })
    .first()
    .click();
  // the question at the top, the newest step below it
  await page.evaluate(() => scrollTo(0, 70));
  await shot('solution');
  await typeAnswer(await answer());
  await page.getByRole('button', { name: 'Continue' }).click();
  await typeAnswer(await answer());
  await shot('correct');
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'Continue' }).click();
    await typeAnswer(await answer());
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText(/unlocked/).waitFor();
  await shot('level-up');

  if (scheme === 'light') {
    // a quick mock test, answered like someone around stanine 6
    await page.goto(`${base}/#test`);
    await page.getByRole('button', { name: /Quick check/ }).click();
    await page.getByRole('button', { name: /Start the quick check/ }).click();
    for (let q = 0; q < 8; q++) {
      if (q === 2) {
        await think(48);
        await shot('mock-test');
      }
      const right = await answer();
      await typeAnswer(q % 3 === 2 ? right + 3 : right, 55 + 15 * (q % 3));
    }
    await page.getByText('Stanine', { exact: true }).waitFor();
    await shot('test-result');
  }

  await page.goto(`${base}/#progress`);
  await page.getByText('Mock test results').waitFor();
  await shot('progress');

  if (scheme === 'light') {
    await page.locator('a[href^="#review-"]').first().click();
    await page
      .getByText(/Your answer/)
      .first()
      .waitFor();
    await shot('review');
  }
  await page.close();
}
await browser.close();
console.log(`Screenshots saved in ${out}`);
