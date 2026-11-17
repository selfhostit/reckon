# Changelog

What changed in each release of Reckon. Installs update to the newest release; see
[docs/deploy.md](docs/deploy.md#updates-and-versions).

## 0.1.1 (2026-11-17)

- The worker image builds for armv7 (32-bit Raspberry Pi) again, so the release publishes
  every image. 0.1.0's release build stopped there.

## 0.1.0 (2026-11-17)

The first release: practice for the numerical reasoning tests used in job applications.

- Four kinds of question, each with nine levels: number series, number grids, number
  figures and function boxes, generated fresh every time.
- Lessons of eight questions with instant feedback. Six right on your own moves a skill up a
  level.
- A **Hint** under every question: how to think about this kind of question, and a pointer
  for this one that doesn't give the answer away.
- **Show solution**: a plain-language walkthrough, one step at a time, highlighting the boxes
  each step is about.
- Adaptive mock tests, full (15 questions, 30 minutes) or quick (8 questions, 12 minutes),
  scored as a stanine from 1 to 9 with its margin of error, the score per question type and
  what to practise next.
- Progress: test results over time, accuracy and pace per question type, four weeks of
  activity, and every lesson and test to review with its worked solutions.
- XP, a daily goal and a streak, with an optional evening reminder when the streak would
  break.
- Each person's practice is private to them, the owner included; download it as a file or
  start again from **Me**.
- Built on plasto: setup code, accounts for a household, rate-limited sign-in, a locked-down
  container, nightly backups, signed images and security scans. Includes Shoppa's fix for push
  notifications on iPhones and Troye's fix for missed-job checks.
