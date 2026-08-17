# Runtime Rendering Optimisation

**Tier 2 — frontend runtime. Do after `ReactBundleOptimisation.md` items 1–4.**

The frontend's problem is not render throughput, it is the *shape of the critical path*.
A published page currently does:

```
empty <div>  →  load React + 64 KB gz bundle  →  REST round-trip  →  measure container
             →  paint  →  50 ms later, forced reflow  →  repaint
```

Every step after the first is deferrable, removable, or both.

---

## 1. Server-render the first page of items

**Problem.** [`trait-widget-helpers.php:387-399`](../../includes/trait-widget-helpers.php#L387-L399)
emits only a hidden settings input and an empty `<div>`. All content arrives via a
client-side `fetch` after mount ([`content-layout.jsx:130`](../../src/widgets/content-layout/content-layout.jsx#L130)).
Result: guaranteed empty LCP element and a REST round-trip on the critical path of every
page using the widget.

**Fix.** PHP already runs in a query context and already serialises settings. Run the
equivalent `WP_Query` server-side and inline the first page of items into the same JSON
payload (alongside `mc4e_resolved_layout` from `ReactBundleOptimisation.md` item 1). React
then hydrates from inline data and only fetches on pagination or in the editor.

Keep the existing client fetch as the path for page 2+ and for the editor preview, where
settings change live.

**Impact:** removes one full round-trip from first paint; makes LCP measurable rather than
network-dependent. **Risk:** medium — the PHP query must match the REST query's semantics
(`orderby`, `order`, taxonomy term filtering, `sticky`). Mismatches show up as content
shifting between server and client render.

## 2. Add `_fields` to the REST query

**Problem.** [`content-layout.jsx:125-129`](../../src/widgets/content-layout/content-layout.jsx#L125-L129)
requests `_embed=wp:featuredmedia,wp:term,author` with no field filter. Every response
therefore carries full `content.rendered` for every post plus complete attachment objects
— and [line 141](../../src/widgets/content-layout/content-layout.jsx#L141) discards nearly
all of it.

**Fix.** Add `_fields` limited to what `fetchPosts` actually maps: `id`, `title`, `excerpt`,
`link`, `date`, `modified`, plus `_embedded` / `_links`.

**Impact:** typically 70–90% response-size reduction on content-heavy sites. Still worth
doing after item 1, since it also covers pagination and the editor. **Risk:** low — but
`_fields` interacts with `_embed`, so verify `_embedded` still populates.

## 3. Remove the double-reflow on mount

**Problem.** [`GridLayout.jsx:112-118`](../../src/shared/components/GridLayout.jsx#L112-L118)
deliberately jitters the measured width (`prev - 1`, then `null` after 50 ms) to force a
re-measure, and [line 258](../../src/shared/components/GridLayout.jsx#L258) sets
`measureBeforeMount={true}`. Together these guarantee a layout shift ~50 ms after first
paint on every page load.

**Fix.** The static frontend renderer (`ReactBundleOptimisation.md` item 3) makes both
obsolete: with the layout resolved server-side and positions computed from container width,
there is nothing to re-measure. Delete the jitter hack and `measureBeforeMount` from the
frontend path. If the editor still needs the hack, gate it behind `__MC4E_EDITOR__` with a
comment recording *why*.

**Impact:** eliminates a guaranteed CLS contribution. **Risk:** low once item 3 of the
bundle plan lands; do not attempt independently.

## 4. Stabilise settings object identity

**Problem.** `getSettingsFromModel()` builds a fresh object on every change, and
`WidgetManager`'s `setSettings` spreads it into new state
([`widget-manager.jsx:104-112`](../../src/core/widget-manager.jsx#L104-L112)). Every child
therefore receives new prop identity on every keystroke, which defeats the memoisation
already present — `content-layout.jsx` and `widgets-layout.jsx` between them use
`memo`/`useMemo`/`useCallback` in 47 places.

**Fix.** Shallow-compare merged settings in `setSettings` and bail out (`return
prevSettings`) when nothing changed. Where a nested object is rebuilt identically each
time (responsive maps, `zindex`), reuse the previous reference.

**Impact:** makes existing memoisation actually engage. Editor-side win primarily; see
`GlobalStateOptimisation.md` item 1 for the other half of this path. **Risk:** low.

---

## Dropped from the previous version of this plan

- **"Wrap each cell in `React.memo` with a stable key"** — already done. The memoisation
  exists; it is defeated upstream by prop identity (item 4). Adding more `memo()` at the
  leaves would change nothing.
- **"Virtualise grids of 50+ cells with `react-window` / `react-virtualized`"** — neither
  library is installed, and the premise does not hold. These are hand-placed mosaic
  layouts: the preset catalog tops out at 4 items per layout, and real usage is 3–14. A
  virtualiser would add bundle weight and absolute-positioning complexity to solve a case
  that does not occur. Revisit only if a real user reports a large-grid slowdown.
- **"Debounce Backbone settings change"** — correct target, wrong mechanism and wrong file.
  Moved to `GlobalStateOptimisation.md` item 1, where the `renderUI()` half of the cost is
  addressed too.
