# PHP Optimisation

The PHP layer is small (~3,100 lines) and is not itself a bottleneck. Its leverage is
almost entirely in **what it hands to the client**: PHP already runs in a query context and
already serialises settings, so moving work across that boundary removes the two most
expensive things the frontend does.

---

## 1. Resolve the layout server-side — DONE ✅

**Owner:** `ReactBundleOptimisation.md` item 1 — recorded here because the work is
predominantly PHP.

`get_widget_settings()` ([`trait-widget-helpers.php`](../../includes/trait-widget-helpers.php))
now emits a `mc4e_resolved_layout` key containing only the layout actually in use, resolved
from the existing `mc4e_custom_layout` and `mc4e_layout` settings by
`WidgetHelpers::resolve_layout()`. The catalog is decoded once per request and held in
`self::$layout_presets_cache`. This let the frontend bundle drop its 47 KB inline copy.

**Still open:** vertical compaction must be applied here, at resolve time, once the static
frontend renderer (`ReactBundleOptimisation.md` item 3) lands — that renderer will not
compute it. Not needed yet, because `react-grid-layout` still does the compaction on the
frontend today.

## 2. Server-render the first page of items

**Owner:** `RuntimeRenderingOptimisation.md` item 1 — again mostly PHP work.

Run the `WP_Query` equivalent of `fetchPosts()` and inline the results into the same JSON
payload. The PHP query must match the REST query's semantics for `orderby`, `order`,
taxonomy term filtering and `sticky`, or content will visibly shift when the client takes
over.

## 3. Replace the hidden input with a JSON script tag

**Problem.** [`trait-widget-helpers.php:395`](../../includes/trait-widget-helpers.php#L395)
emits settings as `esc_attr( $json_data )` inside an `<input type="hidden">`. `esc_attr`
expands every `"` to `&quot;`, so the attribute is substantially larger than the JSON it
carries, and the browser pays HTML-entity decoding before `JSON.parse`.

**Fix.** Emit `<script type="application/json" class="mc4e-settings-data">` and read it via
`JSON.parse(el.textContent)` in
[`widget-initializer.js:46-51`](../../src/core/widget-initializer.js#L46-L51).

**Sequencing note.** This becomes materially more valuable *after* items 1 and 2, since
those grow the payload considerably. Do it as part of item 2 rather than on its own.

**Risk:** low, but touches both `render()` and `content_template()` — the Underscore
template variant needs the same treatment, and the initializer's `.elementor-settings-data`
lookup must handle both shapes during transition.

## 4. Asset loading — verify, don't change

**Status:** already in reasonable shape. Frontend assets are gated on Elementor being
active, not being in preview mode, and the document actually being built with Elementor
([`mosaic-contents-for-elementor.php:290-306`](../../mosaic-contents-for-elementor.php#L290-L306)).
Editor and frontend bundles are separate entries.

**Open item.** The `defer`/`async` suggestion from the previous plan is a non-issue: all
`wp_enqueue_script` calls already pass `true` for `$in_footer`, and the bundles depend on
`elementor-frontend`, so `async` would be actively wrong (it would break load ordering).
Leave as is.

**Worth checking instead:** the gate loads the bundle on any Elementor-built page, whether
or not it contains a Mosaic widget. If that is common on target sites, `get_script_depends()`
([`content-layout.php:27`](../../widgets/content-layout/content-layout.php#L27)) is the
mechanism to make loading per-widget rather than per-page. Measure first — on a site where
every page uses the widget this change buys nothing.

---

## Dropped from the previous version of this plan

- **"The `content-layout` widget queries the REST API each time the widget is rendered —
  add transients keyed on query parameters."** PHP never calls REST. `render()`
  ([`trait-widget-helpers.php:387-399`](../../includes/trait-widget-helpers.php#L387-L399))
  emits a hidden input and an empty div; the *browser* fetches `wp/v2/posts` after mount
  ([`content-layout.jsx:130`](../../src/widgets/content-layout/content-layout.jsx#L130)),
  and there is already a client-side LRU cache in front of that call
  ([`dataLoading.js`](../../src/shared/utils/dataLoading.js)). A transient on a server-side
  call that does not happen is a no-op.

  The underlying instinct — that a round-trip per render is wasteful — was right, and is
  addressed properly by item 2 above: remove the round-trip rather than cache it.

- **`defer` / `async` on enqueued scripts** — see item 4.
