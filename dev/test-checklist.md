# Optional human checks

Everything below is optional and never blocks launch. The automated run-through (`node dev/e2e.mjs`) already covers mouse, simulated touch, keyboard only, sound off, tab switching, phone width, 200% zoom, reduced motion, copy results, console errors, network requests, page weight, and an axe-core accessibility audit on every page. These are the things only a person on real hardware can check.

## School Chromebook (most important)

- [ ] Open the site on a school-managed Chromebook, ideally a UCPS-issued one, on the school network. This is the only way to learn whether the district's web filter blocks it.
- [ ] Play one experiment start to finish with the touchscreen and once with the keyboard.
- [ ] Reaction time: do the bonus sound round with the Chromebook's own speakers. Is the beep clearly audible? Is sound usually faster?

## Screen reader

- [ ] Turn on ChromeVox (Ctrl + Alt + Z on a Chromebook). Check that each page's headings, buttons, and results are read sensibly, and that the status messages are announced.
- [ ] Reaction time bonus round: the sound tries should be doable without looking at the screen.

## Real devices and audio

- [ ] Reaction time on an iPad or iPhone (Safari): taps register, the beep plays after pressing Start, and nothing zooms on double tap.
- [ ] Try the bonus round once with Bluetooth headphones to see the delay the page warns about. Sound should look slower than usual.

## Difficulty with real students

- [ ] Pattern memory: if most students score close to 100% on the random grids too, the 6x6 grid is too easy. The SPEC allows 7x7: change `SIZE` in `js/patterns-logic.js` and redraw the shapes for 7 columns.
- [ ] Working memory: check that a typical run takes about 8 minutes. If it runs much longer, consider a lower cap for the patterned track (`CAPS` in `js/memory-logic.js`).
- [ ] Stroop: on a real Chromebook screen, check that ORANGE, BLUE, GREEN, and PINK are easy to tell apart at a glance.

## Look and feel

- [ ] Read one explanation page aloud. Does it sound like something a 6th or 7th grader would follow?
