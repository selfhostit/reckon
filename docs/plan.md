# Reckon: how it works and what comes next

## Why

Numerical reasoning tests are part of many job applications. A candidate sits an online test
of around 15 questions in 30 minutes, and the employer gets a report that places them on a
1–9 scale (a **stanine**) against other candidates. The questions are mostly visual number
patterns: a row of boxes with one missing, a grid where every row follows the same rule,
figures whose centre is made from the numbers around it. An average result can cost an
interview, and the tests reward practice, yet good practice material is scarce: free sets are
small, and many "numerical" practice tests drill table-reading arithmetic instead of
pattern-finding.

Reckon trains the pattern-finding: endless questions at a difficulty that follows the person,
explanations in plain language, and mock tests that give the same kind of score the reports do.

## What runs where

- **The web app makes and scores the questions** (`web/src/lib/engine.ts`). The engine has no
  dependencies, so it is fast on a phone, works on a slow connection, and is tested on its own.
- **The Go app stores each person's practice** (`backend/migrations/1762000000_practice.go`):
  one `progress` record (levels, XP, XP per day, reminder setting) and a `practice_sessions`
  record per finished lesson or test (every question with the answer given, the time taken and
  any help used, plus a summary). The API rules let each person read only their own; a session
  can't be edited after it is saved.
- **An evening job** (`backend/app/streak.go`) sends a push notification at 19:00 to people
  who turned the reminder on, practised yesterday and not yet today.

The progress screen reads only the session summaries, which carry a tally per question type,
so it stays fast after months of practice; a session's answers are fetched when it is reviewed.

## Questions

Four families, each with levels 1–9 (grids start at 2, figures and function boxes at 3):

- **Series**: built from small rules (add, multiply, alternate two steps, a cycle of three,
  two series interleaved, sums of earlier terms, squares, cubes, primes, changes that follow
  their own pattern). The missing box is the last one at low levels and anywhere later on.
- **Grids**: three rows where the third number is made from the first two by the same rule,
  rows that all add up to the same total, or columns where top + middle = bottom. From level 6
  the missing number can be one of the inputs, which means working backwards.
- **Figures**: plus-shaped clusters and triangles whose centre is made from the outer numbers.
- **Function boxes**: input → output pairs through one hidden operation, with the input
  missing at higher levels.

Every question comes with:

- `think`: how to approach this kind of question, the same for the family (hint, part 1);
- `nudge`: a pointer for this rule that doesn't give the answer away (hint, part 2);
- `guide`: the solution as steps a person would take, each with the worked sums and the cells
  to highlight. The tests check that every sum in every generated solution is right.

A missing input is only asked for when exactly one whole number fits, found by trying them all.

## Lessons and levels

A lesson is eight questions in one family (or a mix of all four): two warm-ups a level below,
five at the person's level and a challenge a level above. Six right **on their own** moves the
skill up a level; two or fewer moves it down. XP: 10 for a right answer, 5 with the hint, none
with the solution, and 20 more for a perfect lesson. The streak counts days with any XP.

## Scoring

Each level has a fixed difficulty on an ability scale: b = (level − 5) × 0.7. A mock test uses
a two-parameter item response model, P(right) = 1 / (1 + e^(−1.3 (θ − b))), and after every
answer works out the expected ability θ given the answers so far, starting from a normal prior
(EAP). The next question is aimed at that estimate, a level either side now and then, rotating
through the families.

The stanine is round(5 + 2θ), limited to 1–9; the margin of error is the spread of the
estimate. In simulations of 15-question tests, the estimate lands within about 0.4 of the true
ability (0.8 of a stanine) for most people, and up to 0.5 at the ends of the scale, where the
prior pulls it towards the middle.

These difficulties are Reckon's own calibration, not a test publisher's norms, so the stanine
is a practice estimate: right for following your own progress, and typically within about one
stanine of a real test.

## Next

- Calibrate the level difficulties from real answers: an optional export of anonymous
  (level, right or wrong) pairs, so the ability scale can be fitted to data.
- More question families seen in these tests: tables and charts, and number analogies.
- A coach view, opt-in per person, for a teacher or career coach to follow a group.
- Timed lessons, to practise the pace as well as the patterns.
