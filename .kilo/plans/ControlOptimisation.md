# Control Optimisation

**Tier 3 — editor responsiveness.** Custom controls run only in the Elementor panel.

---

## 1. Commit the focal point on release, not on every mouse move

**Problem.** [`focal-point-control.jsx:76-95`](../../src/controls/focal-point-control.jsx#L76-L95)
calls `this.setValue({ x, y })` inside `onFocalPointChange`, which
[`FocalPointControlView.jsx:213`](../../src/controls/FocalPointControlView.jsx#L213) invokes
on **every** `mousemove` while dragging.

`setValue` writes to the Elementor model, which fires the settings `change` handler at
[`editor-hooks.js:632`](../../src/core/editor-hooks.js#L632), which does a full
`updateInstance()` re-render of the widget inside the preview iframe *and* a
`view.renderUI()` CSS regeneration. At ~60 mousemove events per second of drag, that is
~60 full preview re-renders per second.

**Note on the previous diagnosis.** This was previously recorded as "updates the image
preview on every mouse move", with a 50 ms throttle as the fix. That misplaces the cost:
the picker's own preview is cheap local `useState`
([`FocalPointControlView.jsx:23-24`](../../src/controls/FocalPointControlView.jsx#L23-L24))
and should stay at full framerate — throttling it would make the control feel worse. And a
50 ms throttle on `setValue` still triggers ~20 full preview re-renders per second, which
does not solve the problem either.

**Fix.** Split the two concerns, which is how Elementor's own slider controls behave:

- **During drag:** update local React state only. The picker stays smooth, no model write.
- **On `mouseup`:** call `setValue` once with the final rounded coordinates.
- Optionally, if live preview feedback while dragging is wanted, write the value to a CSS
  custom property on the preview node directly during drag and let the single `setValue` on
  release make it authoritative. Do not route intermediate frames through the model.

Also fold the hidden-input and value-display writes (currently three jQuery lookups per
mousemove) into the same release-time commit; the visible `X:`/`Y:` readout can be driven
from React state instead.

**Impact:** turns an O(frames) model-write path into O(1) per drag. Compounds with
`GlobalStateOptimisation.md` item 1 — that item makes each individual write cheaper, this
one removes almost all of the writes. **Risk:** low. Verify undo/redo still records a
single history entry per drag (it should improve — currently a drag likely floods the
history stack).

---

## Dropped from the previous version of this plan

- **"Lazy-load the control views via dynamic imports in `src/core/elementor-utils.js`"** —
  wrong on three counts:
  1. Controls are not registered there.
     [`elementor-utils.js`](../../src/core/elementor-utils.js) holds breakpoint maths and
     panel helpers only; registration is PHP, at
     [`mosaic-contents-for-elementor.php:159-173`](../../mosaic-contents-for-elementor.php#L159-L173).
  2. Each control already ships as its own separate Vite entry, enqueued independently by
     its own `enqueue()` method (e.g.
     [`controls/focal-point.php:79`](../../controls/focal-point.php#L79)). They are already
     as split as the build format allows.
  3. There is nothing worth splitting: `focal-point-control.js` is 5.4 KB and
     `saved-setups-control.js` is 7.7 KB. Combined they are under 2% of what
     `main-editor.js` costs.

  Dynamic `import()` would also fail outright under `format: 'iife'` — see the build
  constraint section in `ReactBundleOptimisation.md`.
