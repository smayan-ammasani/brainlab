# BrainLab

A free, static website where middle school students run real cognitive experiments on themselves, get their own numbers, and then learn the neuroscience behind those numbers.

Live site: https://smayan-ammasani.github.io/brainlab/

Four experiments:

1. **Reaction time**: sight, then sight versus sound.
2. **Stroop test**: name the ink color while the word spells a different color (with a numbers version).
3. **Working memory and chunking**: digit span with hidden patterned strings.
4. **Pattern memory and expertise**: grid recall, shapes versus random scatters.

## Why

Most middle school neuroscience resources are text to read. Here, students measure their own nervous systems first, and the explanation uses their own numbers.

## Privacy

No accounts, cookies, browser storage, analytics, or third-party files. Every page carries a Content Security Policy with `connect-src 'none'`, so nothing can be sent after the page loads.

## Run it locally

ES modules don't load from `file://`, so use a local server from the repo root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000/.

Tests:

```bash
node dev/run-tests.mjs
```

The browser run-through (dev-only, needs Chrome or Edge) is described in `dev/progress.md`.

## Project docs

- `CLAUDE.md`: the rules for the project.
- `dev/SPEC.md`: the design.
- `dev/progress.md`: what's done and the decisions made.
- `dev/sources.md`: the source for every factual claim.

## License

- Code: MIT (see `LICENSE`).
- Text and diagrams: CC BY 4.0 (see `LICENSE-CONTENT`).
