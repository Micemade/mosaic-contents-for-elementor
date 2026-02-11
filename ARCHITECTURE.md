# Multi-Widget Architecture

## Overview

The codebase has been refactored to support multiple widget types using a shared generic architecture. This allows easy addition of new widgets (categories-layout, single-product-layout, etc.) without code duplication.

The architecture uses **two separate build outputs**:
- **Frontend Bundle** (`main-frontend.jsx`) - Lightweight, display-only for published pages
- **Editor Bundle** (`main-editor.jsx`) - Full-featured with drag/resize, add/remove items, and live settings sync for Elementor editor

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
import { mapNewWidgetSettings } from '../widgets/settings-mappers';

export const WIDGET_REGISTRY = {
    'new-widget': {
        component: NewWidget,
        settingsMapper: mapNewWidgetSettings
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
- `getActiveBreakpoints()` - Get responsive breakpoints from Elementor config
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
  → Elementor model.setSetting() 
  → Auto-save triggered 
  → elementor.saver.setFlagEditorChange(true)
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
│   ├── editor-hooks.js              # Editor hooks (full functionality)
│   └── elementor-utils.js           # Helper utilities for components
├── widgets/
│   ├── settings-mappers.js          # Settings extractors for all widgets
│   └── products-layout/
│       ├── products-layout.jsx      # Products widget component
│       ├── products-layout.scss     # Widget-specific styles
│       ├── components/              # Widget-specific React components
│       │   ├── ProductImage.jsx
│       │   ├── AddToCartButton.jsx
│       │   └── RatingStars.jsx
│       └── utils/
│           └── products-layout-settings.json  # Settings schema definition
├── shared/
│   ├── layouts.json                 # Predefined grid layouts
│   ├── components/
│   │   ├── GridLayout.jsx           # Shared grid component (react-grid-layout wrapper)
│   │   └── utils/
│   │       └── events.js            # Custom event utilities
│   ├── utils/
│   │   ├── addItem.js              # Grid item add/remove logic
│   │   ├── layoutUtils.js          # Layout computation utilities
│   │   ├── productUtils.js         # WooCommerce product utilities
│   │   └── generalUtils.js         # General helper functions
│   └── assets/
│       ├── _gridLayout.scss        # Shared grid styles
│       └── _productElements.scss   # Shared product element styles
└── controls/
    ├── focal-point-control.jsx      # Custom control React component
    ├── FocalPointControlView.jsx    # Control view implementation
    └── focal-point-control.scss     # Control styles

widgets/                              # PHP widget definitions
└── products-layout.php              # PHP widget class with Elementor controls

controls/                             # PHP custom control definitions
└── focal-point.php                  # PHP custom control class

assets/                               # Built output (generated by Vite)
├── js/
│   └── main-frontend.js             # Compiled frontend bundle
├── css/
│   └── main-frontend.css            # Compiled frontend styles
└── admin/
    ├── js/
    │   ├── main-editor.js           # Compiled editor bundle
    │   └── focal-point-control.js   # Compiled custom control
    └── css/
        ├── main-editor.css          # Compiled editor styles
        └── focal-point-control.css  # Compiled control styles
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
- React component re-renders without DOM remount

## Adding a New Widget

1. **Create settings schema** (`src/widgets/new-widget/utils/new-widget-settings.json`)
   - Define all widget settings with types, defaults, and responsive config

2. **Create React component** (`src/widgets/new-widget/new-widget.jsx`)
   - Use `widgetData` prop for settings
   - Use `widgetId` prop for unique identification
   - Use `mode` prop to detect 'edit' vs 'display'

3. **Create settings mapper** (add to `src/widgets/settings-mappers.js`)
   ```javascript
   import newWidgetSettings from './new-widget/utils/new-widget-settings.json';
   
   export const mapNewWidgetSettings = (model) => {
       // Extract and format settings from Elementor model
       // Handle responsive settings with getResponsiveValue()
   };
   ```

4. **Register in registry** (add to `src/core/widget-registry.js`)
   ```javascript
   import NewWidget from '../widgets/new-widget/new-widget';
   import { mapNewWidgetSettings } from '../widgets/settings-mappers';
   
   export const WIDGET_REGISTRY = {
       'new-widget': {
           component: NewWidget,
           settingsMapper: mapNewWidgetSettings
       }
   };
   ```

5. **Create PHP widget** (`widgets/new-widget.php`)
   - Extend `\Elementor\Widget_Base`
   - `get_name()` must return 'new-widget' (matches registry key)
   - Define controls using `register_controls()`
   - Output wrapper + React root in `content_template()`
   - Include `data-widget-id="{{ view.model.id }}"`

6. **Register in main plugin** (`mosaic-product-layouts-for-elementor.php`)
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
- `.channels.editor.on()` - Listen to custom events (e.g., mosaic:resetLayout)
- `.saver.setFlagEditorChange()` - Mark document as changed
- `.getPanelView()` - Get current panel view and active widget

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
- Custom control scripts (e.g., focal-point-control.js)

## Custom Controls System

### PHP Control Class (`controls/focal-point.php`)
- Extends `\Elementor\Base_Data_Control`
- Implements `get_type()`, `get_default_settings()`, `content_template()`
- Registered via `elementor/controls/register` action

### React Control Component (`src/controls/focal-point-control.jsx`)
- Matches control type from PHP
- Handles UI rendering and user interaction
- Updates Elementor model on change

### Control Registration
```php
public function init_controls( $controls_manager ) {
    require_once __DIR__ . '/controls/focal-point.php';
    $controls_manager->register( new Focal_Point() );
}
```

## Settings Definition System

### JSON Schema (`widgets/[widget]/utils/[widget]-settings.json`)
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

### Settings Mapper (`widgets/settings-mappers.js`)
Uses schema to extract and convert settings:
- **Responsive settings**: Extracts base + breakpoint variants (`key`, `key_tablet`, `key_mobile`)
- **Boolean conversion**: 'yes'/'no' → true/false
- **Type enforcement**: Ensures numbers, strings, etc.
- **Default values**: Falls back to schema defaults

## Important Notes

- **Widget type must match PHP `get_name()`**: 'products-layout', 'categories-layout', etc.
- **Compound instance keys**: `${widgetType}_${widgetId}` prevents collisions
- **Conditional DOM re-renders**: `renderOnChange` override allows remounts for core/advanced changes while preventing them for widget-owned settings
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

The project uses Vite with a custom multi-entry configuration that builds three separate bundles:

| Entry Point | Environment Variable | Output Directory | Purpose |
|-------------|---------------------|------------------|---------|
| `src/main-frontend.jsx` | `BUILD_ENTRY=main-frontend` | `assets/` | Frontend display |
| `src/main-editor.jsx` | `BUILD_ENTRY=main-editor` | `assets/admin/` | Editor preview |
| `src/controls/focal-point-control.jsx` | `BUILD_ENTRY=focal-point-control` | `assets/admin/` | Custom control |

### Build Commands

```bash
# Build all bundles for production (no sourcemaps)
npm run build:prod

# Build all bundles for development (with sourcemaps)
npm run build

# Watch mode - rebuild on file changes
npm run watch              # Watch frontend bundle only (recommended)
npm run watch:editor       # Watch editor bundle only
npm run watch:control      # Watch control bundle only
npm run watch:all          # Watch all bundles (resource intensive)
```

### Externalized Dependencies

React and ReactDOM are **externalized** and mapped to WordPress globals:

```javascript
// vite.config.js
external: ['react', 'react-dom'],
globals: {
    react: 'React',
    'react-dom': 'ReactDOM',
}
```

This prevents bundling React twice and uses WordPress's built-in React:
```php
// PHP enqueues WordPress's React
wp_enqueue_script('react');
wp_enqueue_script('react-dom');
```

### Output Structure

```
assets/
├── js/
│   └── main-frontend.js       # ~150KB (gzipped ~50KB)
├── css/
│   └── main-frontend.css
└── admin/
    ├── js/
    │   ├── main-editor.js     # ~300KB (gzipped ~100KB)
    │   └── focal-point-control.js
    └── css/
        ├── main-editor.css
        └── focal-point-control.css
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

3. **Test:**
   - Frontend: View published page
   - Editor: Open Elementor editor
   - Control: Open widget settings panel

4. **Commit:**
   ```bash
   git add assets/
   git commit -m "Build production bundles"
   ```

**Note:** Built assets should be committed to version control for WordPress.org plugin repository compatibility.
