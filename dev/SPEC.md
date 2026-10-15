# SPEC.md

The detailed design for every page. `CLAUDE.md` holds the rules; this file holds the decisions. If this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins; note the conflict in `dev/progress.md`.

Anything marked **[VERIFY]** is a claim or number that has not been confirmed yet. Confirm it with a real source, record it in `dev/sources.md`, and fix the text if it turns out to be wrong.

## Contents

1. File structure
2. Every page: head, CSP, header, footer
3. Experiment page anatomy
4. Shared timing rules
5. Experiment 1: Reaction time
6. Experiment 2: Stroop test
7. Experiment 3: Working memory and chunking
8. Experiment 4: Pattern memory and expertise
9. Wrapper pages
10. Standards alignment
11. Accessibility details
12. Testing
13. Deployment
14. Corrections to the original plan

---

## 1. File structure

```
index.html                  Home
reaction-time/index.html
stroop/index.html
memory/index.html           Working memory and chunking
patterns/index.html         Pattern memory and expertise
teachers/index.html
about/index.html
learn-more/index.html
privacy/index.html
404.html                    Finished last, once the domain is known
css/site.css
js/reaction-time.js         One entry module per experiment
js/stroop.js
js/memory.js
js/patterns.js
js/lib/                     Shared modules, created only when a second page needs them
favicon.svg
dev/SPEC.md                 This file
dev/progress.md             Milestones, decisions, open problems (so any session can resume)
dev/sources.md              Every factual claim and its source
dev/test-checklist.md       Optional checks only a human on real hardware can do
dev/tests/*.test.js         Unit tests (pure functions only)
dev/run-tests.mjs           Node test runner
dev/tests.html              Browser test runner
CLAUDE.md
README.md
LICENSE                     MIT, for code
LICENSE-CONTENT             CC BY 4.0, for text and diagrams
.nojekyll
.gitignore                  node_modules/ and any other dev-tool output
```

Folder-per-page gives teachers short links like `.../stroop/`.

---

## 2. Every page

### Head

- `<html lang="en">`, `<meta charset="utf-8">`, a viewport meta tag, a specific `<title>` (for example "Stroop Test | [Site Name]"), and a one-sentence `<meta name="description">`.
- This CSP, exactly:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
```

- `<meta name="referrer" content="no-referrer">`, so outbound links (PhET and others) do not tell other sites which page a student came from.
- One stylesheet and one `<script type="module" src="...">`. Nothing inline.

### Header

The site name (linking home), links to the four experiments, and "For teachers." At 360 px wide the links wrap onto more lines. No JavaScript menu.

### Footer

One small line: "Built by Smayan Ammasani" (links to About) · Code: MIT · Text and diagrams: CC BY 4.0 · Privacy (links to Privacy).

Under it: "No accounts. No tracking. Nothing you do here leaves your device."

---

## 3. Experiment page anatomy

Every experiment page follows the same shape, so students and teachers learn it once.

1. **Title and hook.** One line that makes them want to try it. ("How fast is your brain?")
2. **What you'll do.** Two or three sentences, an estimated time, and a note on sound ("Works with sound off").
3. **Start button.** Large. Nothing timed happens until it is pressed.
4. **Practice.** A few trials, clearly labeled "Practice," not scored, with feedback.
5. **Trials.** A progress indicator ("4 of 10"), a visible way to pause or quit, and nothing else on screen to distract.
6. **Your results.** Their numbers, one simple chart, and a "Copy my results" button.
7. **What just happened in your brain.** The explanation, using their numbers, with a diagram.
8. **The twist,** where the experiment has one. A second round or a reveal, its results, and its explanation.
9. **Talk about it.** Two or three discussion questions a teacher could put on the board.
10. **Go deeper.** `<details>` blocks with more science, then links: "Try it again," "Next experiment," and relevant outside resources.

**Copy my results.** Copies a plain-text summary to the clipboard with `navigator.clipboard.writeText`, which does not show a permission prompt when triggered by a click. Example: `Reaction time (sight): average 287 ms, fastest 241 ms, typical spread 23 ms, 10 trials.` No name and no identifiers. If the clipboard call fails, show the text pre-selected in a box so the student can copy it by hand. This lets a teacher collect class data in their own spreadsheet while the site stores nothing.

**State.** Each page is a small state machine (intro, practice, trials, results, twist, explanation). On every state change, move keyboard focus to the new section's heading and announce it in an `aria-live="polite"` region. "Try it again" resets the state without reloading the page.

---

## 4. Shared timing rules

These apply to every timed measurement on the site.

- **One clock.** All times come from the `performance.now()` timeline. Use `event.timeStamp` for responses, because it records when the input happened rather than when the handler ran, and in current browsers it is on the same timeline [VERIFY across Chrome, Firefox, Safari].
- **Respond on press, not release.** Listen for `pointerdown` and `keydown`. Never use `click` for timed responses: `click` fires when the finger lifts, which adds however long the button was held (often around 100 ms) [VERIFY order of magnitude]. Ignore `keydown` events where `event.repeat` is true. Do not let Space also activate whatever button has focus.
- **Visual onset.** Change the screen inside a `requestAnimationFrame` callback, and take the timestamp passed to the *next* `requestAnimationFrame` callback as the onset estimate. That is the closest JavaScript gets to the moment the new frame reached the screen. Some display delay remains that no web page can measure, and the explanation says so.
- **Random waits.** The delay before each stimulus is random so students cannot predict it. (Reaction time: 1.5 to 4 seconds.)
- **Too soon.** A response before the stimulus shows "Too soon! Wait for it." and the trial is redone. A response less than 100 ms after onset counts as a guess: same message, redo. (Possible fact for the explanation: sprinting uses a similar 100 ms rule to decide false starts [VERIFY].)
- **Lapses.** Reaction-time responses over 1,500 ms appear on the chart but are left out of the average, with a short note.
- **Tab switching.** If `document.visibilityState` becomes `hidden` mid-trial, cancel that trial, pause, and show "Paused" with a Resume button.
- **Seeded randomness.** Route all randomness through one small seeded generator (for example mulberry32) in a pure module, so tests can reproduce sequences. In production, seed it from the clock.
- **Device honesty.** Web pages, screens, keyboards, and speakers all add delay. Studies of browser-based experiments have measured this lag and how much it varies by device (Bridges et al., 2020, *PeerJ*; Anwyl-Irvine et al., 2021, *Behavior Research Methods*) [VERIFY both]. Results pages tell students, in plain words, that their true number is probably a little faster than the one shown.

---

## 5. Experiment 1: Reaction time

**Teaches:** the path a signal takes from sense organ to brain to muscle, and that most of the time is spent processing in the brain, not traveling down the arm.

### Round 1: Sight

- A large panel (most of the screen) shows calm dark gray with the text "Wait for it..."
- After the random wait, the panel turns a bright color **and** a large shape or the word "NOW!" appears, so the change does not depend on color vision. No saturated red, and nothing that reads as an alarm.
- The student presses anywhere on the panel or presses Space.
- 3 practice trials, then 10 scored trials. Show the time after each trial ("246 ms").

### Results

- A dot plot: one dot per trial along a millisecond axis, with the average marked.
- Three numbers: **average** (mean of valid trials), **fastest**, and **typical spread**, which is the mean absolute deviation phrased as "On average, your tries were 23 ms away from your average." Mean absolute deviation is part of 6th grade math, so teachers will recognize it [VERIFY NC math standard code].
- No comparison to norms. The explanation may say that people typically react to a light within a certain range [VERIFY range and source], framed as a fact about humans, not a grade.

### Explanation: "Where did your 287 milliseconds go?"

- A horizontal diagram of the pathway: eye (retina) → thalamus → visual cortex at the back of the brain → areas that decide → motor cortex → spinal cord → nerve → muscle → finger. Simple, original inline SVG with a text description.
- Below it, a bar split into stages, each with an approximate time range from a source [VERIFY every range]. The time left over between the stages' total and the student's average goes in a final segment labeled "deciding and pressing, plus your device's delay," because that is where most of the difference between people, and between tries, lives.
- Key ideas: nerve signals are electrical impulses that travel along neurons and cross synapses, and every step takes time. The slow parts are turning light into a nerve signal and processing it in the brain. The trip down the arm is a small share.
- A one-line handoff: "Want to see how a single neuron fires? PhET's Neuron simulation shows it better than we could," with the link.

### Round 2 (the twist): Sight versus sound

- Offered after Round 1, with "Turn your sound on for this one" and a "Skip, my sound is off" button. Skipping still shows the explanation, using typical values from sources that are clearly labeled as typical, not theirs.
- Warning: "Wireless (Bluetooth) headphones add delay and can ruin this comparison. Use speakers or wired headphones." [VERIFY that typical Bluetooth latency is large compared to the effect]
- **Design:** 12 scored trials that alternate in a fixed pattern (sound, sight, sound, sight...). During each wait, an icon (ear or eye) shows which kind is coming, so the type is never a surprise. Alternating cancels the practice effect that would make a later block of sound trials look faster just because it came second.
- **Sound:** a short tone (about 100 ms, around 1,000 Hz) generated with the Web Audio API, with a few milliseconds of fade in and out to avoid a click. No audio files.
- **Audio timing:** create or resume the `AudioContext` inside the Start button's handler, since browsers block audio until the user interacts. Schedule the tone at a known `AudioContext` time, convert that time to the `performance.now()` timeline with `getOutputTimestamp()`, and add `outputLatency` where the browser provides it. Feature-detect both. If neither exists, still run the round but tell the student the comparison will be rough on their device.
- **Results:** two bars (sight average and sound average) and the difference.

### Twist explanation: why sound is usually faster

Use this explanation, not the one in the original plan (see section 14):

- In the ear, sound waves bend tiny hair-like bundles on hair cells. The bending directly opens channels and starts a nerve signal almost instantly.
- In the eye, light has to trigger a chain of chemical reactions inside rod and cone cells before any nerve signal exists. That chemical step is slow by comparison.
- So hearing signals reach the brain's hearing area well before vision signals reach the vision area, even though the hearing pathway passes through more relay stations on the way [VERIFY approximate cortical arrival times for each sense, and the relay counts].
- If the student's sound time was not faster, say so and give the likely reasons: speaker or Bluetooth delay, too few trials, attention. This is a real lesson in why scientists use careful equipment and many trials.

### Talk about it (examples)

- Why might races start with a sound instead of a light?
- Did your times get faster as you went? Why might that happen?
- What else might change your reaction time? How could you test that fairly?

---

## 6. Experiment 2: Stroop test

**Teaches:** automaticity (well-practiced skills run without asking permission) and cognitive control (the front of the brain working to override them).

### Warm-up: say it out loud

- A static grid of about 20 color words, each printed in a mismatched ink color. Instruction: "Say the ink color of each word out loud, as fast as you can. Not the word. The color." No timing and no input.
- Then: "Did you feel your brain fighting you? Now let's measure it."
- This costs almost no code, and it makes the effect felt before it is measured.

### Measured version

- **Colors:** four color words and four ink colors. Choose four colors that are clearly different from each other and readable as large bold text on the stimulus background, and check each one's contrast against it. Where possible, avoid relying only on red versus green. Record the choice and the contrast ratios in `dev/sources.md`.
- **Responding:** four large buttons in a fixed row, each labeled with a color word in plain dark text (not colored), with keys 1, 2, 3, 4 mapped left to right and shown on the buttons. Word-labeled buttons keep the "say the color" conflict that makes the Stroop effect work.
- **Trials:** 8 practice trials with feedback. Then 40 scored trials: 20 matching (BLUE printed in blue) and 20 mismatching (BLUE printed in red), in random order, with no more than three of the same type in a row and never the same word twice in a row. A fixation cross shows for 500 ms, then the word stays until the student responds (time out at 3 seconds, counted as a miss).
- **Scoring:** time only correct trials. Report the average for matching trials, the average for mismatching trials, the difference (the "Stroop effect"), and the number of mistakes for each type.

### Numbers version (an equal option, not a lesser one)

For students who have trouble telling the colors apart, or who simply prefer it. Offer it at the top of the page to everyone: "Prefer numbers? Some people find the colors hard to tell apart. Try the numbers version."

Show a row of identical digits, such as `4 4`, and ask how many digits there are (answer: 2). Matching trials agree (`2 2`); mismatching trials disagree (`4 4`, `3 3 3 3`). Response buttons 1 to 4. Same trial counts, scoring, and results layout. The explanation adapts: reading a digit is automatic, and counting takes effort.

### Results

Two bars (match and mismatch) and a sentence with the student's own number: "Your brain needed an extra 112 ms when the word and the color fought each other."

### Explanation

- For a practiced reader, reading is automatic. Your brain reads the word whether you want it to or not.
- To answer correctly, your brain has to notice the conflict and then boost the ink color over the word. Researchers link noticing conflict to a region called the anterior cingulate cortex, and the boosting to the prefrontal cortex at the front of the brain [VERIFY the framing is accurate at this level].
- That override takes time. It is the extra milliseconds they just measured.
- Go deeper: John Ridley Stroop's original 1935 study, and the fact that this "brakes and steering" system keeps maturing through the teen years and into adulthood [VERIFY; avoid the oversimplified "the brain finishes developing at 25" claim].
- If no effect showed up: some people find strategies (like blurring their eyes), and 20 trials of each type is not many. Invite them to try again.

### Talk about it (examples)

- What else do you do automatically that would be hard to stop?
- Would someone just learning to read show a bigger or smaller Stroop effect? Why?

---

## 7. Experiment 3: Working memory and chunking

**Teaches:** working memory has a small, hard limit, and it is a different system from long-term memory. Chunking (using what you already know to pack more into each slot) gets around the limit. That is the mechanism behind expertise, which sets up Experiment 4.

### Task: digit span

- Digits appear one at a time in large type: about 800 ms on, then 200 ms blank. The blank matters, because it makes a repeated digit visible as two separate digits.
- Then the student types the sequence on an on-screen keypad (0 to 9, backspace, submit) or the physical keyboard, and submits.
- 2 practice trials at length 3, with feedback.

### Design: two hidden, interleaved tracks

- A **random track** and a **patterned track** run at the same time, alternating trial by trial. The student is *not* told that some sequences contain patterns.
- Each track is its own staircase. Start at length 4, with two trials per length. If at least one trial at a length is correct, go up by one. If both are wrong, that track ends. Span is the longest length with at least one correct. Cap the random track at 12 and the patterned track at 16. When one track ends, the other continues alone.
- Why interleave: running all the random trials first and the patterned ones second would mix practice in with chunking. Interleaving also sets up a better reveal.

### Random sequences

- No digit repeated back to back. No runs of three counting up or down (4-5-6, 9-8-7). No accidental familiar chunks from the patterned pool.
- In both tracks, block number strings that middle schoolers will turn into jokes (for example 69, 420, 666). Add others you think of.

### Patterned sequences

- Built by joining chunks from a pool of numbers that a typical 11 to 14 year old already knows, until the target length is reached exactly. Presented one digit at a time, exactly like random sequences, with no spacing hints. The meaning is in the digits themselves.
- Pool ideas: counting runs (1234, 2468, 1357, 9876), doubles and repeats (1122, 777), round numbers (100, 500, 1000), everyday numbers (365, 24, 60, 12), recent years (2000, 2020, 2025, 2026). Leave out numbers that need specific cultural or historical knowledge (such as 1776), since not every student has it.

### The reveal and results

- "Surprise. Half of those sequences were hiding patterns." Show both spans side by side as bars.
- Show one patterned sequence they got right, split into its chunks: `2468 | 1000 | 365` is "11 digits, but only 3 things to remember."

### Explanation

- Working memory is the mind's small workspace: what you are holding right now, like a number you are about to type. It is not the same as long-term memory.
- Miller (1956) famously described a limit of about seven items. Later work suggests the true limit is closer to about four chunks when people cannot rehearse or group things (Cowan, 2001) [VERIFY]. Digit spans come out bigger than four because people silently repeat the digits and find groups.
- Chunking: the number of slots did not change. What changed is how much each slot held. The chunks came from long-term memory: you already knew 2468.
- The handoff: "Experts don't have bigger working memories. They have better chunks. Experiment 4 tests that."
- If the spans were equal or reversed, explain honestly: they may not have noticed the patterns, or they may have done unusually well on the random ones.
- Never call digit span an IQ test or a measure of intelligence.

### Talk about it (examples)

- How do you remember a phone number or a locker combination?
- What do you know so well that it feels like one chunk instead of many pieces?

---

## 8. Experiment 4: Pattern memory and expertise

**Teaches:** experts in any field see meaningful chunks where beginners see separate pieces, so expert memory comes mostly from knowledge, not raw capacity. A middle school version of the chess memory studies of Chase and Simon (1973).

### Task

- A 6x6 grid (try 7x7 if 6x6 turns out too easy in testing). Some cells are filled.
- The grid shows for 5 seconds with a simple progress bar (static if `prefers-reduced-motion` is set), then clears.
- The student taps or clicks cells to rebuild it, then presses Check.
- Keyboard: arrow keys move between cells, Space toggles a cell, and Check is reachable by Tab. The whole grid is one tab stop (roving `tabindex`), and each cell is a button with `aria-pressed`.
- After each trial, overlay their answer on the original, marking correct, missed, and extra cells by shape as well as color (for example a filled square, an outline, and an X).

### Trials

- 2 practice trials, then 8 scored: 4 structured and 4 random, in random order. Each structured grid is paired with a random grid that has exactly the same number of filled cells (aim for 10 to 14).
- **Structured library:** letters (L, T, H, E, Z), shapes (square outline, plus sign, X, diamond, arrow), symmetric figures, staircases, borders. Store each as a list of cells with its count.
- **Random grids:** same count, scattered. Reject a candidate that accidentally looks structured (a straight line of four or more, mirror symmetry, or too many filled cells touching). Keep the check simple.
- **Score per trial:** correct cells minus extra cells, floored at zero, divided by the number of filled cells. Report the average percent for structured grids and for random grids.

### Explanation

- Same amount of information, very different scores. The structured grids fit chunks you already know ("that's a T"), so you remembered a few chunks instead of a dozen separate squares.
- The chess story: in the 1970s, Chase and Simon showed chess positions to players for about five seconds. Masters rebuilt real game positions far better than beginners. With the pieces placed randomly, the masters' advantage mostly disappeared. Later work (Gobet and Simon, 1996) found that masters keep a small edge even on random boards, so the site says "mostly," not "completely." [VERIFY both]
- The masters had not grown bigger memories. Years of play had given them a huge library of familiar chunks.
- The same idea explains expertise in music, sports, reading X-rays, and reading words, which ties back to the Stroop test.
- A small static SVG of two chessboards (a realistic position and a scrambled one) would help. Original drawing, simple pieces. Optional if it breaks the page budget.
- **Where this leads:** researchers now study expertise by timing decisions. For example, how long a chess player pauses before a move can show whether they recognized a familiar pattern or had to work something out from scratch. Link to the About page here ("The person who built this site studies this"). Do not name me in the body text.

### Talk about it (examples)

- What are you an expert in? What chunks do you have that a beginner doesn't?
- Why might a doctor spot something on an X-ray in seconds that a new student would miss?

---

## 9. Wrapper pages

Build these only after all four experiments work.

### Home

- A headline and one sentence: run real experiments on your own brain and find out what your numbers mean.
- Four experiment cards in order (speed, control, memory, expertise), each with a one-line hook, a time estimate, and a "Works with sound off" note.
- A visible link: "Teachers: how to use this in class."
- No author name.

### For teachers

The page a curriculum specialist will actually read. Keep it scannable.

- What this is, in two sentences. Free. No accounts. No student data collected or sent. Works on Chromebooks. Sound optional.
- How to use it: a suggested flow for a 45-minute class, and the time each experiment takes.
- A table: experiment, time, what students learn, NC standard supported, discussion questions.
- The science-practice angle: every twist is a controlled comparison in which one thing changes (sight vs. sound, match vs. mismatch, random vs. patterned). Students analyze and interpret their own data.
- Class data idea: students click "Copy my results" and paste into the teacher's own form or spreadsheet, so the class can compare averages and spreads. The site itself stores nothing.
- A privacy summary linking to the Privacy page.
- The contact email.

### Privacy

Short and plain.

- What the site does not do: accounts, cookies, browser storage, analytics, tracking, or sending results anywhere.
- How we know: the page's security policy blocks it from sending data. Explain `connect-src 'none'` in one plain sentence.
- What we cannot control: the hosting provider (GitHub Pages) may keep standard server logs, including visitors' IP addresses, for security [VERIFY against GitHub's current Pages documentation, and link to it]. Links to other sites follow those sites' own policies.
- No legal claims.

### About

Two or three sentences in plain first person, written from this: a student at Weddington High School (Class of 2028) studying computational neuroscience, who built this because most middle school neuroscience resources are static text; free for anyone to use. Use "Class of 2028" rather than "junior" so it does not go stale. Then the contact email and the licenses.

### Learn more

Each link with one sentence on what students will find there:

- **PhET Neuron simulation** (University of Colorado Boulder): how a single neuron fires, ion channels, action potentials. It is HTML5 and runs on Chromebooks.
- **Neuroscience for Kids** (Eric Chudler): deep, kid-friendly material on brain anatomy and much more. Chudler retired from the University of Washington in July 2025 and has said the site will continue, but check that the link still works right before launch.
- **BrainFacts.org** (Society for Neuroscience).

Check every outbound link before launch.

### 404

Finished during deployment, once the domain is known, so its links work from any path.

---

## 10. Standards alignment

[VERIFY every code and its wording at dpi.nc.gov before putting it on the site]

- **NC 2023 Science, Grade 7, LS.7.1.4:** construct an explanation of how the major systems of the human body interact to support life, including the nervous system. All four experiments.
- **Science and Engineering Practices** embedded in the 2023 NC science standards: planning and carrying out investigations, and analyzing and interpreting data. Every twist.
- **NC Grade 6 Math, statistics:** mean absolute deviation as a measure of spread. Reaction time results.
- Check the grade 6 and grade 8 science standards too, in case another objective fits better. Put the final mapping on the For Teachers page.

---

## 11. Accessibility details

- Timed tasks fall under WCAG's exception for real-time activities where timing is essential. Instructions and explanations are never timed, and every timed phase starts only when the student presses Start.
- Each experiment page says plainly which parts work without seeing the screen. (The sound round of Reaction Time does; most of the rest does not.) Do not overpromise.
- Touch targets at least 44 by 44 px.
- One `aria-live="polite"` region per page for status updates. Focus moves to each new section's heading.
- Every SVG diagram has a `<title>` and a longer text description nearby.
- Test keyboard-only, at 200% browser zoom, and with ChromeVox if possible.

---

## 12. Testing

- **Unit tests** (pure functions only): mean, median, mean absolute deviation; the seeded random generator; every trial-list builder, checked over 1,000 generated lists (no banned numbers, no runs, no back-to-back repeats, correct counts per condition, structured and random grids matched in cell count); staircase logic; grid scoring.
- **Automated browser run-through** of every page: mouse, simulated touch, keyboard only, sound off, switching tabs mid-trial, 360 px wide, 200% zoom, try again, copy results. Play each experiment to the end at least once with realistic simulated responses and confirm the results and explanation render correctly.
- **Network check:** record network activity during the run-through and confirm nothing is requested after load. Search the repo for `http` and confirm every hit is an outbound link.
- **Accessibility and performance audits** on every page (Lighthouse or axe-core, run as dev-only tools).
- **Optional human checks,** listed in `dev/test-checklist.md` and never blocking: one run on a school-managed Chromebook (ideally UCPS-issued, since it runs the district's real web filter), and a screen reader pass with ChromeVox.

---

## 13. Deployment

- Public GitHub repo, Pages served from the `main` branch root, `.nojekyll`, HTTPS enforced.
- Do the setup yourself with the GitHub CLI (`gh`) if it is installed and logged in: create the repo, push, turn on Pages, and set the custom domain. Hand me only what truly needs me, such as DNS records at my domain registrar.
- `README.md`: what the site is, why it exists, how to run it locally, and the licenses. Short.
- Once the domain is decided: add `CNAME`, finish `404.html`, and add Open Graph tags (title, description, and a small original preview image) so links shared in teacher groups show a clean preview.
- Some school web filters block `github.io` sites as a group, and some block newly registered domains. A custom domain registered well before February lowers that risk.

---

## 14. Corrections to the original plan

These override the plan document wherever they differ.

1. **Start with Reaction Time, not the action potential.** The plan's "order of work" still said to start with the action potential, left over from an earlier version that simulated neurons. Neuron simulation is out of scope.
2. **Why sound beats sight.** The plan said auditory reaction time is faster "because the auditory pathway is shorter." The hearing pathway actually passes through more relay stations than the visual one. The main reason is transduction: hair cells respond mechanically and almost instantly, while photoreceptors depend on a slower chemical cascade. Use the explanation in section 5.
3. **Chase and Simon, stated precisely.** The plan said masters "perform no better" on random boards. Later work found a small expert advantage remains. Say the advantage "mostly disappeared."
4. **The capacity limit.** The plan says digit span is "usually around seven." That is a typical digit span, but the modern estimate of working memory capacity is closer to four chunks. The explanation covers both.
5. **The sound twist can fail on real devices.** Browser and Bluetooth audio delay can be as large as the effect itself. The design and the copy account for that.
6. **Practice effects.** Running a twist round after the main round makes the twist look better partly because of practice. Reaction time alternates trial types; working memory and pattern memory interleave conditions.
7. **Analytics.** The plan lists privacy-preserving page-view counts as a success measure, but any analytics script is a third-party request. It is out of scope for the build. Adding it later is my decision and requires changing the CSP.
8. **Licensing.** Creative Commons recommends against using CC licenses for software, so code is MIT and content is CC BY 4.0.
9. **Teacher and Privacy pages.** Not in the plan's wrap-up list, but added because they are what a curriculum specialist reads first.
