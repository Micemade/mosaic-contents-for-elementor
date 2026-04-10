# Multi-Widget Architecture

## Overview

The codebase has been refactored to support multiple widget types using a shared generic architecture. This allows easy addition of new widgets (categories-layout, single-product-layout, etc.) without code duplication.

The architecture uses **two separate build outputs** plus **three custom control bundles**:
- **Frontend Bundle** (`main-frontend.jsx`) - Lightweight, display-only for published pages
- **Editor Bundle** (`main-editor.jsx`) - Full-featured with drag/resize, add/remove items, and live settings sync for Elementor editor
- **Focal Point Control** (`focal-point-control.jsx`) - Custom image focal-point picker for the editor panel
- **Saved Setups Control** (`saved-setups-control.jsx`) - Save/load/delete layout+style presets via the editor panel
- **Product Select Control** (`product-select-control.jsx`) - Searchable single-product picker for the editor panel

## Dual-Bundle Strategy

### Why Two Bundles?

The plugin uses separate entry points and build outputs to optimize performance:

| Aspect | Frontend Bundle | Editor Bundle |
|--------|----------------|---------------|
| **Entry Point** | `src/main-frontend.jsx` | `src/main-editor.jsx` |
| **Output** | `assets/js/main-frontend.js` | `assets/admin/js/main-editor.js` |
| **Loaded On** | Published pages (not editor) | Elementor editor preview only |
| **File Size** | ~50% smaller | Full featured |
| **Includes** | Display components only | Drag/resize, add/remove, sync |
| **Hooks** | `frontend-hooks.js` (minimal) | `editor-hooks.js` (full) |
| **Dependencies** | React, ReactDOM | React, ReactDOM, react-grid-layout |

### Loading Logic

**Frontend:**
```php
// wp_enqueue_scripts hook
if ( ! is_preview() && is_built_with_elementor() ) {
    wp_enqueue_script('mpl4e-frontend-js', ...);
}
```

**Editor:**
```php
// elementor/preview/enqueue_scripts hook (always in editor)
wp_enqueue_script('mpl4e-editor-js', ...);
```

This ensures visitors never download editor functionality they don't need.

## Architecture Components

### 1. Widget Registry (`src/core/widget-registry.js`)
Central registry mapping widget names to their React components and settings mappers.

**To add a new widget:**
```javascript
import NewWidget from '../widgets/new-widget/new-widget';
import newWidgetSettings from '../widgets/new-widget/react-settings.json';
import { createSettingsMapper } from '../widgets/settings-mappers';

export const WIDGET_REGISTRY = {
    'new-widget': {
        component: NewWidget,
        settingsMapper: createSettingsMapper(newWidgetSettings)
    }
};
```

### 2. Widget Manager (`src/core/widget-manager.jsx`)
Singleton that manages all React widget instances across all types.

**Key features:**
- Prevents duplicate React roots
- Handles instance lifecycle (mount/unmount/update)
- Provides **two-way communication** between React ↔ Elementor

**Critical method for custom layouts:**
```javascript
updateModelSetting(widgetType, widgetId, settingName, value)
```

### 3. Widget Initializer (`src/core/widget-initializer.js`)
Factory function that creates initialization functions for each widget type.

**Handles:**
- DOM extraction (wrapper, root element)
- Settings parsing (from hidden input or model getter)
- Widget manager coordination
- Mode-aware initialization ('display' for frontend, 'edit' for editor)

### 4. Elementor Hooks (Split Architecture)

#### Frontend Hooks (`src/core/frontend-hooks.js`)
Lightweight hooks for production frontend.

**Functions:**
- `registerFrontendHooks()` - Widget initialization in display mode
- `initializeFrontendWidgets()` - Fallback for non-Elementor pages

#### Editor Hooks (`src/core/editor-hooks.js`)
Full-featured hooks for Elementor editor.

**Functions:**
- `registerFrontendHooks()` - Widget initialization in edit mode (same pattern, different mode)
- `registerEditorHooks()` - Live settings sync, prevent DOM re-renders, conditional renderOnChange
- `setupEditorObserver()` - MutationObserver for drag & drop in editor
- `initializeEditorHooks()` - Orchestrates all three functions

**CSS Regeneration:**
The global `editor/widget/renderOnChange` filter returns `false` for registered widgets, which blocks Elementor's normal CSS regeneration path (`renderOnChange` → `renderChanges` → `renderUI`). To compensate, `editor-hooks.js` explicitly calls `view.renderUI()` — which rebuilds the widget's stylesheet from control `selectors` definitions **without touching the DOM** — in two places:
1. The general `model.on('change')` listener (individual panel changes)
2. The `mosaic:applySetup` batch handler (saved setup loads)

**Channel Events:**
- `mosaic:resetLayout` — Clears custom layout, reverts to predefined
- `mosaic:addItem` — Adds a new grid item to the layout
- `mosaic:applySetup` — Batch-applies all settings from a saved setup (layout, styles, CSS)

### 5. Settings Mappers (`src/widgets/settings-mappers.js`)
Extract and format widget settings from Elementor models.

Each widget has its own mapper function:
```javascript
export const mapProductsLayoutSettings = (model) => { /* ... */ }
export const mapCategoriesLayoutSettings = (model) => { /* ... */ }
```

### 6. Elementor Utils (`src/core/elementor-utils.js`)
Helper functions for React components to interact with Elementor.

**Key functions:**
- `updateElementorSetting()` - Update Elementor model from React
- `getActiveBreakpointNames()` - Get responsive breakpoint names from Elementor config
- `getElementorGridBreakpoints()` - Get breakpoint min-width values for `react-grid-layout`
- `injectBreakpointStylesheet()` - Inject dynamic breakpoint CSS
- `isElementorEditor()` - Check if running in editor context

**Use in components:**
```javascript
import { updateElementorSetting } from '../../core/elementor-utils';

// Update Elementor setting (saves custom layout)
updateElementorSetting('products-layout', widgetId, 'custom_layout', JSON.stringify(layout));
```

## Data Flow

### Settings: Elementor → React
```
Elementor controls 
  → PHP content_template() 
  → JSON in hidden input (<input class="elementor-settings-data">) 
  → React reads via initWidget() 
  → Settings mapper formats data 
  → Widget component receives props (widgetData)
```

**Editor Mode Alternative:**
```
Elementor model.get('settings') 
  → Settings mapper (mappers use model directly) 
  → widgetManager.modelGetters[key] 
  → updateInstance() on model change 
  → React component re-renders
```

### Custom Layout: React → Elementor
```
User drags/resizes grid item 
  → onLayoutChange callback 
  → updateElementorSetting() 
  → widgetManager.updateModelSetting() 
    → Preferred: `$e.run('document/elements/settings', { container, settings })`
    → Fallback: `model.setSetting()`
    → Auto-save/dirty flag handled by Elementor APIs
```

### WooCommerce Products: Store API → React
```
React component mounts 
  → useEffect() triggers WC Store API fetch 
  → Endpoint: /wp-json/wc/store/products 
  → Query params from widgetData (category, limit, order, etc.) 
  → Nonce from window.MPL4E.storeApiNonce 
  → Products setState() 
  → Component renders product grid
```

### Add to Cart: React → WooCommerce
```
User clicks Add to Cart button 
  → AddToCartButton component 
  → POST to /wp-json/wc/store/cart/add-item 
  → Includes product_id, quantity, nonce 
  → WooCommerce updates cart 
  → Success: Show confirmation, update cart count 
  → Error: Show error message
```

## File Structure

```
src/
├── main-frontend.jsx                # Frontend entry point (lightweight)
├── main-editor.jsx                  # Editor entry point (full-featured)
├── globalStyles.scss                # Global styles for all widgets
├── core/
│   ├── widget-registry.js           # Widget type registry
│   ├── widget-manager.jsx           # Generic widget instance manager
│   ├── widget-initializer.js        # Widget init factory
│   ├── frontend-hooks.js            # Frontend-only hooks (minimal)
│   ├── editor-hooks.js              # Editor hooks (full functionality + channel events)
│   └── elementor-utils.js           # Shared utilities: breakpoints, CSS injection, panel helpers
├── widgets/
│   ├── settings-mappers.js          # createSettingsMapper() factory for all widgets
│   ├── products-layout/
│   │   ├── products-layout.jsx      # Products widget component
│   │   ├── products-layout.scss     # Widget-specific styles
│   │   └── react-settings.json     # Settings schema (source of truth)
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
│   ├── layouts.json                 # Predefined grid layouts (products/categories)
│   ├── components/
│   │   ├── GridLayout.jsx           # react-grid-layout wrapper
│   │   ├── GridHelper.jsx           # Shared grid sizing helpers
│   │   ├── ItemControls.jsx         # Shared per-item controls UI
│   │   ├── Pagination.jsx           # Shared pagination UI
│   │   ├── ProductImage.jsx         # Image with focal-point support
│   │   ├── RatingStars.jsx          # WooCommerce star ratings
│   │   ├── AddToCartButton.jsx      # Store API cart integration
│   │   ├── ZIndexControls.jsx       # Per-item z-index editor controls
│   │   └── utils/
│   │       └── events.js            # Custom DOM event helpers
│   ├── utils/
│   │   ├── hooks.js                # useCssVariables(), useGridSettings()
│   │   ├── addItem.js              # Grid item add/remove logic
│   │   ├── alignmentUtils.js       # Shared alignment variable helpers
│   │   ├── dataLoading.js          # Shared cached loading flow helper
│   │   ├── layoutUtils.js          # Layout computation utilities
│   │   ├── layoutEditing.js        # Shared Elementor model layout edits
│   │   ├── elementOrdering.js      # Element order/visibility parser
│   │   ├── LRUCache.js             # LRU cache (editor) / plain object (frontend)
│   │   ├── fetchHelpers.js         # Shared REST nonce + JSON parsing helpers
│   │   ├── productUtils.js         # WooCommerce product helpers
│   │   ├── transformationUtils.js  # Shared snake_case → camelCase mapping
│   │   ├── visibleLayout.js        # Visibility-aware layout resolver
│   │   └── generalUtils.js         # General helper functions
│   └── assets/
│       ├── _gridLayout.scss        # Shared grid styles
│       ├── _itemControls.scss      # Shared item-control styles
│       ├── _productElements.scss   # Shared product element styles
│       └── (shared partials imported in widget styles)
└── controls/
    ├── focal-point-control.jsx      # Focal point picker React component
    ├── FocalPointControlView.jsx    # Elementor BaseData view extension
    ├── focal-point-control.scss
    ├── product-select-control.jsx   # Product selector React component
    ├── ProductSelectView.jsx        # Elementor BaseData view extension
    ├── product-select-control.scss
    ├── saved-setups-control.jsx     # Saved setups React component + control view
    └── saved-setups-control.scss

widgets/                              # PHP widget classes (all use WidgetHelpers trait)
├── products-layout.php
├── categories-layout.php
└── single-product-layout.php

controls/                             # PHP custom control classes
├── focal-point.php
├── product-select.php
├── element-sorting.php
└── saved-setups.php

includes/
├── trait-widget-helpers.php         # Shared render(), content_template(), get_widget_settings()
└── class-rest-api.php               # REST API handler

assets/                               # Built output (generated by Vite)
├── js/
│   └── main-frontend.js             # Compiled frontend bundle
├── css/
│   └── main-frontend.css            # Compiled frontend styles
└── admin/
    ├── js/
    │   ├── main-editor.js           # Compiled editor bundle
    │   ├── focal-point-control.js
    │   ├── product-select-control.js
    │   └── saved-setups-control.js
    └── css/
        ├── main-editor.css
        ├── focal-point-control.css
        ├── product-select-control.css
        └── saved-setups-control.css
```

## Key Features Preserved

### ✅ Custom Layout Saving
- Drag/resize triggers `onLayoutChange`
- Component calls `updateElementorSetting()`
- Widget manager updates Elementor model
- Changes auto-save in Elementor

### ✅ Layout Reset
- Reset button triggers `mosaic:resetLayout` event
- Elementor hooks listen and clear `custom_layout` setting
- React receives update and re-renders with predefined layout

### ✅ Live Settings Sync
- Elementor panel changes trigger model.on('change')
- Widget manager calls `updateInstance()` with new settings
- `view.renderUI()` regenerates CSS for `selectors`-based controls (colours, borders, shadows) without DOM destruction
- React component re-renders without DOM remount

### ✅ Saved Setups (Save/Load/Delete Presets)
- Custom Elementor control with React UI in the editor panel
- Save current layout+style settings as a named preset to `wp_options`
- Load a saved setup: batch-applies all settings atomically via `mosaic:applySetup` channel event
- Delete saved setups from the dropdown
- Persisted via WP Settings API (`wp.apiFetch` → `/wp/v2/settings`)
- Settings captured: layout keys, style keys, responsive variants, selector-only CSS keys, group control sub-keys
- Batch apply mechanism: temporarily disables `renderOnChange` and `change:mpl4e_layout` listener, calls `settingsModel.set()` atomically, then `renderUI()` for CSS + `updateInstance()` for React

## Adding a New Widget

1. **Create settings schema** (`src/widgets/new-widget/react-settings.json`)
   - Define all widget settings with types, defaults, and responsive config
   - This file is read by both PHP (`trait-widget-helpers.php`) and JS (`widget-registry.js`)

2. **Create React component** (`src/widgets/new-widget/new-widget.jsx`)
   - Accept `widgetData`, `widgetId`, and `mode` props
   - Use `useCssVariables(widgetData)` from `src/shared/utils/hooks.js` for responsive CSS vars

3. **Register in registry** (add to `src/core/widget-registry.js`)
   ```javascript
   import NewWidget from '../widgets/new-widget/new-widget';
   import newWidgetSettings from '../widgets/new-widget/react-settings.json';
   import { createSettingsMapper } from '../widgets/settings-mappers';
   
   export const WIDGET_REGISTRY = {
       'new-widget': {
           component: NewWidget,
           settingsMapper: createSettingsMapper(newWidgetSettings)
       }
   };
   ```

4. **Create PHP widget** (`widgets/new-widget.php`)
   - Extend `\Elementor\Widget_Base` and use the `WidgetHelpers` trait
   - `get_name()` must return `'new-widget'` (must match the registry key exactly)
   - Define controls using `register_controls()`
   - The trait provides `render()`, `content_template()`, and `get_widget_settings()`

5. **Register in main plugin** (`mosaic-product-layouts-for-elementor.php`)
   ```php
   public function init_widgets( $widgets_manager ) {
       require_once __DIR__ . '/widgets/new-widget.php';
       $widgets_manager->register( new NewWidget() );
   }
   ```

**That's it!** All initialization, hooks, and lifecycle management is handled automatically.

## Global Variables

### `window.MosaicLayoutsReact` (Widget Manager Singleton)
- `.instances` - All mounted widget instances
  - Key: `${widgetType}_${widgetId}`
  - Value: `{ root, rootElement, widgetType, currentSettings, updateSettings() }`
- `.modelGetters` - Functions to get current Elementor settings (editor only)
  - Key: `${widgetType}_${widgetId}`
  - Value: `() => mappedSettings`
- `.models` - Elementor model references for two-way updates (editor only)
  - Key: `${widgetType}_${widgetId}`
  - Value: Elementor model object
- `.updateModelSetting(widgetType, widgetId, settingName, value)` - Update Elementor from React
- `.updateInstance(widgetType, widgetId, newSettings)` - Update React instance
- `.getModel(widgetType, widgetId)` - Get Elementor model (editor only)

### `window.MPL4E` (Localized PHP Data)
Provided by `wp_localize_script()` in PHP:
- `.storeApiNonce` - WooCommerce Store API authentication nonce
- `.cartUrl` - WooCommerce cart page URL
- `.ajaxUrl` - WordPress AJAX endpoint URL
- `.placeholderImg` - Placeholder image URL for products without images

### `window.elementorFrontend` (Elementor Frontend API)
- `.hooks.addAction()` - Register frontend hooks for widget initialization
- `.config.responsive.activeBreakpoints` - Active breakpoint configuration

### `window.elementor` (Elementor Editor API - Editor Only)
- `.hooks.addFilter()` - Register editor filters (e.g., renderOnChange)
- `.hooks.addAction()` - Register editor actions (e.g., panel/open_editor)
- `.channels.editor.on()` - Listen to custom events
- `.channels.editor.trigger()` - Emit custom events
- `.saver.setFlagEditorChange()` - Mark document as changed
- `.getPanelView()` - Get current panel view and active widget
- `.addControlView()` - Register custom control JS views
- `.notifications.showToast()` - Show editor toast notifications

**Custom Channel Events:**
| Event | Direction | Purpose |
|-------|-----------|----------|
| `mosaic:resetLayout` | React → editor-hooks | Clear custom layout, revert to predefined |
| `mosaic:addItem` | Panel → editor-hooks | Add new grid item to layout |
| `mosaic:applySetup` | Panel control → editor-hooks | Batch-apply saved setup settings |

## Script Enqueuing Strategy

### Frontend (`enqueue_scripts` hook)
**When:** Only on published pages with Elementor content (not in editor preview)
**Loads:**
- `assets/js/main-frontend.js` - Lightweight display-only bundle
- `assets/css/main-frontend.css` - Frontend styles
- React/ReactDOM from WordPress
- WooCommerce Store API nonce

### Editor Preview (`elementor/preview/enqueue_scripts` hook)
**When:** Inside Elementor editor preview iframe
**Loads:**
- `assets/admin/js/main-editor.js` - Full-featured editor bundle
- `assets/admin/css/main-editor.css` - Editor styles
- React/ReactDOM from WordPress
- WooCommerce Store API nonce

### Editor Panel (`elementor/editor/after_enqueue_scripts` hook)
**When:** Elementor editor interface (not preview)
**Loads:**
- React/ReactDOM for custom controls
- Custom control scripts are enqueued by each control's `enqueue()` method:
  - `focal-point-control.js` (deps: `jquery`, `react`, `react-dom`)
  - `saved-setups-control.js` (deps: `jquery`, `react`, `react-dom`, `wp-api-fetch`, `wp-i18n`)

## Custom Controls System

Custom controls follow a PHP + React pattern: a PHP class provides the Elementor control wrapper, and a React component renders the interactive UI inside the panel.

### PHP Control Classes (`controls/*.php`)
- Extend `\Elementor\Base_Data_Control`
- Implement `get_type()`, `get_default_settings()`, `content_template()`
- `enqueue()` loads the control's JS/CSS bundle
- Registered via `elementor/controls/register` action

| Control | PHP Class | Type Slug | Purpose |
|---------|-----------|-----------|----------|
| Focal Point | `Focal_Point` | `mpl4e_focal_point` | Image focal-point picker |
| Product Select | `Product_Select` | `mpl4e_product_select` | Single-product selector with search |
| Element Sorting | `Element_Sorting` | `mpl4e_sorter_label` | Drag-to-reorder element visibility list |
| Saved Setups | `Saved_Setups` | `mpl4e_saved_setups` | Save/load/delete layout+style presets |

### React Control Components (`src/controls/*.jsx`)
- Each control has its own Vite build entry → separate IIFE bundle
- Extends `elementor.modules.controls.BaseData` at runtime
- Mounts a React component into the panel DOM container
- Updates Elementor model via `this.setValue()`

### Saved Setups Control (`src/controls/saved-setups-control.jsx`)

A custom control for managing layout+style presets:

**Architecture:**
- PHP `content_template()` renders a hidden `<input data-setting="value">` (stores selected setup ID) + a React mount `<div>`
- JS extends `BaseData`, creates a React root in `onReady()`, unmounts in `onBeforeDestroy()`
- React component (`SavedSetupsUI`) manages all UI state internally

**Settings Manifest:**
The control defines which settings to capture/restore:
- `LAYOUT_KEYS` — Grid layout settings (layout ID, custom layout JSON, margins, row height, overlap, compaction)
- `STYLE_KEYS` — React-mapped style settings (product layout, sizes, alignment, image settings)
- `SELECTOR_STYLE_KEYS` — CSS-only settings with `selectors` (colors, borders, gaps, padding)
- `GROUP_CONTROL_PREFIXES` — Elementor group controls (background, border, box-shadow) whose sub-keys are captured by prefix scan
- `RESPONSIVE_KEYS` — Settings with `_tablet` / `_mobile` breakpoint variants

**Persistence:**
- Stored in `wp_options` as JSON string under key `mpl4e_products_layout_setups`
- Registered via `register_setting()` with `show_in_rest: true`
- Read/written via `wp.apiFetch({ path: '/wp/v2/settings' })`

**Batch Apply via Channel Event:**
- `applySettingsToModel()` triggers `elementor.channels.editor.trigger('mosaic:applySetup', { widgetId, settings })`
- The handler in `editor-hooks.js` has access to the widget `view` and `model` in the preview iframe context
- Temporarily disables `renderOnChange` and `change:mpl4e_layout` listener
- Calls `settingsModel.set(setupSettings)` atomically
- Restores handlers, pushes final state to React, calls `view.renderUI()` for CSS

### Control Registration
```php
public function init_controls( $controls_manager ) {
    require_once __DIR__ . '/controls/focal-point.php';
    $controls_manager->register( new Focal_Point() );

    require_once __DIR__ . '/controls/product-select.php';
    $controls_manager->register( new Product_Select() );

    require_once __DIR__ . '/controls/element-sorting.php';
    $controls_manager->register( new Element_Sorting() );

    require_once __DIR__ . '/controls/saved-setups.php';
    $controls_manager->register( new Saved_Setups() );
}
```

## Settings Definition System

### JSON Schema (`src/widgets/{widget}/react-settings.json`)
Each widget has its own settings schema co-located with the component. This file is the single source of truth loaded by both PHP and JS.

Defines all widget settings with metadata for automatic mapping:

```json
{
    "title_size": {
        "type": "responsive",
        "default": "24px",
        "tablet_default": "20px",
        "mobile_default": "18px"
    },
    "show_rating": {
        "type": "boolean",
        "default": true
    },
    "products_per_page": {
        "type": "number",
        "default": 12
    }
}
```

### Settings Mapper (`src/widgets/settings-mappers.js`)
`createSettingsMapper(settingsDef)` is a factory that returns a `(model) => widgetData` function for any widget. No per-widget mapper functions are needed.

- **Responsive settings**: Merges `key` + `key_tablet` + `key_mobile` into `{ desktop, tablet, mobile }` object
- **Boolean conversion**: `'yes'`/`'no'` → `true`/`false`
- **Array settings**: Calls `.toJSON()` on Backbone collections (Elementor repeaters)
- **Type enforcement**: Ensures numbers, strings, objects
- **Default values**: Falls back to schema defaults

### Shared Hooks (`src/shared/utils/hooks.js`)

`useCssVariables(widgetData)` — converts responsive settings into scoped CSS custom properties:
- Input: `widgetData.title_size = { desktop: '24px', tablet: '20px', mobile: '18px' }`
- Output: `{ '--mpl4e-title-size-desktop': '24px', '--mpl4e-title-size-tablet': '20px', '--mpl4e-title-size-mobile': '18px' }`

`useGridSettings(widgetData, marginKey, rowHeightKey)` — derives grid column count, margin, and row height from widget data.

These are consumed by all three widget components. Responsive breakpoint CSS is injected via `injectBreakpointStylesheet()` in `elementor-utils.js`, which generates media queries using these CSS variables.

## Important Notes

- **Widget type must match PHP `get_name()`**: 'products-layout', 'categories-layout', etc.
- **Compound instance keys**: `${widgetType}_${widgetId}` prevents collisions
- **Conditional DOM re-renders**: `renderOnChange` override allows remounts for core/advanced changes while preventing them for widget-owned settings; widget changes call `view.renderUI()` for CSS regeneration only
- **Elementor channel events**: `mosaic:resetLayout`, `mosaic:addItem`, `mosaic:applySetup` enable cross-context communication (panel control → preview iframe)
- **MutationObserver**: Detects widgets added via drag & drop in Elementor editor
- **Responsive settings expansion**: Widget manager expands responsive keys to include breakpoint variants for accurate change detection
- **Two-bundle strategy**: Reduces frontend payload by ~50% compared to single bundle

## WooCommerce Integration

### Store API

The plugin uses WooCommerce's REST API (Store API) for all product operations:

**Endpoints Used:**
- `GET /wp-json/wc/store/products` - Fetch products with query parameters
- `POST /wp-json/wc/store/cart/add-item` - Add product to cart

**Authentication:**
- Uses WordPress nonce system via `wp_create_nonce('wc_store_api')`
- Nonce passed to React via `window.MPL4E.storeApiNonce`
- Included in request headers: `Nonce: {nonce}`

**Query Parameters (Products):**
```javascript
{
    per_page: 12,              // Products per page
    category: '15,23',         // Comma-separated category IDs
    orderby: 'popularity',     // Sort: date, popularity, rating, price
    order: 'desc',             // asc or desc
    on_sale: true,             // Filter sale items
    featured: true,            // Filter featured items
}
```

### Product Data Structure

Products fetched from Store API include:

```javascript
{
    id: 123,
    name: "Product Name",
    permalink: "https://...",
    price: "29.99",
    regular_price: "39.99",
    sale_price: "29.99",
    on_sale: true,
    images: [
        {
            id: 456,
            src: "https://...",
            thumbnail: "https://...",
        }
    ],
    average_rating: "4.5",
    rating_count: 42,
    categories: [...],
}
```

### Add to Cart Flow

1. User clicks "Add to Cart" button
2. `AddToCartButton` component sends POST request
3. Request includes:
   - Product ID
   - Quantity (default: 1)
   - Variations (if applicable)
   - Nonce for authentication
4. WooCommerce processes request
5. Success: Show notification, update cart count (if header cart exists)
6. Error: Display error message to user

### Placeholder Images

Fallback for products without images:
```javascript
// Provided via wp_localize_script
window.MPL4E.placeholderImg = 'plugins/.../woocommerce-placeholder-300x300.png';

// Used in ProductImage component
<img src={imageUrl || window.MPL4E?.placeholderImg} />
```

### WooCommerce Compatibility

**Minimum Requirements:**
- WooCommerce 5.0+ (Store API availability)
- WordPress 5.8+ (modern REST API)
- PHP 7.0+

**Tested With:**
- WooCommerce 8.0+
- Block-based themes
- Classic themes with WooCommerce support

**Known Limitations:**
- Does not support variable products with complex variations (yet)
- Grouped products display as simple products
- External/affiliate products redirect to external URL on click

## Build Configuration

### Vite Multi-Entry Setup

The project uses Vite with a custom multi-entry configuration that builds five separate bundles:

| Entry Point | Environment Variable | Output Directory | Purpose |
|-------------|---------------------|------------------|---------|
| `src/main-frontend.jsx` | `BUILD_ENTRY=main-frontend` | `assets/` | Frontend display |
| `src/main-editor.jsx` | `BUILD_ENTRY=main-editor` | `assets/admin/` | Editor preview |
| `src/controls/focal-point-control.jsx` | `BUILD_ENTRY=focal-point-control` | `assets/admin/` | Focal point control |
| `src/controls/saved-setups-control.jsx` | `BUILD_ENTRY=saved-setups-control` | `assets/admin/` | Saved setups control |
| `src/controls/product-select-control.jsx` | `BUILD_ENTRY=product-select-control` | `assets/admin/` | Product select control |

### Build Commands

```bash
# Build all bundles for production (no sourcemaps)
npm run build:prod

# Build all bundles for development (with sourcemaps)
npm run build

# Watch mode - rebuild on file changes
npm run watch              # Watch frontend bundle only (recommended)
npm run watch:editor       # Watch editor bundle only
npm run watch:control      # Watch focal point control only
npm run watch:setups       # Watch saved setups control only
npm run watch:product-select # Watch product select control only
npm run watch:all          # Watch all bundles (resource intensive)
```

### Externalized Dependencies

React, ReactDOM, and WordPress packages are **externalized** and mapped to WordPress globals:

```javascript
// vite.config.js
external: ['react', 'react-dom', '@wordpress/api-fetch', '@wordpress/i18n'],
globals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    '@wordpress/api-fetch': 'wp.apiFetch',
    '@wordpress/i18n': 'wp.i18n',
}
```

This prevents bundling React twice and uses WordPress's built-in React and utilities:
```php
// PHP enqueues WordPress's React
wp_enqueue_script('react');
wp_enqueue_script('react-dom');
// Saved setups control also depends on:
wp_enqueue_script('wp-api-fetch');
wp_enqueue_script('wp-i18n');
```

### Output Structure

```
assets/
├── js/
│   └── main-frontend.js            # ~172KB (gzipped ~51KB)
├── css/
│   └── main-frontend.css
└── admin/
    ├── js/
    │   ├── main-editor.js           # ~175KB (gzipped ~52KB)
    │   ├── focal-point-control.js   # ~5KB
    │   ├── product-select-control.js
    │   └── saved-setups-control.js  # ~7KB
    └── css/
        ├── main-editor.css
        ├── focal-point-control.css
        ├── product-select-control.css
        └── saved-setups-control.css
```

### Shared Configuration (`vite.config.js`)

**Base Config:**
- `@vitejs/plugin-react` - JSX transformation
- Path alias: `@` → `src/` for cleaner imports
- SCSS support via `sass` package

**Build Options:**
- Format: IIFE (Immediately Invoked Function Expression)
- Sourcemaps: Enabled in dev, disabled in production
- CSS Code Split: Disabled (single CSS file per entry)
- Empty Out Dir: **False** (prevents deleting other entries when building individually)

### Development Workflow

1. **Initial Build:**
   ```bash
   npm run build
   ```

2. **Watch Mode (Recommended):**
   ```bash
   npm run watch
   ```
   - Auto-rebuilds on file changes
   - Refresh browser manually to see changes
   - Use browser DevTools for debugging

3. **No Hot Module Replacement (HMR):**
   - Elementor runs widgets inside an iframe
   - HMR cannot connect through iframe boundary
   - Manual refresh required after rebuilds

4. **Multi-Terminal Workflow (Optional):**
   ```bash
   # Terminal 1: Watch frontend
   npm run watch
   
   # Terminal 2: Watch editor
   npm run watch:editor
   
   # Terminal 3: Watch control
   npm run watch:control

    # Terminal 4: Watch product select control
    npm run watch:product-select
   ```

### File Watching

Watch mode monitors these paths:
```javascript
watch: {
    include: ['src/**/*.{js,ts,jsx,tsx,scss}']
}
```

**Triggers rebuild on changes to:**
- All JavaScript/TypeScript files in `src/`
- All React components (`.jsx`, `.tsx`)
- All SCSS stylesheets

**Does NOT watch:**
- PHP files (`widgets/*.php`, `controls/*.php`)
- Root plugin file (`mosaic-product-layouts-for-elementor.php`)
- JSON files (changes require manual rebuild)

### Debugging

**Frontend Issues:**
1. Check browser console for errors
2. Verify `main-frontend.js` loads correctly
3. Check `window.MosaicLayoutsReact` is defined
4. Verify WooCommerce Store API responses

**Editor Issues:**
1. Open Elementor editor preview iframe console
2. Check `main-editor.js` loads correctly
3. Verify widget hooks are registered
4. Check `elementor` and `elementorFrontend` globals
5. Monitor network tab for model updates

**Build Issues:**
1. Clear `assets/` and `assets/admin/` directories
2. Run `npm run build` to rebuild all
3. Check for TypeScript/ESLint errors
4. Verify all imports resolve correctly

### Performance Optimization

**Frontend Bundle:**
- No drag/resize libraries (react-grid-layout excluded)
- No editor-specific code
- Minimal hooks and utilities
- Result: ~50% smaller than editor bundle

**Code Splitting:**
- Each entry is self-contained
- Shared code duplicated across bundles (intentional)
- No dynamic imports (WordPress doesn't support module loading well)

**Caching:**
- WordPress handles React/ReactDOM caching
- Plugin bundles use version-based cache busting via `VERSION` constant

### Troubleshooting Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Changes not reflecting | Browser cache | Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5) |
| Build fails | Missing dependencies | `npm install` |
| React errors | Version mismatch | Ensure WordPress React matches package.json |
| Watch not triggering | Wrong file extension | Only watches `.js`, `.jsx`, `.ts`, `.tsx`, `.scss` |
| Multiple bundles conflict | Race condition | Build sequentially, not in parallel |

### Production Deployment

1. **Build for production:**
   ```bash
   npm run build:prod
   ```

2. **Verify output:**
   - Check `assets/js/main-frontend.js` exists
   - Check `assets/admin/js/main-editor.js` exists
   - Check `assets/admin/js/focal-point-control.js` exists
   - Check `assets/admin/js/saved-setups-control.js` exists

3. **Test:**
   - Frontend: View published page
   - Editor: Open Elementor editor
   - Controls: Open widget settings panel, test focal point and saved setups

4. **Commit:**
   ```bash
   git add assets/
   git commit -m "Build production bundles"
   ```

**Note:** Built assets should be committed to version control for WordPress.org plugin repository compatibility.
