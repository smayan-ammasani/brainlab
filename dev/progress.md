# Progress

The running record of the build. A fresh session should read `CLAUDE.md`, `dev/SPEC.md`, and this file, then continue from "Next up."

## Milestones

- [ ] 1. Reaction time, Round 1 (sight)
- [ ] 2. Reaction time, Round 2 (sight vs. sound)
- [ ] 3. Stroop test (color and numbers versions)
- [ ] 4. Working memory and chunking
- [ ] 5. Pattern memory and expertise
- [ ] 6. Wrapper pages: Home, For Teachers, Privacy, About, Learn More, plus the shared header and footer on every page
- [ ] 7. Final audit and cleanup

## Next up

Milestone 1.

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
- **Mean absolute deviation standard.** The SPEC said MAD is grade 6 math. In North Carolina's current standards it is NC.7.SP.3 (grade 7); grade 6 covers center, variability, and dot plots (NC.6.SP.3 to 5). The For Teachers page will say so. See `dev/sources.md` W-3.

## Open problems

None yet.
