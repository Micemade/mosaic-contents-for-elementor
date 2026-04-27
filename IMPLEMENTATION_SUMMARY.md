# Implementation Summary

## ✅ Completed

All three widgets are fully implemented and the architecture is production-ready.

## 📁 Source File Structure

```
src/
├── main-frontend.jsx            # Lightweight frontend entry point
├── main-editor.jsx              # Full-featured editor entry point
├── globalStyles.scss            # Global styles for all widgets
├── core/
│   ├── widget-registry.js       # Central registry (all widget types + settings mappers)
│   ├── widget-manager.jsx       # Singleton — mounts/updates/unmounts React instances
│   ├── widget-initializer.js    # Factory — creates per-widget init functions
│   ├── frontend-hooks.js        # Frontend-only hooks (display mode)
│   ├── editor-hooks.js          # Editor hooks (live sync, channel events, MutationObserver)
│   └── elementor-utils.js       # Shared utilities: breakpoints, CSS injection, panel helpers
├── widgets/
│   ├── settings-mappers.js      # createSettingsMapper() factory — drives all widgets
│   ├── content-layout/
│   │   ├── content-layout.jsx
│   │   ├── content-layout.scss
│   │   └── react-settings.json  # ← settings source of truth
│   ├── categories-layout/
│   │   ├── categories-layout.jsx
│   │   ├── categories-layout.scss
│   │   └── react-settings.json
│   └── single-product-layout/
│       ├── single-product-layout.jsx
│       ├── single-product-layout.scss
│       ├── react-settings.json
│       └── utils/
│           └── single-product-layouts.json  # Predefined SP layouts
├── shared/
│   ├── layouts.json             # Predefined grid layouts (products/categories)
│   ├── components/
│   │   ├── GridLayout.jsx       # react-grid-layout wrapper
│   │   ├── ProductImage.jsx     # Image with focal-point support
│   │   ├── RatingStars.jsx      # WooCommerce star ratings
│   │   ├── AddToCartButton.jsx  # Store API cart integration
│   │   ├── ZIndexControls.jsx   # Per-item z-index editor controls
│   │   ├── GridHelper.jsx       # Shared grid sizing helpers
│   │   ├── ItemControls.jsx     # Shared in-canvas item controls
│   │   ├── Pagination.jsx       # Shared pagination component
│   │   └── utils/events.js      # Custom DOM event helpers
│   ├── utils/
│   │   ├── hooks.js             # useCssVariables(), useGridSettings()
│   │   ├── addItem.js           # Grid item add/remove logic
│   │   ├── alignmentUtils.js    # Shared alignment variable helpers
│   │   ├── dataLoading.js       # Shared cached loading helper
│   │   ├── layoutUtils.js       # Layout computation helpers
│   │   ├── layoutEditing.js     # Shared layout edit helpers
│   │   ├── elementOrdering.js   # Element order/visibility parser
│   │   ├── LRUCache.js          # LRU cache (editor) / plain object (frontend)
│   │   ├── fetchHelpers.js      # Shared REST helper functions
│   │   ├── productUtils.js      # WooCommerce data helpers
│   │   ├── transformationUtils.js # Shared snake_case -> camelCase mapper
│   │   ├── visibleLayout.js     # Visibility-aware layout resolver
│   │   └── generalUtils.js      # General helpers (decode, etc.)
│   └── assets/
│       ├── _gridLayout.scss
│       ├── _itemControls.scss
│       ├── _productElements.scss
│       └── (shared partials imported by widget styles)
└── controls/
    ├── focal-point-control.jsx      # Image focal-point picker React component
    ├── FocalPointControlView.jsx    # Elementor BaseData view extension
    ├── focal-point-control.scss
    ├── product-select-control.jsx   # Product selector React component
    ├── ProductSelectView.jsx        # Elementor BaseData view extension
    ├── product-select-control.scss
    ├── saved-setups-control.jsx     # Save/load/delete presets React component
    └── saved-setups-control.scss

widgets/                         # PHP widget classes (all use WidgetHelpers trait)
├── content-layout.php
├── categories-layout.php
└── single-product-layout.php

controls/                        # PHP custom control classes
├── focal-point.php
├── product-select.php
├── element-sorting.php
└── saved-setups.php

includes/
├── trait-widget-helpers.php     # Shared render(), content_template(), get_widget_settings()
└── class-rest-api.php           # REST API handler
```

## 🔄 Settings Architecture (Centralized)

Each widget has a `react-settings.json` that is the single source of truth for:
- PHP `render()` — serializes settings into a hidden input for React hydration
- PHP `content_template()` — generates the JS object in the Backbone/Underscore template
- JS `createSettingsMapper()` factory — extracts and type-converts values from Elementor models

**Path:** `src/widgets/{widget-name}/react-settings.json`  
**PHP loads via:** `includes/trait-widget-helpers.php → get_settings_definitions($widget_name)`  
**JS loads via:** direct ESM import in `widget-registry.js`

> **Critical:** Both PHP and JS must resolve to the same `react-settings.json` path. A mismatch results in empty settings on all renders (widgets appear with defaults only, and editor settings don't apply until the widget is selected).

## ✅ Functionality

### Custom Layout Saving ✓
Drag/resize → `onLayoutChange` → `updateElementorSetting()` → `widgetManager.updateModelSetting()` → preferred `$e.run('document/elements/settings', ...)` (fallback `model.setSetting()`) → auto-save/history entry

### Layout Reset ✓
Reset button → `mosaic:resetLayout` channel event → `editor-hooks.js` clears `custom_layout` → React re-renders with predefined layout

### Live Settings Sync ✓
Panel change → `model.on('change')` → `settingsMapper(model)` → `updateInstance()` → React `setState` (no DOM remount) + `view.renderUI()` for CSS selectors

### Responsive CSS Variables ✓
`useCssVariables(widgetData)` in `src/shared/utils/hooks.js` converts responsive settings into scoped CSS custom properties: `--ml4e-title-size-desktop`, `--ml4e-title-size-tablet`, etc.

`injectBreakpointStylesheet()` in `elementor-utils.js` injects media queries using those variables, including `.product-elements { text-align: var(--ml4e-product-align-text-{bp}) }` derived from the `ml4e_product_align` flex-to-text-align mapping.

### Saved Setups ✓
Custom panel control saves/loads/deletes full layout+style presets via `wp.apiFetch → /wp/v2/settings`. Batch apply uses `mosaic:applySetup` channel event with atomic `settingsModel.set()`.

### Multiple Widget Instances ✓
Compound instance keys `${widgetType}_${widgetId}` prevent collisions throughout the widget manager.

### MutationObserver (Editor) ✓
Detects widgets added by drag & drop into the editor canvas and auto-initializes React.

## 🎯 Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Two separate bundles | Frontend skips drag/resize libs (~50% smaller) |
| Trait for PHP widget helpers | `render()` and `content_template()` identical across widgets |
| `createSettingsMapper` factory | Zero boilerplate when adding new widgets |
| `react-settings.json` per widget | Keeps schema co-located with the component |
| Conditional `renderOnChange` override | CSS regenerates without DOM destruction on widget-owned changes |
| `injectBreakpointStylesheet` | Runtime CSS that matches Elementor's actual breakpoint px values |

## 📊 Build Output

```
assets/js/main-frontend.js          # ~172 KB  (frontend display only)
assets/admin/js/main-editor.js      # ~175 KB  (full editor)
assets/admin/js/focal-point-control.js
assets/admin/js/product-select-control.js
assets/admin/js/saved-setups-control.js
```

## 🚀 Adding a New Widget (Checklist)

1. Create `src/widgets/{name}/react-settings.json` with all settings definitions
2. Create `src/widgets/{name}/{name}.jsx` using `widgetData`, `widgetId`, `mode` props
3. Import schema into `src/core/widget-registry.js` and add registry entry
4. Create `widgets/{name}.php` using the `WidgetHelpers` trait; `get_name()` must match the registry key
5. Register in `mosaic-layouts-for-elementor.php → init_widgets()`
6. Run `npm run build`

