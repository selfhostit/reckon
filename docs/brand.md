# Reckon brand

Reckon's look comes from the questions themselves: **boxes of numbers with one missing**.
The icon is three solid boxes and a dashed fourth one holding a question mark, the same
dashed, gently pulsing box that marks the missing number in every question.

## Colours

| Use | Colour |
| --- | --- |
| Brand, buttons, right answers | emerald (`--color-brand-*` in `web/src/app.css`; buttons use emerald-700 so white text reads at WCAG AA) |
| The missing box in the icon | amber-300, `#fcd34d` |
| Hint | amber |
| Solution walkthrough and highlighted boxes | blue |
| Wrong answers | red |

Green, blue and red always come with an icon or a word as well (a tick, a cross, "Solved with
the walkthrough"), so no state is shown by colour alone.

## Icons

| File | Use |
| --- | --- |
| `web/public/icons/icon.svg` | App icon: favicon, sign-in header |
| `web/public/icons/icon-192.png`, `icon-512.png` | PWA icons, rendered from `icon.svg` |
| `web/public/icons/icon-maskable-512.png`, `apple-touch-icon.png` | Full-bleed versions with the boxes inside the safe zone |

To regenerate the PNGs after changing the SVG, render it at each size (192, 512, and 180 for
`apple-touch-icon.png`) with any SVG renderer, for example `rsvg-convert -w 512 icon.svg`.

## Words

Plain and encouraging. Say what to do ("Try it yourself first"), explain rather than judge
("Not quite. The answer is 17"), and name the trick in everyday words ("the change between
neighbours", not "first-order differences").
