# Mosaic Contents for Elementor — Agent and Development Guide

Development guide for the Mosaic Contents for Elementor plugin: two React-powered Elementor widgets built on a
free-form grid layout engine.

## Quick Start

```bash
npm run build          # Build all bundles + controls
npm run watch          # Watch the frontend bundle
npm run watch:editor   # Watch the editor bundle
npm run watch:all      # Watch all bundles + controls
npm run lint
```

There is **no HMR** inside the Elementor editor iframe — refresh the editor after a rebuild.

## Project Structure

```
mosaic-contents-for-elementor/
├── mosaic-contents-for-elementor.php   # Main plugin: registers widgets, controls, category, assets
├── widgets/                            # PHP widget classes + their settings JSON
│   ├── content-layout/
│   │   ├── content-layout.php          # ContentLayout widget (controls, content_template)
│   │   └── react-settings.json         # Setting definitions consumed by the React mapper
│   └── widgets-layout/
│       ├── widgets-layout.php          # WidgetsLayout widget
│       └── react-settings.json
├── controls/                           # Custom Elementor control PHP classes
│   ├── focal-point.php                 # Focal_Point
│   ├── saved-setups.php                # Saved_Setups
│   ├── posttype-select.php             # Posttype_Select
│   └── element-sorting.php             # Element_Sorting
├── includes/                           # PHP helpers (WidgetHelpers trait, REST endpoints, etc.)
├── src/                                # React / JS source (built by Vite)
│   ├── main-frontend.jsx               # Frontend entry
│   ├── main-editor.jsx                 # Editor entry
│   ├── core/                           # Registry, manager, initializer, hooks, elementor utils
│   ├── widgets/                        # React components + settings mapper
│   ├── controls/                       # React views for the custom controls
│   └── shared/                         # Shared components, utils, SCSS
├── assets/                             # Built output (js/css) — do not edit by hand
└── docs/                               # Standalone HTML help doc
```

Reference docs live in the plugin **root**: `ARCHITECTURE.md`, `VISUAL_ARCHITECTURE.md`, `QUICK_REFERENCE.md`,
`CENTRALIZED_SETTINGS.md`, `IMPLEMENTATION_SUMMARY.md`.

## The Two Widgets

| Widget | Slug (`get_name`) | React component | Purpose |
|--------|-------------------|-----------------|---------|
| Content Layout | `content-layout` | `src/widgets/content-layout/content-layout.jsx` | Query posts/CPTs and render cards in a free-form grid |
| Widgets Layout | `widgets-layout` | `src/widgets/widgets-layout/widgets-layout.jsx` | Host any Elementor widget inside each grid cell |

Both register under the **`mosaic-contents`** category (title "Mosaic Contents").

## Build Entries (Vite)

`npm run build` runs one Vite build per `BUILD_ENTRY`:
`main-frontend`, `main-editor`, `focal-point-control`, `saved-setups-control`, `PostTypeSelectControl`.
Outputs land in `assets/js` (frontend), `assets/admin/js` (editor), and per-control files.

## Adding a New Widget

1. **PHP widget** (`widgets/new-widget/new-widget.php`): extend `Widget_Base`, use the `WidgetHelpers` trait,
   `get_categories()` → `['mosaic-contents']`, and a `content_template()` that outputs the React mount wrapper
   + a hidden `.elementor-settings-data` input.
2. **Settings JSON** (`widgets/new-widget/react-settings.json`): the keys the React mapper reads (with `type`
   hints: `string` / `number` / `boolean` / `responsive` / `array`).
3. **React component** (`src/widgets/new-widget/new-widget.jsx`): accepts `{ widgetData, widgetId, mode }`.
4. **Register in the widget registry** (`src/core/widget-registry.js`):
   ```javascript
   import NewWidget from '../widgets/new-widget/new-widget';
   import newWidgetSettings from '../../widgets/new-widget/react-settings.json';
   import { createSettingsMapper } from '../widgets/settings-mappers';

   export const WIDGET_REGISTRY = {
     'new-widget': { component: NewWidget, settingsMapper: createSettingsMapper(newWidgetSettings) },
   };
   ```
   The registry drives the editor/frontend `frontend/element_ready/{slug}.default` hooks automatically
   (see `getRegisteredWidgets()`), so no per-widget hook wiring is needed.
5. **Register in PHP** (`mosaic-contents-for-elementor.php` → `init_widgets()`):
   ```php
   require_once __DIR__ . '/widgets/new-widget/new-widget.php';
   $widgets_manager->register( new NewWidget() );
   ```

## Architecture Overview

### Dual-bundle strategy

- **Frontend bundle** (`assets/js/main-frontend.js`): display-only, loaded on published pages.
- **Editor bundle** (`assets/admin/js/main-editor.js`): adds drag/resize, add/remove, live settings sync, and
  the Widgets Layout live-element machinery. Loaded only in the Elementor editor preview.

### Settings bridge (Elementor → React)

`content_template()` serializes mapped settings into a hidden `.elementor-settings-data` input; the widget
initializer reads it (or, in the editor, a live model getter). `createSettingsMapper(react-settings.json)`
turns the Elementor model into the plain `widgetData` object the React component consumes.

### Data flow

1. **Initial load**: `frontend/element_ready/{slug}.default` → widget initializer → `widgetManager.init` creates a React root.
2. **Settings change (editor)**: Backbone `settings` `change` → `widgetManager.updateInstance` → React re-render (no remount). `editor/widget/renderOnChange` is filtered to `false` for these widgets, so `view.renderUI()` is called explicitly to regenerate selector-based CSS without DOM destruction.
3. **Layout save**: React → `$e.run('document/elements/settings', …)` (history-aware) → Elementor model → saved on Update/Publish.
4. **Widget addition**: a MutationObserver in the editor preview auto-initializes newly added widget wrappers.

### Widgets Layout specifics

- Dropped widgets are **real Elementor elements** kept in a **per-cell hidden container** (a sibling of the
  widget, `_element_id="mc4e-wlc-{widgetId}-{cellId}"`). React re-parents each element's DOM into its cell slot,
  so widgets stay natively editable and save through Elementor.
- Cell assignment/order lives in the `mc4e_widget_items` setting; the widget's model location is kept in sync
  with it. Per-cell styles use the `mc4e_cell_styles` repeater (auto-synced 1:1 with cells).

### Key globals

```javascript
window.MosaicContentsReact   // the WidgetManager singleton (instances, models, modelGetters, updateModelSetting …)
window.MC4E                  // PHP-localized data (REST root/nonce, placeholder image, etc.)
```

### Channel events (editor ↔ preview)

```javascript
elementor.channels.editor.trigger('mosaic:resetLayout'); // clear custom layout → predefined
elementor.channels.editor.trigger('mosaic:addItem');     // add a grid cell
// 'mosaic:applySetup' — batch-apply a Saved Setup's settings (Content Layout)
```

## Custom Controls

| PHP (`controls/`) | React view (`src/controls/`) | Use |
|-------------------|------------------------------|-----|
| `focal-point.php` | `focal-point-control.jsx` / `FocalPointControlView.jsx` | Image focal-point picker |
| `saved-setups.php` | `saved-setups-control.jsx` | Save/load/delete layout+style setups |
| `posttype-select.php` | `PostTypeSelectControl.jsx` / `PostTypeSelectView.jsx` | Searchable post-type/query select |
| `element-sorting.php` | (rendered by the widget) | Element order & visibility repeater |

## Code Standards

- **PHP**: WordPress coding standards; widgets extend `Elementor\Widget_Base`.
- **JS/React**: functional components + hooks; Prettier/ESLint.
- Never edit `assets/` by hand — it is built output.

## Debugging

```javascript
window.MosaicContentsReact                 // manager
window.MosaicContentsReact.instances       // mounted React roots
window.MosaicContentsReact.models          // Elementor models (editor)
elementor.channels.editor.trigger('mosaic:resetLayout'); // test event (in preview iframe)
```

## Reference Documents

- `ARCHITECTURE.md` — full technical architecture
- `VISUAL_ARCHITECTURE.md` — diagrams
- `QUICK_REFERENCE.md` — command/API reference
- `CENTRALIZED_SETTINGS.md` — the `react-settings.json` settings pipeline
- `IMPLEMENTATION_SUMMARY.md` — what was built and why
