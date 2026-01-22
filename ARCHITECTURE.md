# Multi-Widget Architecture

## Overview

The codebase has been refactored to support multiple widget types using a shared generic architecture. This allows easy addition of new widgets (categories-layout, single-product-layout, etc.) without code duplication.

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

### 4. Elementor Hooks (`src/core/elementor-hooks.js`)
Registers all Elementor frontend and editor hooks.

**Three main functions:**
- `registerFrontendHooks()` - Widget initialization on frontend
- `registerEditorHooks()` - Live settings sync, prevent DOM re-renders
- `setupEditorObserver()` - MutationObserver for drag & drop in editor

### 5. Settings Mappers (`src/widgets/settings-mappers.js`)
Extract and format widget settings from Elementor models.

Each widget has its own mapper function:
```javascript
export const mapProductsLayoutSettings = (model) => { /* ... */ }
export const mapCategoriesLayoutSettings = (model) => { /* ... */ }
```

### 6. Elementor Utils (`src/core/elementor-utils.js`)
Helper functions for React components to interact with Elementor.

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
  → JSON in hidden input 
  → React reads via initWidget() 
  → Widget component receives props
```

### Custom Layout: React → Elementor
```
User drags/resizes grid item 
  → onLayoutChange callback 
  → updateElementorSetting() 
  → widgetManager.updateModelSetting() 
  → Elementor model.setSetting() 
  → Auto-save triggered
```

## File Structure

```
src/
├── main.jsx                          # Entry point - orchestrates all modules
├── core/
│   ├── widget-registry.js           # Widget type registry
│   ├── widget-manager.jsx           # Generic widget instance manager
│   ├── widget-initializer.js        # Widget init factory
│   ├── elementor-hooks.js           # Elementor integration
│   └── elementor-utils.js           # Helper utilities for components
├── widgets/
│   ├── settings-mappers.js          # Settings extractors for all widgets
│   ├── products-layout/
│   │   ├── products-layout.jsx      # Products widget component
│   │   └── products-layout.scss
│   ├── categories-layout/           # Future widget
│   └── single-product-layout/       # Future widget
├── components/
│   └── GridLayout.jsx               # Shared grid component
└── shared/
    └── components/
        └── ProductImage.jsx         # Shared components
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

1. **Create React component** (`src/widgets/new-widget/new-widget.jsx`)
2. **Create settings mapper** (add to `src/widgets/settings-mappers.js`)
3. **Register in registry** (add to `src/core/widget-registry.js`)
4. **Create PHP widget** (`widgets/new-widget.php`)
5. **Register in main plugin** (`mosaic-product-layouts-for-elementor.php`)

**That's it!** All initialization, hooks, and lifecycle management is handled automatically.

## Global Variables

- `window.MosaicLayoutsReact` - Widget manager singleton
  - `.instances` - All mounted widget instances
  - `.modelGetters` - Functions to get current Elementor settings
  - `.models` - Elementor model references for two-way updates

## Important Notes

- **Widget type must match PHP `get_name()`**: 'products-layout', 'categories-layout', etc.
- **Compound instance keys**: `${widgetType}_${widgetId}` prevents collisions
- **No DOM re-renders**: `renderOnChange` filter returns `false` for our widgets
- **MutationObserver**: Detects widgets added via drag & drop in Elementor editor
