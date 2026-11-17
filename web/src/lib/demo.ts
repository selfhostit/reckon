// The screenshot script (web/scripts/screenshots.mjs) answers some questions
// right, so it turns this on to read the current answer. It is off unless
// localStorage has reckon.demo = 1; answers are worked out in the browser
// anyway, so it reveals nothing a person couldn't see in the dev tools.
const on = (() => {
  try {
    return localStorage.getItem('reckon.demo') === '1';
  } catch {
    return false;
  }
})();

export function showAnswer(answer: number) {
  if (on) (window as unknown as { reckonAnswer: number }).reckonAnswer = answer;
}
