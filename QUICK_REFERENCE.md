# Quick Reference: Widget System Flow

## Dual-Bundle Architecture

```
Frontend Bundle (main-frontend.jsx)          Editor Bundle (main-editor.jsx)
  ├─→ widget-registry.js                       ├─→ widget-registry.js
  ├─→ frontend-hooks.js (minimal)              ├─→ editor-hooks.js (full)
  │     └─→ widget-initializer.js              │     ├─→ widget-initializer.js
  ├─→ widget-manager.jsx (singleton)           │     ├─→ widget-manager.jsx
  └─→ elementor-utils.js                       │     └─→ settings-mappers.js
       └─→ Display only                        └─→ elementor-utils.js
                                                     └─→ Drag/resize, sync, add/remove
```

## Build Commands

```bash
npm run build           # Build all 5 entries (dev, with sourcemaps)
npm run build:prod      # Build all 5 entries (production, no sourcemaps)
npm run watch           # Watch frontend bundle (recommended)
npm run watch:editor    # Watch editor bundle
npm run watch:control   # Watch focal-point-control
npm run watch:setups    # Watch saved-setups-control
npm run watch:product-select # Watch product-select-control
npm run watch:all       # Watch all 5 bundles (resource intensive)
```

## Data Flow Diagrams

### 1. Initial Widget Load (Editor)

```
Elementor loads page
  ↓
elementor/frontend/init event (in editor preview iframe)
  ↓
main-editor.js → initializeEditorHooks()
  ├─→ registerFrontendHooks() - registers all widget types (mode: 'edit')
  ├─→ registerEditorHooks() - sets up live sync, conditional renderOnChange
  └─→ setupEditorObserver() - watches for new widgets
  ↓
frontend/element_ready/{widget-type}.default
  ↓
createWidgetInitializer(widgetType, 'edit')
  ↓
Extract widgetId from data-widget-id
  ↓
Find wrapper (.{widget-type}-wrapper)
  ↓
Find React root (.{widget-type}-react-root)
  ↓
Parse settings from hidden input OR modelGetter
  ↓
widgetManager.init(widgetType, widgetId, rootElement, settings, 'edit')
  ↓
Create React root with WidgetComponent from registry
  ↓
Widget renders with initial settings (mode: 'edit')
```

### 1b. Initial Widget Load (Frontend)

```
Published page loads
  ↓
elementor/frontend/init event
  ↓
main-frontend.js → registerFrontendHooks()
  ↓
frontend/element_ready/{widget-type}.default
  ↓
createWidgetInitializer(widgetType, 'display')
  ↓
Extract widgetId, wrapper, rootElement
  ↓
Parse settings from hidden input
  ↓
widgetManager.init(widgetType, widgetId, rootElement, settings, 'display')
  ↓
Create React root with WidgetComponent
  ↓
Widget renders (display mode - no drag/resize)
```

### 2. Settings Change in Editor Panel

```
User changes setting in Elementor panel
  ↓
model.get('settings').on('change') listener fires
  ↓
getSettingsFromModel() extracts new values
  ↓
widgetManager.updateInstance(widgetType, widgetId, newSettings)
  ↓
instance.updateSettings(newSettings)
  ↓
view.renderUI() → Regenerates CSS from selectors (no DOM destruction)
  ↓
React setState merges new settings
  ↓
Widget re-renders with updated settings (NO DOM remount)
```

### 3. Custom Layout Save (Drag/Resize)

```
User drags/resizes grid item in editor
  ↓
GridLayout onLayoutChange callback
  ↓
Widget component handleLayoutChange()
  ↓
updateElementorSetting('products-layout', widgetId, 'custom_layout', JSON.stringify(layout))
  ↓
widgetManager.updateModelSetting(widgetType, widgetId, settingName, value)
  ↓
$e.run('document/elements/settings', { container, settings })
  ↓
fallback: model.setSetting('custom_layout', value)
  ↓
Elementor enables Update/Publish button
  ↓
User clicks Update → custom_layout saved to database
```

### 4. Layout Reset

```
User clicks Reset Layout button
  ↓
triggerLayoutReset() in component
  ↓
elementor.channels.editor.trigger('mosaic:resetLayout')
  ↓
Elementor hook listener in editor-hooks.js
  ↓
Check if current widget in panel
  ↓
model.setSetting('custom_layout', '')
  ↓
Settings change triggers update flow (see #2)
  ↓
Widget re-renders with predefined layout
```

### 5. Widget Added via Drag & Drop

```
User drags widget from panel to page
  ↓
MutationObserver (in editor-hooks.js) detects new DOM node
  ↓
Check if node contains widget wrapper for registered types
  ↓
Verify instance not already initialized
  ↓
createWidgetInitializer(widgetType, 'edit')
  ↓
Initialize new instance (see #1)
```

### 6. WooCommerce Product Fetch

```
Widget component mounts (useEffect)
  ↓
Extract query params from widgetData
  ↓
Fetch /wp-json/wc/store/products
  ├─→ Include query params (category, per_page, orderby, etc.)
  └─→ Add nonce header (window.MPL4E.storeApiNonce)
  ↓
WooCommerce Store API processes request
  ↓
Return product data (JSON)
  ↓
Component setState with products
  ↓
Render product grid
```

### 7. Add to Cart

```
User clicks Add to Cart button
  ↓
AddToCartButton component
  ↓
POST /wp-json/wc/store/cart/add-item
  ├─→ product_id: productId
  ├─→ quantity: 1
  └─→ Nonce header
  ↓
WooCommerce adds to cart
  ↓
Success response
  ↓
Show confirmation notification
  ↓
Update cart count (if present in DOM)
```

### 8. Saved Setup Load

```
User selects a saved setup from dropdown
  ↓
apiFetch GET /wp/v2/settings → mpl4e_products_layout_setups
  ↓
Find matching setup by name
  ↓
applySettingsToModel(setup.settings, model)
  ↓
elementor.channels.editor.trigger('mosaic:applySetup', { widgetId, settings })
  ↓
editor-hooks.js handler in preview iframe
  ↓
Disable renderOnChange + change:mpl4e_layout listener
  ↓
settingsModel.set(setupSettings) ← atomic batch (single Backbone change)
  ↓
Restore renderOnChange + layout listener
  ↓
widgetManager.updateInstance() → React setState
  ↓
view.renderUI() → CSS regeneration from selectors
  ↓
saver.setFlagEditorChange(true) → Enable Update button
```

### 9. Saved Setup Save

```
User types setup name + clicks Save
  ↓
captureSettingsFromModel(model)
  ↓
Capture keys from manifest:
  ├─→ LAYOUT_KEYS (layout, custom_layout, columns, etc.)
  ├─→ STYLE_KEYS (gap, padding, border_radius, etc.)
  ├─→ SELECTOR_STYLE_KEYS (colors, backgrounds, typography)
  ├─→ GROUP_CONTROL_PREFIXES expanded with _type, _color, _width...
  └─→ RESPONSIVE_KEYS with _tablet, _mobile variants
  ↓
apiFetch POST /wp/v2/settings
  ├─→ { mpl4e_products_layout_setups: [...existing, { name, settings }] }
  └─→ Persisted in wp_options table
  ↓
Show toast notification
```

## Key Methods Reference

### Widget Manager
```javascript
widgetManager.init(widgetType, widgetId, rootElement, settings)
widgetManager.updateInstance(widgetType, widgetId, newSettings)
widgetManager.updateModelSetting(widgetType, widgetId, settingName, value)
widgetManager.getModel(widgetType, widgetId)
```

### Elementor Utils (for components)
```javascript
updateElementorSetting(widgetType, widgetId, settingName, value)
isElementorEditor()
getActiveBreakpointNames()  // ['desktop', 'tablet', 'mobile']
getElementorGridBreakpoints()
injectBreakpointStylesheet()  // Inject responsive CSS
```

### Event System
```javascript
// In React component (triggers)
elementor.channels.editor.trigger('mosaic:resetLayout')
elementor.channels.editor.trigger('mosaic:addItem')
elementor.channels.editor.trigger('mosaic:applySetup', { widgetId, settings })

// In editor-hooks.js listener (handlers)
elementor.channels.editor.on('mosaic:resetLayout', () => { /* ... */ })
elementor.channels.editor.on('mosaic:addItem', () => { /* ... */ })
elementor.channels.editor.on('mosaic:applySetup', (data) => { /* batch apply */ })
```

### Registry
```javascript
getRegisteredWidgets()           // ['products-layout', 'categories-layout', ...]
isWidgetRegistered(widgetType)   // true/false
getWidgetConfig(widgetType)      // { component, settingsMapper }
```

## Instance Lifecycle

```
1. MOUNT
   widgetManager.init() → Create React root → Store in instances[key] → Render
   
2. UPDATE (Settings Change - No Remount)
   model.on('change') → updateInstance() → setState → renderUI() (CSS) → Re-render (same root)
   
3. UPDATE (Core/Advanced Change - Allow Remount)
   Conditional renderOnChange detects non-widget change → Original renderOnChange called
   
4. UPDATE (DOM Replaced by Elementor)
   init() detects rootElement.isConnected === false → unmount old → create new root
   
5. UNMOUNT (Page Leave)
   Browser garbage collection (React cleans up automatically)
```

## Script Loading

### Frontend (Published Pages)
```
wp_enqueue_scripts hook
  ├─→ Check: NOT preview mode
  ├─→ Check: Page built with Elementor
  └─→ Enqueue:
      ├─→ react (WordPress)
      ├─→ react-dom (WordPress)
      ├─→ main-frontend.js (~150KB)
      └─→ main-frontend.css
```

### Editor (Elementor Editor Only)
```
elementor/preview/enqueue_scripts hook
  └─→ Enqueue:
      ├─→ react (WordPress)
      ├─→ react-dom (WordPress)
      ├─→ main-editor.js (~300KB)
      └─→ main-editor.css
```

### Custom Controls (Editor Panel)
```
elementor/editor/after_enqueue_scripts hook
  └─→ Enqueue:
      ├─→ react (WordPress)
      ├─→ react-dom (WordPress)
      ├─→ focal-point-control.js
      └─→ saved-setups-control.js
            ├─→ deps: wp-api-fetch, wp-i18n
            └─→ Persistence: wp_options via /wp/v2/settings
```

## Common Patterns

### In Widget Components
```javascript
// Import utilities
import { updateElementorSetting, isElementorEditor } from '../../core/elementor-utils';

// Component structure
const MyWidget = ({ widgetData, widgetId, mode }) => {
    // Extract settings (with responsive support)
    const titleSize = widgetData?.title_size || { desktop: '24px', tablet: '20px', mobile: '18px' };
    const showRating = widgetData?.show_rating || true;  // boolean converted from 'yes'/'no'
    
    // Check if in editor
    const inEditor = mode === 'edit' || isElementorEditor();
    
    // Update Elementor setting (editor only)
    const handleLayoutChange = (newLayout) => {
        if (inEditor) {
            updateElementorSetting('products-layout', widgetId, 'custom_layout', JSON.stringify(newLayout));
        }
    };
    
    // Fetch products (both modes)
    useEffect(() => {
        fetch('/wp-json/wc/store/products?' + new URLSearchParams({
            per_page: widgetData?.per_page || 12,
            category: widgetData?.category_ids || '',
        }), {
            headers: {
                'Nonce': window.MPL4E?.storeApiNonce || ''
            }
        })
        .then(res => res.json())
        .then(data => setProducts(data));
    }, [widgetData]);
    
    return <div>{/* ... */}</div>;
};
```

### Adding New Widget
```javascript
// 1. Settings schema (src/widgets/new-widget/react-settings.json)
{
    "title_size": {
        "type": "responsive",
        "default": "24px",
        "tablet_default": "20px",
        "mobile_default": "18px"
    },
    "show_excerpt": {
        "type": "boolean",
        "default": true
    },
    "items_per_page": {
        "type": "number",
        "default": 12
    }
}

// 2. Component (src/widgets/new-widget/new-widget.jsx)
import React from 'react';
import './new-widget.scss';

const NewWidget = ({ widgetData, widgetId, mode }) => {
    const titleSize = widgetData?.title_size || {};
    const showExcerpt = widgetData?.show_excerpt;
    
    return (
        <div className="new-widget-container">
            {/* Widget content */}
        </div>
    );
};
export default NewWidget;

// 3. Register in widget-registry.js (no separate mapper function needed)
import NewWidget from '../widgets/new-widget/new-widget';
import newWidgetSettings from '../widgets/new-widget/react-settings.json';
import { createSettingsMapper } from '../widgets/settings-mappers';

export const WIDGET_REGISTRY = {
    'products-layout': { /* existing */ },
    'new-widget': {
        component: NewWidget,
        settingsMapper: createSettingsMapper(newWidgetSettings)
    }
};

// 4. PHP Widget (widgets/new-widget.php) — use WidgetHelpers trait
class NewWidget extends \Elementor\Widget_Base {
    use WidgetHelpers;
    public function get_name() {
        return 'new-widget';  // MUST match registry key
    }
    // register_controls() here...
    // render() and content_template() provided by trait
}

// 5. Register in main plugin (mosaic-product-layouts-for-elementor.php)
public function init_widgets( $widgets_manager ) {
    require_once __DIR__ . '/widgets/new-widget.php';
    $widgets_manager->register( new NewWidget() );
}
```

## File Paths Quick Reference

```
src/
├── main-frontend.jsx              # Frontend entry
├── main-editor.jsx                # Editor entry
├── globalStyles.scss              # Global styles
├── core/
│   ├── widget-registry.js
│   ├── widget-manager.jsx
│   ├── widget-initializer.js
│   ├── frontend-hooks.js         # Minimal frontend
│   ├── editor-hooks.js           # Full editor
│   └── elementor-utils.js
├── widgets/
│   ├── settings-mappers.js       # createSettingsMapper() factory
│   ├── products-layout/
│   │   ├── products-layout.jsx
│   │   ├── products-layout.scss
│   │   └── react-settings.json   # Settings source of truth
│   ├── categories-layout/
│   │   ├── categories-layout.jsx
│   │   ├── categories-layout.scss
│   │   └── react-settings.json
│   └── single-product-layout/
│       ├── single-product-layout.jsx
│       ├── single-product-layout.scss
│       ├── react-settings.json
│       └── utils/single-product-layouts.json
├── shared/
│   ├── layouts.json
│   ├── components/
│   │   ├── GridLayout.jsx
│   │   ├── ProductImage.jsx
│   │   ├── RatingStars.jsx
│   │   ├── AddToCartButton.jsx
│   │   ├── ZIndexControls.jsx
│   │   └── utils/events.js
│   ├── utils/
│   │   ├── hooks.js              # useCssVariables(), useGridSettings()
│   │   ├── addItem.js
│   │   ├── alignmentUtils.js
│   │   ├── dataLoading.js
│   │   ├── layoutUtils.js
│   │   ├── layoutEditing.js
│   │   ├── elementOrdering.js
│   │   ├── LRUCache.js
│   │   ├── fetchHelpers.js
│   │   ├── productUtils.js
│   │   ├── transformationUtils.js
│   │   ├── visibleLayout.js
│   │   └── generalUtils.js
│   └── assets/
│       ├── _gridLayout.scss
│       ├── _itemControls.scss
│       ├── _productElements.scss
│       └── (shared partials)
└── controls/
    ├── focal-point-control.jsx
    ├── FocalPointControlView.jsx
    ├── focal-point-control.scss
    ├── product-select-control.jsx
    ├── ProductSelectView.jsx
    ├── product-select-control.scss
    ├── saved-setups-control.jsx
    └── saved-setups-control.scss

widgets/                          # PHP widget classes
├── products-layout.php
├── categories-layout.php
└── single-product-layout.php

controls/                         # PHP custom controls
├── focal-point.php
├── product-select.php
├── element-sorting.php
└── saved-setups.php

includes/
├── trait-widget-helpers.php      # Shared render(), content_template()
└── class-rest-api.php

assets/                           # Built (Vite output)
├── js/main-frontend.js
├── css/main-frontend.css
└── admin/
    ├── js/
    │   ├── main-editor.js
    │   ├── focal-point-control.js
    │   ├── product-select-control.js
    │   └── saved-setups-control.js
    └── css/
```

## Debugging Tips

**Frontend Issues:**
```javascript
// Check if manager exists
console.log(window.MosaicLayoutsReact);

// Check instances
console.log(window.MosaicLayoutsReact.instances);

// Check WooCommerce config
console.log(window.MPL4E);
```

**Editor Issues:**
```javascript
// Check if in editor (in preview iframe console)
console.log(window.elementor !== undefined);
console.log(window.elementorFrontend !== undefined);

// Check model getters
console.log(window.MosaicLayoutsReact.modelGetters);

// Check models
console.log(window.MosaicLayoutsReact.models);

// Trigger events manually
elementor.channels.editor.trigger('mosaic:resetLayout');
elementor.channels.editor.trigger('mosaic:addItem');
elementor.channels.editor.trigger('mosaic:applySetup', { widgetId: '12345', settings: {} });
```

**Saved Setups Issues:**
```javascript
// Check saved setups in database (browser console or WP CLI)
wp.apiFetch({ path: '/wp/v2/settings' }).then(s => console.log(s.mpl4e_products_layout_setups));

// Check current model settings (preview iframe console)
const model = window.MosaicLayoutsReact.models['products-layout-WIDGET_ID'];
console.log(model.get('settings').attributes);

// Verify WP option directly (WP CLI)
// wp option get mpl4e_products_layout_setups --format=json
```

**Build Issues:**
```bash
# Clear and rebuild
rm -rf assets/js assets/css assets/admin
npm run build

# Check for errors
npm run lint
```
