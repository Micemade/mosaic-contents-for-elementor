# React Bundle Optimisation

**Tier 1 — highest value.**

**Status: items 1, 2 and 5 done (2026-08-17). Items 3, 4 and 6 open.**

## Measured baseline

All sizes here are KiB as reported by `npm run check:bundles`, so they can be compared
directly against the budgets in that script.

| Bundle | Raw before | Gzip before | Raw now | Gzip now |
| --- | ---: | ---: | ---: | ---: |
| `assets/js/main-frontend.js` | 229.0 | 62.6 | **175.5** | **53.5** |
| `assets/admin/js/main-editor.js` | 282.1 | 69.7 | 282.1 | 69.7 |

Frontend so far: **−53.5 KiB raw (−23%), −9.1 KiB gzip (−15%)**, from items 1 and 2. The
editor bundle is unchanged by design — it still needs the preset catalog and the mutation
code.

Attribution of the original `main-frontend.js` (via its sourcemap, plus direct verification
in the emitted file). **Roughly two-thirds of the frontend bundle was never executed on a
published page:**

| Module group | Raw | Frontend status |
| --- | ---: | --- |
| `assets/presets/layouts.json` (inlined) | ~47 KB | ~~29 of 30 presets unused~~ removed ✅ |
| `react-grid-layout` + `react-draggable` + `react-resizable` + `fast-equals` | ~64 KB | drag/resize disabled — item 3 |
| `react-sizeme` + `element-resize-detector` + `resize-observer-polyfill` | ~31 KB | replaceable with native API — item 4 |
| `dompurify` | ~23 KB | kept deliberately — see item 5 |
| widget + shared source | ~65 KB | editor-only mutation paths removed ✅ |

Remaining target: **~175 KiB → ~65 KiB raw, 53.5 KiB → ~25 KiB gzip**, from items 3 and 4.

---

## Build-config constraint (read first)

[`vite.config.js`](../../vite.config.js) sets `output.format: 'iife'`. Rollup rejects
code-splitting builds in IIFE format:

> Invalid value "iife" for option "output.format" — UMD and IIFE output formats are not
> supported for code-splitting builds.

**Therefore `React.lazy()` / dynamic `import()` cannot produce a separate chunk in this
project.** Vite will either fail the build or inline the import back into the single
chunk for zero gain. Every item below achieves its reduction at **build time** (dead-code
elimination, dependency removal) rather than at runtime.

Switching to ESM output to unlock splitting is not worth it here: it would require
`wp_enqueue_script_module` (WP 6.5+, but the plugin declares `Requires at least: 6.0`)
and the Elementor preview iframe complicates module loading. Revisit only if the frontend
bundle is still large after items 1–5.

---

## 1. Stop inlining the full layout catalog — DONE ✅

**Problem.** [`src/shared/utils/layoutUtils.js:7`](../../src/shared/utils/layoutUtils.js#L7)
statically imports all 30 presets from `assets/presets/layouts.json` (47 KB on disk).
Verified: all 30 ids and all 30 serialised layout payloads are present verbatim in the
shipped `main-frontend.js`. A rendered page uses exactly one.

**Fix (two halves).**

- *Server:* resolve the layout in PHP and inject it into the JSON already emitted by
  `get_widget_settings()` ([`includes/trait-widget-helpers.php:282`](../../includes/trait-widget-helpers.php#L282)).
  The inputs are already there — `mc4e_layout` and `mc4e_custom_layout` are real Elementor
  setting keys on both widgets. Add a `mc4e_resolved_layout` key holding only the selected
  layout, i.e. the PHP equivalent of `getComputedLayout()`.
- *Client:* on the frontend, read `mc4e_resolved_layout` and skip `getLayout()` entirely.

**Editor caveat.** The editor must keep the full catalog — `content_template()` is an
Underscore template that re-resolves the layout client-side on every preset change, so PHP
cannot do it there. Keep the static `layouts.json` import in the **editor** bundle only,
gated by item 2.

**Impact:** −47 KB raw frontend. **Risk:** low. Requires PHP and JS to agree on the shape
`{ desktop, tablet, mobile, zindex }`.

**As implemented:**
- `WidgetHelpers::resolve_layout()` + `get_layout_presets()` (statically cached) in
  [`trait-widget-helpers.php`](../../includes/trait-widget-helpers.php);
  `get_widget_settings()` now appends `mc4e_resolved_layout`.
- `resolveLayoutData(widgetData)` in
  [`layoutUtils.js`](../../src/shared/utils/layoutUtils.js) implements the three-step
  precedence (resolved → custom → preset, the last editor-only). Both widgets call it
  instead of `getLayout()`.
- Verified the PHP fallback matches `getLayout()` for `grid` (the shipped default),
  `default`, `layout-5`, `layout-10` and unknown ids — all resolve identically.
- Note the editor is unaffected because `content_template()` builds its JSON from
  `react-settings.json` definitions only, so `mc4e_resolved_layout` is absent there and the
  client-side path is taken. That falls out of the existing design rather than needing a
  branch.

## 2. Add a build-time editor flag and tree-shake editor-only code — DONE ✅

**Problem.** The frontend entry transitively reaches editor-only modules —
`layoutEditing.js` → `addItem.js` → `elementor-utils.js`. Confirmed: the
`MosaicContentsReact` global string (only meaningful inside the editor) survives into
`main-frontend.js`.

**Fix.** Add to `vite.config.js`:

```js
define: {
  __MC4E_EDITOR__: JSON.stringify(entry === 'main-editor'),
},
```

Then gate editor-only imports and call sites behind `if (__MC4E_EDITOR__)`. Rollup folds
the constant and drops the branch. This is the correct substitute for the previously
planned `React.lazy` splitting: same goal, achieved at build time, and compatible with
`iife`.

Apply to: `layoutEditing.js`, `addItem.js`, `visibleLayout.js` mutation paths,
`ZIndexControls`, `ItemControls`, `GridHelper`, and the `layouts.json` import from item 1.

**Impact:** removes the editor-only source tail. **Risk:** medium — needs care that no
frontend path calls a gated function. `TestingMonitoring.md` item 1 catches regressions.

**As implemented:** the single highest-leverage guard turned out to be

```js
const isEditMode = __MC4E_EDITOR__ && mode === 'edit';
```

in both widgets. Rollup propagates the folded constant through every existing
`isEditMode &&` guard, which drops `ItemControls`, `ZIndexControls` and `GridHelper` from
the frontend graph without touching a single render site. Worth knowing: Rollup *does*
propagate a `const` initialised to a folded `false` here, so this pattern works — it was
not obvious in advance and was confirmed by measurement (−14 KiB from that one line).

Explicit guards were still needed on the four layout-mutation handlers in each widget, plus
`updateWidgetItemsSetting` and `persistCustomLayout` in `widgets-layout.jsx`, which write to
the Elementor model directly rather than through `layoutEditing.js`.

The `window.MosaicContentsReact = widgetManager` assignment in
[`widget-manager.jsx`](../../src/core/widget-manager.jsx) is also gated now. The global is
an editor-side bridge across the preview iframe boundary; frontend mounting uses the
initializer's direct import and never reads it.

`visibleLayout.js` was left ungated on purpose: its `getVisibleLayout` export is on the
frontend render path (`content-layout.jsx` uses it to size the grid to the number of items
actually fetched), while its `mergeVisibleIntoFullLayout` export is reached only from
`layoutEditing.js`. The module stays; ordinary tree-shaking drops the mutation half.

## 3. Render the frontend grid without `react-grid-layout`

**Problem.** [`GridLayout.jsx:62-63`](../../src/shared/components/GridLayout.jsx#L62-L63)
sets `isDraggable`/`isResizable` to `false` outside the editor, and
[line 83](../../src/shared/components/GridLayout.jsx#L83) empties `resizeHandles`. The
entire drag/resize engine ships to perform static positioning.

**Fix.** Add a `StaticGridLayout` component consuming the same layout objects. The
positioning maths RGL performs is just:

```
left   = x * (colWidth + margin)
top    = y * (rowHeight + margin)
width  = w * colWidth  + (w - 1) * margin
height = h * rowHeight + (h - 1) * margin
```

with `colWidth = (containerWidth - margin * (cols - 1)) / cols`. Select the breakpoint
from the same `getElementorGridBreakpoints()` map. Switch on `__MC4E_EDITOR__` (item 2) so
RGL is referenced only from the editor entry.

**Impact:** −64 KB raw. **Risk:** medium — this is the item most likely to shift pixels.
Verify against the existing `allowOverlap` and `compactType` settings; note that vertical
compaction must be applied when producing `mc4e_resolved_layout` (item 1) rather than at
render time.

## 4. Replace `react-sizeme` with native `ResizeObserver`

**Problem.** `react-sizeme` pulls in `element-resize-detector` and
`resize-observer-polyfill` (~31 KB combined). `ResizeObserver` has had universal browser
support since 2020, comfortably inside any browser matrix a WP 6.0+ plugin targets.

**Fix.** A ~15-line `useContainerWidth(ref)` hook replaces the `withSize()` HOC at
[`GridLayout.jsx:277`](../../src/shared/components/GridLayout.jsx#L277). Needed in both
entries, so this is not gated by `__MC4E_EDITOR__`.

**Impact:** −31 KB raw both bundles. **Risk:** low.

## 5. DOMPurify — DECIDED: keep ✅

**Decision (2026-08-17): keep, documented.** The ~23 KB stays.

Rationale, now recorded at the call site in
[`content-layout.jsx`](../../src/widgets/content-layout/content-layout.jsx): WordPress
escapes `title.rendered` and `excerpt.rendered`, but both pass through filters
(`the_title`, `the_excerpt`, `get_the_excerpt`) that any theme or plugin on the site can
hook, so what wp/v2 returns is not guaranteed to be what core produced. The values land in
`dangerouslySetInnerHTML`, which makes this the last line of defence rather than a
redundant one.

Consequence for the other numbers in this file: the frontend target is **~25 KB gzip**, not
the ~22 KB quoted before this decision.

## 6. Remove unused dependencies

`@wordpress/components`, `react-select`, `@wordpress/api-fetch`, and
`@lemoncode/react-image-focal-point` appear only in code comments — no source file imports
them. No bundle impact (they are already tree-shaken out), but removing them cuts install
time and supply-chain surface.

Note `@wordpress/api-fetch` is also listed in `rollupOptions.external`; that entry becomes
dead too.

---

## Dropped from the previous version of this plan

- **`React.lazy` code splitting** — impossible under `format: 'iife'` (see constraint
  above). The example also used `/* webpackChunkName */`, a webpack magic comment; this
  project is Vite/Rollup.
- **`ssr.noExternal`** — irrelevant to a non-SSR library build.
- **"Avoid `export default` to aid tree-shaking"** — Rollup tree-shakes default exports
  identically to named ones. Verified in practice here: `@wordpress/element` is imported at
  [`FeaturedImage.jsx:5`](../../src/shared/components/FeaturedImage.jsx#L5), yet
  `createInterpolateElement` and `renderToString` are absent from the output.
- **`@babel/preset-env` with `useBuiltIns: "usage"`** — there is no `preset-env` in this
  build. `@vitejs/plugin-react` runs Babel only for JSX/refresh, and Vite's default
  `build.target: 'modules'` emits no polyfills. Confirmed: zero polyfill code in the
  output. This optimised something already at 0 bytes.
