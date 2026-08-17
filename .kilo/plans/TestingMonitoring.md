# Testing & Monitoring

**Do this first.** Every other plan in this directory claims a byte or millisecond number.
Without these guards those numbers are assumptions, and the regressions they are meant to
prevent are exactly the kind that already happened here — a 47 KB JSON catalog was inlined
into the frontend bundle and went unnoticed.

---

## 1. Byte budgets in CI — DONE ✅

**Why first.** The single largest finding in this whole review —
`assets/presets/layouts.json` inlined into `main-frontend.js` — was invisible because
nothing watches bundle size. A five-line check would have caught it the day it landed.

**Implemented** as [`scripts/check-bundles.mjs`](../../scripts/check-bundles.mjs), run via
`npm run check:bundles` and wired into `npm run zip` so the release path is gated. Two
checks:

- **Size budgets** — gzipped ceilings per entry, ratcheted down as reductions land. Current
  values live in the script's `BUDGETS` array; `--update` prints suggested values after a
  reduction.
- **Composition** — fails if `main-frontend.js` contains editor-only markers
  (`MosaicContentsReact`, `mosaic:addItem`) or more than two layout preset ids. Preset ids
  are read from the catalog itself so the check survives new presets.

It earned its keep immediately: on first run it failed on both checks against `main`, and it
caught two editor-only write paths in `widgets-layout.jsx` that bypass `layoutEditing.js`
and would otherwise have been missed.

**One caveat worth recording:** the `MosaicContentsReact` probe is coarse. It initially
fired on `widget-manager.jsx`'s legitimate global assignment as well as on genuine
editor-only code. That assignment is now gated, so the probe is clean — but if it starts
failing on infrastructure rather than editor code again, narrow the probe rather than
weakening the gate.

## 2. Bundle composition report

`rollup-plugin-visualizer` behind a `BUILD_ANALYZE=1` flag in
[`vite.config.js`](../../vite.config.js), so "what is in this bundle and why" is one command
away rather than a sourcemap-decoding exercise.

Worth noting the current sourcemap-based attribution has a known blind spot: inlined JSON
modules get attributed to a neighbouring source file, which is why the 47 KB of layout
presets appeared as an implausibly large `layoutEditing.js` rather than as itself. A proper
visualizer avoids that class of confusion.

## 3. Frontend field metrics

Playwright, on a page containing one `content-layout` widget with a realistic post set:

- **LCP** — should improve sharply once `RuntimeRenderingOptimisation.md` item 1 lands
  (currently the LCP element is an empty div awaiting a REST round-trip).
- **CLS** — should reach ~0. There is currently a *guaranteed* shift from the deliberate
  width jitter at
  [`GridLayout.jsx:112-118`](../../src/shared/components/GridLayout.jsx#L112-L118) firing
  ~50 ms after paint.
- **Request count and transfer size** for the widget's REST call — the direct check on
  `RuntimeRenderingOptimisation.md` item 2 (`_fields`).

Record a baseline before starting Tier 1 so the improvement is measured, not asserted.

## 4. Editor interaction latency

A focused Playwright script covering the two paths `ControlOptimisation.md` and
`GlobalStateOptimisation.md` target:

- Drag the focal-point control across the picker; count model writes and preview re-renders.
  Expected today: ~60/second. Expected after: 1 per drag.
- Type 20 characters into a text control; count `renderUI()` invocations. Expected today:
  20. Expected after: 0, since no typed key carries `selectors`.

Counting calls is more robust here than timing them, and it directly encodes the intended
behaviour change.

---

## Dropped from the previous version of this plan

- **"Expose a `/debug` endpoint that logs elapsed time for generating a grid, rendering a
  cell, or serialising settings."** This measures server-side work that is not where the
  cost is — PHP currently does almost nothing per render (it emits a hidden input and an
  empty div). It would also ship a debug endpoint in a plugin distributed on WordPress.org,
  which is a security and review-guideline liability for no diagnostic gain.

  If server timing becomes interesting after `PHPOptimization.md` items 1–2 move real work
  into PHP, use `SAVEQUERIES` and Query Monitor rather than a bespoke endpoint.

- **"Render a grid with 20+ cells and measure frame times."** Kept in spirit, narrowed in
  practice: 20+ cells is not a realistic configuration for these widgets (the preset catalog
  tops out at 4 items per layout). Items 3 and 4 above measure the paths users actually hit.
