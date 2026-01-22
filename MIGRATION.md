# Migration Guide: Single Widget → Multi-Widget Architecture

## Changes Summary

The codebase has been refactored from a single-widget system to a multi-widget architecture that can handle multiple widget types (products-layout, categories-layout, single-product-layout, etc.).

## What Changed

### Global Variable
**Before:**
```javascript
window.ProductsLayoutReact
```

**After:**
```javascript
window.MosaicLayoutsReact
```

### Instance Keys
**Before:**
```javascript
instances[widgetId]  // Just widget ID
```

**After:**
```javascript
instances[`${widgetType}_${widgetId}`]  // Compound key
```

### Component Integration

**Before (in products-layout.jsx):**
```javascript
const model = window.ProductsLayoutReact?.models?.[widgetId];
model.setSetting('custom_layout', value);
```

**After (in products-layout.jsx):**
```javascript
import { updateElementorSetting } from '../../core/elementor-utils';

updateElementorSetting('products-layout', widgetId, 'custom_layout', value);
```

## File Changes

### New Files Created
- `src/core/widget-registry.js` - Widget type registry
- `src/core/widget-manager.jsx` - Generic widget manager
- `src/core/widget-initializer.js` - Widget initialization factory
- `src/core/elementor-hooks.js` - Elementor hooks registration
- `src/core/elementor-utils.js` - Helper utilities for components
- `src/widgets/settings-mappers.js` - Settings extraction functions

### Modified Files
- `src/main.jsx` - Simplified to orchestration only
- `src/widgets/products-layout/products-layout.jsx` - Uses new utils

### Removed Logic
All the following were extracted from `main.jsx` into separate modules:
- Widget instance management → `widget-manager.jsx`
- Initialization logic → `widget-initializer.js`
- Elementor hooks → `elementor-hooks.js`
- Settings extraction → `settings-mappers.js`

## Breaking Changes

### For Component Developers

If you have custom code that directly accessed the global registry, update it:

**Old:**
```javascript
window.ProductsLayoutReact.models[widgetId]
window.ProductsLayoutReact.instances[widgetId]
```

**New:**
```javascript
import { getElementorModel } from '../../core/elementor-utils';
getElementorModel('products-layout', widgetId);

// Or access directly:
window.MosaicLayoutsReact.models['products-layout_' + widgetId]
window.MosaicLayoutsReact.instances['products-layout_' + widgetId]
```

### For Plugin Developers

No changes required to PHP widget files or plugin registration. The widget name and hook pattern remain the same.

## Compatibility

### ✅ Preserved Functionality
- Custom layout saving after drag/resize
- Layout reset to predefined layouts
- Live settings sync (Elementor ↔ React)
- Editor mode detection
- Frontend rendering
- Product caching (LRU cache in editor, simple object in frontend)

### ✅ Backward Compatible
- Existing `products-layout` widgets work without changes
- Same Elementor hook patterns (`frontend/element_ready/products-layout.default`)
- Same PHP widget structure

## Testing Checklist

- [ ] Products layout widget loads in editor
- [ ] Drag grid items and verify custom layout saves
- [ ] Resize grid items and verify custom layout saves
- [ ] Change Elementor settings and verify live update
- [ ] Reset layout button clears custom layout
- [ ] Widget works on frontend (non-editor)
- [ ] Multiple instances of same widget work
- [ ] Widget persists after page refresh in editor

## Next Steps

To add a new widget (e.g., categories-layout):

1. Create component file: `src/widgets/categories-layout/categories-layout.jsx`
2. Add settings mapper: `mapCategoriesLayoutSettings()` in `settings-mappers.js`
3. Register in `widget-registry.js`:
   ```javascript
   'categories-layout': {
       component: CategoriesLayoutWidget,
       settingsMapper: mapCategoriesLayoutSettings
   }
   ```
4. Create PHP widget: `widgets/categories-layout.php`
5. Register in plugin: Add to `init_widgets()` method

No changes needed to core modules - they handle all widget types automatically.
