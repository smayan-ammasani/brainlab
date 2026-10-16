# CLAUDE.md

This file loads at the start of every Claude Code session. It holds the rules for this project that do not change. The detailed design lives in `dev/SPEC.md`, and the running record of what is done lives in `dev/progress.md`. Read all three before doing anything.

## Working style: hands off

I am handing this project off. I want to come back to a finished, working site. Work on your own from start to finish.

- **Don't wait for my approval.** Plan in your head, then build. When something isn't covered by this file or `dev/SPEC.md`, make the most reasonable choice, write it down in `dev/progress.md` under "Decisions," and keep going.
- **Test everything yourself.** Run the unit tests. Use browser automation to load every page, play through every experiment, check the console, and confirm zero network requests after load. If no browser automation is available, you may install a headless browser as a dev-only tool (see Stack). Never hand me a checklist to run in place of testing.
- **Check the science yourself.** Use web search to confirm every factual claim against a real source, and record it in `dev/sources.md`. If a claim turns out to be wrong, fix the text. Leave `[VERIFY]` only on claims you truly could not confirm.
- **Keep `dev/progress.md` current.** After each milestone, update it: what's done, what's next, decisions made, open problems. It must hold enough for a brand-new session to pick up exactly where you stopped. If your context is getting long, update it, commit, and stop cleanly.
- **Commit as you go.** One commit per working step, with clear messages like `stroop: add numbers version`.
- **Report once, at the end.** When you finish or stop, give me a short summary: what's built, what you couldn't do, any `[VERIFY]` items left, and anything that truly needs me. No step-by-step narration along the way.

### The only reasons to stop and ask me

- A step needs something only I can provide: money, a login, a domain purchase, or DNS settings.
- A hard constraint below cannot be met for some part of the design. Do not break the constraint. Stop and explain.

For everything else: decide, write it down, keep going.

## Project facts

- **Site name:** BrainLab.
- **Domain:** GitHub Pages for now, at `https://smayan-ammasani.github.io/brainlab/` (repo `smayan-ammasani/brainlab`). A custom domain (maybe `brainlabb.org`) may come later; switching needs a `CNAME` file and new absolute URLs in the Open Graph tags and `404.html`. Every internal link must stay relative (no leading `/`).
- **Contact email:** smayan.ammasani@gmail.com.
- **My machine:** Windows, Python 3.13.

## What this is

A free, static website where middle school students run real cognitive experiments on themselves, get their own numbers, and then learn the neuroscience behind those numbers. The measurement is the hook. The explanation is what they stay for.

Four experiments, each a self-contained page:

1. **Reaction time.** Sight first, then sight versus sound.
2. **Stroop test.** Name the ink color while the word spells a different color.
3. **Working memory and chunking.** Digit span, with hidden patterned sequences.
4. **Pattern memory and expertise.** Grid recall, structured versus random. A middle school version of Chase and Simon's chess memory studies.

Plus wrapper pages: home, for teachers, about, learn more, privacy, and a 404 page.

This site does **not** simulate neurons, action potentials, or synapses. PhET's free Neuron simulation already does that well, so we link to it instead of competing with it.

## Who uses it

- **Students, ages 11 to 14,** on school-managed Chromebooks (often 1366x768, often touchscreen), on slow shared wifi, in loud rooms, often without headphones.
- **Teachers** deciding in about five minutes whether to use it. If the tool is good and easy, they will use it. Everything should serve that: fast to understand, nothing to set up, nothing to worry about.
- **A district science curriculum specialist** deciding whether to recommend it. This reader cares about privacy, standards alignment, accessibility, and whether the site looks trustworthy. Give this person nothing to object to.

## Hard constraints

Breaking any of these can get the site blocked by a school's web filter or kept out of classrooms. They are not preferences.

1. **Zero data collection.** No accounts, logins, analytics, cookies, `localStorage`, `sessionStorage`, or IndexedDB. No network requests of any kind after the page loads. Results live in JavaScript variables and vanish on refresh.
2. **Zero third-party requests.** No CDNs, Google Fonts, embedded videos, external images, or external scripts. Everything ships from this repo. Use the system font stack.
3. **A Content Security Policy enforces 1 and 2.** Every page carries the CSP `<meta>` tag defined in `dev/SPEC.md`, including `connect-src 'none'`. Never loosen it.
4. **No permission prompts.** No microphone, camera, location, notifications, or anything else that makes the browser ask the student for permission. No installs or plugins.
5. **Sound is optional.** Every experiment is fully usable with sound off. Audio is an extra, never a requirement.
6. **Small and fast.** Each page, all of its files combined, stays under 150 KB before compression. Diagrams are inline SVG. No video. No raster images unless nothing else works.
7. **Accessible.** Target WCAG 2.1 AA. Everything works by keyboard, focus is always visible, text contrast is at least 4.5:1, every diagram has a text alternative, and nothing relies on color alone except where color is the experiment itself (Stroop), which gets an alternative version. Respect `prefers-reduced-motion`. Nothing flashes more than 3 times per second.
8. **Never diagnostic.** No result is ever framed as normal or abnormal. No percentiles, no "below average," no age norms used to judge the student, no leaderboards. The framing is always "here is how your nervous system works," never "here is whether something is wrong with you." Nothing on this site is aimed at checking anyone for memory decline or any other condition. Make no legal claims (COPPA, FERPA, and so on) anywhere. Just state plainly what the site does and does not do.

## Stack

- Plain HTML, CSS, and JavaScript ES modules. No framework, no build step, no bundler, no runtime dependencies. Do not use jsPsych, D3, or any charting library. Hand-written SVG covers every chart we need.
- One folder per page at the repo root (`reaction-time/index.html` and so on) so URLs are short and clean. Shared code lives in `css/` and `js/`.
- Logic that does math or makes decisions (statistics, scoring, sequence generation, randomization, staircase rules) goes in pure functions with no DOM access, so it can be tested.
- **Tests:** plain ES modules, runnable in Node (`node dev/run-tests.mjs`) and in a browser (`dev/tests.html`).
- **Dev-only tools** (a headless browser for automated testing, for example) are allowed, as long as no page ever loads them and nothing they add reaches visitors. Keep their config under `dev/`, and put `node_modules/` in `.gitignore`.
- **Local preview:** `python -m http.server 8000` from the repo root. ES modules do not load from `file://`.
- **Hosting:** GitHub Pages, served from the root of the `main` branch, with an empty `.nojekyll` file.
- **Visual design:** light theme only. Calm, clean, readable, a little playful. Large type, big buttons, plenty of space. It should feel like a resource from a science museum, not a game and not a portfolio.

## Code style

- **Simple beats clever.** Write the least code that does the job clearly. If a feature is turning into a lot of code, look for a simpler design first.
- **Do not build a framework up front.** Build Experiment 1 directly. When a later experiment needs something an earlier one has, move that piece into `js/lib/` at that point.
- Comment anything non-obvious, especially timing code.
- **No inline `<script>` or `<style>` blocks and no `style="..."` attributes,** in HTML or in inline SVG. The CSP blocks them. Use classes, SVG presentation attributes (`fill="..."`), or set `element.style.property` from JavaScript, which the CSP allows.
- All internal links relative.

## Copy style (anything a student reads)

- Grade 6 to 7 reading level. Short sentences. Speak to the student as "you." Define every science term the first time it appears.
- Use the student's own numbers inside the explanation whenever possible: "Your average was 287 milliseconds. Here is where that time went."
- The main explanation for each experiment runs about 300 to 500 words, split into short sections with at least one diagram. Extra depth goes in `<details>` blocks labeled "Go deeper."
- Every result message is honest and encouraging. Variation between people and between tries is normal and interesting, never bad. Say plainly that many things change these numbers (sleep, practice, the device) and that none of them measure how smart someone is.
- If the student's data does not show the expected effect, the page says so honestly and explains why that can happen. Never pretend the effect showed up.
- No em dashes anywhere: site copy, docs, code comments, or commit messages. Use periods, commas, colons, or parentheses.

## Science accuracy

- Every factual claim on the site traces to an entry in `dev/sources.md`. Prefer open-access papers with DOIs, university pages, BrainFacts.org, and the Society for Neuroscience's *Brain Facts* book. Prefer sources with stable URLs a teacher could open.
- Give timing and capacity numbers as approximate ranges, not falsely precise single values. Never invent a number.
- `dev/SPEC.md` section 14 lists corrections to the original project plan. Follow them.

## Attribution and licensing

- **Homepage:** no author name.
- **Footer, every page:** one small line, "Built by Smayan Ammasani," linking to the About page, plus a license line.
- **Experiment pages** talk about the science and about other researchers, not about me. The pattern memory page may say that researchers now study expertise by timing chess players' moves, with a link to the About page. It does not name me in the body text.
- **Licenses:** code under MIT (`LICENSE`); text and diagrams under CC BY 4.0 (`LICENSE-CONTENT`). Say both in the footer and on the About page.

## Never do these

- Loosen the CSP, or add any network request, browser storage, or third-party file.
- Build anything on the out-of-scope list below, or any page, feature, or experiment not in `dev/SPEC.md`.
- Write anything that sounds like a health claim or a judgment about a student's ability.

## Out of scope

Accounts, saved progress, teacher dashboards, quizzes that save scores, leaderboards, a backend, analytics, service workers, a dark mode, translations, and new experiments. Phase 2 ideas (attention and multitasking, visual illusions, sleep and circadian rhythms, a brain map, a Spanish version) wait until all four experiments are built and launched.

## Definition of done for an experiment page

Check each of these yourself before moving on:

- [ ] Works start to finish with mouse, touch, and keyboard alone (simulate touch in automation where you can)
- [ ] Works with sound off
- [ ] Works at 1366x768 and at 360 px wide, with no sideways scrolling
- [ ] No console errors, and zero network requests after load
- [ ] Switching tabs mid-trial pauses the experiment and throws out that trial instead of recording a bad number
- [ ] Pure logic has passing tests
- [ ] The explanation uses the student's numbers and handles a missing or reversed effect honestly
- [ ] Every claim is sourced in `dev/sources.md`
- [ ] Under the page-weight budget
- [ ] Anything that only a human on real hardware can check is listed in `dev/test-checklist.md` as optional
