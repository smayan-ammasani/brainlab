# Progress

The running record of the build. A fresh session should read `CLAUDE.md`, `dev/SPEC.md`, and this file, then continue from "Next up."

## Milestones

- [x] 1. Reaction time, Round 1 (sight). Run-through passes: keyboard, mouse, touch, 360 px, 200% zoom, tab switch, Esc pause, too-soon redo, copy and copy fallback, axe clean, 56.6 KB.
- [x] 2. Reaction time, Round 2 (sight vs. sound). Sound round, skip path, outcome messages, rough-audio note.
- [x] 3. Stroop test (color and numbers versions). Run-through passes: keyboard (colors), touch at 360 px (numbers), mouse at 200% zoom, too-soon, timeout, tab switch, effect and no-effect outcomes, axe clean, 48.5 KB.
- [x] 4. Working memory and chunking. Run-through passes: keyboard typing, touch keypad at 360 px, mouse keypad at 200% zoom, tab switch while digits show, Esc while typing, chunking / same / "under 4" outcomes, axe clean, 46.6 KB.
- [x] 5. Pattern memory and expertise. Run-through passes: keyboard (arrows, Space, Tab to Check), touch at 360 px, mouse at 200% zoom with reduced motion (timer bar static), tab switch during the 5 seconds swaps in a fresh grid, chunking and same outcomes, axe clean (intro, rebuild, results), 52.6 KB.
- [x] 6. Wrapper pages: Home, For Teachers, Privacy, About, Learn More, plus the shared header and footer on every page. Also a draft `404.html` (finished at deploy) and a short `README.md`. Run-through passes on all 9 pages: internal links, keyboard focus visible at every stop, no sideways scroll at 360 px or 200% zoom, axe clean, all pages under 70 KB.
- [ ] 7. Final audit and cleanup

## Next up

Milestone 7 (final audit). Then deployment is a separate step (Prompt 3), which must: replace `[Site Name]` and `[contact email]`, replace `[site root]` in `404.html`, add Open Graph tags and a preview image, add a link to the source repository on the About page, and recheck the outbound links.

## How to run things

- Local preview: `python -m http.server 8000` from the repo root, then open `http://localhost:8000/`.
- Unit tests in Node: `node dev/run-tests.mjs`
- Unit tests in a browser: open `http://localhost:8000/dev/tests.html`
- Browser run-through: `cd dev && npm install` once, then `node dev/e2e.mjs` (all suites) or `node dev/e2e.mjs reaction-time`. It uses the installed Google Chrome (or Edge) through puppeteer-core, serves the repo itself, and saves screenshots to `dev/out/` (gitignored). Takes a few minutes because the experiments run in real time.

## Decisions

- **Dev tools installed (2026-10-15).** Git, Node.js LTS (24.x), and Python 3.13 were not on this machine. With the owner's OK they were installed with winget. New shells may need `C:\Program Files\Git\cmd` and `C:\Program Files\nodejs` on PATH. Dev-only npm packages (puppeteer-core, axe-core) live in `dev/node_modules/`, which is gitignored.
- **Audio onset.** SPEC section 5 says to map the tone time with `getOutputTimestamp()` and then add `outputLatency`. `getOutputTimestamp()` already pairs a sample with the moment the output device played it, so adding `outputLatency` on top would count the speaker delay twice. We add `outputLatency` only in the fallback path (no `getOutputTimestamp`). See `dev/sources.md` T-3.
- **Rough-audio message.** Shown only when the browser has neither `getOutputTimestamp` nor `outputLatency`, as the SPEC says.
- **Sight vs. sound "about the same".** Differences under 10 ms count as "about the same" (`SAME_WITHIN_MS` in `js/reaction-time-logic.js`). With 6 tries per sense, smaller differences are noise.
- **Pause box replaces the stage.** When paused (Esc, the Pause button, or switching tabs), the stage hides and the Paused box takes its place, so the Resume button is always on screen, even on a phone.
- **No-beep hint.** If no one responds 4 seconds after a beep, the stage shows "No beep? Check that your sound is on, or press Pause." The try still counts if they then press (it will be a slow one, left out of the average).
- **Practice to real tries.** After practice, a 2.2-second "Practice done! Now 10 real tries." message, then the real tries start automatically.
- **Favicon request.** Chrome fetches `favicon.svg` right after the load event. It is a same-site static file the browser requests on its own, allowed by the CSP (`img-src 'self'`), and it carries no data, so the run-through ignores it when checking for requests after load. Every other request after load fails the check.
- **Footer on the home page.** CLAUDE.md says "Homepage: no author name" and also "Footer, every page: Built by Smayan Ammasani." Read together: the home page body never names the author, but the standard footer line appears on every page, including home.
- **Footer license links.** The footer names the licenses as plain text ("Code: MIT · Text and diagrams: CC BY 4.0"). The About page links to the license texts. GitHub Pages would serve the extensionless `LICENSE` file as a download, which is a poor link for students.
- **Stroop colors.** ORANGE, BLUE, GREEN, PINK from the Okabe-Ito color-blind-friendly palette, on a darker stimulus panel (`#1c2230`, also used by reaction time) so all four reach at least 4.5:1. Red is not used, so there is no red-versus-green pair. The numbers version is offered at the top for anyone who still finds them hard to tell apart.
- **Stroop "about the same".** Effects under 20 ms in either direction count as "about the same" (`SAME_WITHIN_MS` in `js/stroop-logic.js`).
- **Stroop keyboard.** Keys 1 to 4 answer. Enter or Space on a focused answer button also answers (timed from keydown), so a keyboard user who Tabs to a button isn't stuck.
- **Stroop timeouts.** A try with no answer after 3 seconds counts as a mistake and shows "Time's up!" briefly. Practice tries give feedback ("Correct!" or the right answer); real tries do not.
- **Digit span: one correct try moves up.** SPEC says two tries per length, up if at least one is right, end if both are wrong. If the first try is right, the second can't change the outcome, so we move up right away. Same spans, a shorter task (about 8 minutes instead of 12 or more).
- **Digit span feedback.** Practice tries show the right answer. Real tries say only "Correct!" or "Not this time." so the feedback doesn't give away the hidden patterns before the reveal.
- **Digit span pause.** Pausing (or switching tabs) at any point throws out the current string; Resume shows a fresh string of the same kind and length.
- **Patterned strings.** Chunk pool in `js/memory-logic.js`. Two-digit chunks (24, 60, 12, 50) are used only when a length can't be built from 3s and 4s (lengths 5 and below). '369' was dropped from the pool because it contains a blocked string. Random strings may not contain any pool chunk of 3 or more digits; 2-digit chunks are too common to ban.
- **Blocked strings** (both tracks): 69, 420, 666, 8008, 80085, 58008, 5318008, 1488, 911, 177013.
- **Pattern grids.** 6x6 (the SPEC's default). 16 structured shapes with 10 to 14 cells. Random grids are rejected if they have a straight line of 4 or more (across, down, or diagonal), mirror symmetry, or more than 4 side-by-side touching pairs. Practice uses one shape and one random grid.
- **Pattern pause.** Pausing or switching tabs during the 5-second look throws out that grid and swaps in a fresh one (a new random grid, or an unused shape with the same cell count, so pairs stay matched). Pausing while rebuilding keeps the student's work, since nothing there is timed and there is nothing to gain from leaving.
- **Pattern outcome.** Differences under 10 percentage points count as "close."
- **No script on wrapper pages.** SPEC section 2 says each page has one stylesheet and one module script. The wrapper pages (home, teachers, privacy, about, learn more, 404) have nothing to run, so they load only the stylesheet. Fewer files, nothing to break.
- **Learn More link.** The header holds only the four experiments and For teachers (per SPEC), so Learn More is linked from the home page, the pattern memory page, and the reaction time page's PhET handoff.
- **About page research sentence.** The pattern memory page links to About with "The person who built this site studies this," so the About page adds one sentence: "My own research looks at how expertise shows up in the timing of decisions, like how long chess players think before a move." The owner should confirm this wording.
- **Extra standards.** The bonus round also fits NC 2023 science PS.6.3.2 (light and sight) and PS.6.3.3 (sound and hearing), found while checking the grade 6 and 8 standards. Listed on For Teachers.
- **404 page** is a draft with `[site root]` placeholders, because GitHub Pages serves it at any missing path and relative links would break. Finished at deploy, as the SPEC says.
- **Mean absolute deviation standard.** The SPEC said MAD is grade 6 math. In North Carolina's current standards it is NC.7.SP.3 (grade 7); grade 6 covers center, variability, and dot plots (NC.6.SP.3 to 5). The For Teachers page will say so. See `dev/sources.md` W-3.

## Open problems

None yet.
