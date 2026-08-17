# Global State Optimisation

**Tier 3 — editor responsiveness.** Nothing here affects published pages.

The editor's cost centre is a single path: any Elementor model change triggers a full React
re-render of the widget in the preview iframe **plus** a CSS regeneration pass. Both halves
need addressing; fixing one alone leaves most of the latency in place.

---

## 1. Coalesce the settings-change handler and gate `renderUI()`

**Problem.** [`editor-hooks.js:632-642`](../../src/core/editor-hooks.js#L632-L642) fires on
every `change` of the settings model and unconditionally does two expensive things:

```js
widgetManager.updateInstance(widgetType, widgetId, getSettingsFromModel());
view.renderUI();   // regenerates all selector-based CSS
```

Every keystroke in a text control, and every frame of a slider or focal-point drag
(`ControlOptimisation.md` item 1), pays for both.

**Fix — two independent changes.**

- **Coalesce on `requestAnimationFrame`**, not a fixed `_.debounce`. A debounce long enough
  to help (~150 ms) makes typing feel laggy; rAF collapses a burst to one update per frame
  while staying visually immediate. Cancel any pending frame on re-entry.
- **Skip `renderUI()` when no changed key carries `selectors`.** This logic already exists
  — [`editor-hooks.js:600-604`](../../src/core/editor-hooks.js#L600-L604) computes
  `relevantKeys` and calls `renderUI()` only when non-empty — but it lives on a *different*
  path and was never applied to the main `change` handler. Reuse it. Backbone gives you the
  changed keys via `settingsModel.changedAttributes()`.

**Impact:** the highest-value editor fix available. Both halves are needed; `renderUI()` is
typically the more expensive of the two. **Risk:** medium — under-firing `renderUI()` means
style changes silently stop appearing. Validate against a control of each type (colour,
border, spacing, typography) before considering it done.

**Related:** `RuntimeRenderingOptimisation.md` item 4 removes the *third* cost on this path
(prop-identity churn defeating memoisation). Land all three together.

## 2. Audit listener teardown (verification task, not a rewrite)

**Status.** Partly handled already. `elementor.channels.editor` listeners are keyed and
removed via `CHANNEL_EVENT_HANDLERS` before re-registration
([`editor-hooks.js:282-285`](../../src/core/editor-hooks.js#L282-L285)).

**What is not verified.** The per-model Backbone listeners registered directly on
`model.get('settings')` — `change`, `change:mc4e_post_type`, `change:mc4e_taxonomy`,
`change:${stylePresetKey}`, `change:${layoutKey}` (roughly
[`editor-hooks.js:632-730`](../../src/core/editor-hooks.js#L632-L730)) — have no visible
`off()`. Separately, `widgetManager.models` and `widgetManager.modelGetters`
([`widget-manager.jsx:18-22`](../../src/core/widget-manager.jsx#L18-L22)) are keyed by
`widgetType_widgetId` and never deleted, so they retain model references for widgets the
user has deleted.

**Fix.** Confirm whether Elementor's own model teardown already releases these (it may, via
`stopListening` on the model). If it does, add a comment saying so and close this item. If
it does not, hook widget removal and `off()` the listeners plus `delete` the two
`widgetManager` map entries.

**Impact:** memory only; matters in long editing sessions with repeated add/delete cycles.
Measure with a heap snapshot before and after 50 add/delete cycles rather than assuming.
**Risk:** low.

---

## Dropped from the previous version of this plan

- **"Batch DOM updates with `documentFragment` instead of per-cell DOM manipulation"** —
  there is no per-cell DOM manipulation. Rendering is React throughout; the only
  `appendChild` calls in `src/` are a `<style>` injection at
  [`elementor-utils.js:257`](../../src/core/elementor-utils.js#L257) and one canonical-node
  move in `widgets-layout.jsx`. React already batches its own updates.
- **`addEventListener('commit')`** — no such event exists in Elementor or in this codebase.
  The real batching opportunity is item 1 above.
