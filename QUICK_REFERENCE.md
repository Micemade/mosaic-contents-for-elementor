# Quick Reference: Widget System Flow

## Component Hierarchy

```
main.jsx (orchestrator)
  ├─→ widget-registry.js (widget definitions)
  ├─→ elementor-hooks.js (Elementor integration)
  │     ├─→ widget-initializer.js (init factory)
  │     │     └─→ widget-manager.jsx (instance manager)
  │     └─→ settings-mappers.js (extract settings)
  └─→ widget-manager.jsx (global singleton)
        └─→ Renders widget components from registry
```

## Data Flow Diagrams

### 1. Initial Widget Load (Editor)

```
Elementor loads page
  ↓
elementor/frontend/init event
  ↓
registerFrontendHooks() - registers all widget types
  ↓
registerEditorHooks() - sets up live sync
  ↓
setupEditorObserver() - watches for new widgets
  ↓
frontend/element_ready/{widget-type}.default
  ↓
createWidgetInitializer(widgetType)
  ↓
Extract widgetId, wrapper, rootElement
  ↓
Parse settings from hidden input OR modelGetter
  ↓
widgetManager.init(widgetType, widgetId, rootElement, settings)
  ↓
Create React root with WidgetComponent from registry
  ↓
Widget renders with initial settings
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
model.setSetting('custom_layout', value)
  ↓
elementor.saver.setFlagEditorChange(true)
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
Elementor hook listener in elementor-hooks.js
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
MutationObserver detects new DOM node
  ↓
Check if node contains widget wrapper
  ↓
createWidgetInitializer(widgetType)
  ↓
Initialize new instance (see #1)
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
triggerLayoutReset()
isElementorEditor()
getElementorModel(widgetType, widgetId)
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
   widgetManager.init() → Create React root → Render component
   
2. UPDATE (Settings Change)
   updateInstance() → setState → Re-render (same root)
   
3. UPDATE (DOM Replaced)
   init() detects disconnected → unmount old → create new root
   
4. UNMOUNT (Page Leave)
   Browser garbage collection
```

## Common Patterns

### In Widget Components
```javascript
// Import utilities
import { updateElementorSetting } from '../../core/elementor-utils';

// Update Elementor setting
const handleLayoutChange = (newLayout) => {
    updateElementorSetting('products-layout', widgetId, 'custom_layout', JSON.stringify(newLayout));
};

// Component structure
const MyWidget = ({ widgetData, widgetId }) => {
    // Extract settings
    const setting1 = widgetData?.setting1 || 'default';
    
    // Use in JSX
    return <div>{/* ... */}</div>;
};
```

### Adding New Widget
```javascript
// 1. Component (src/widgets/new-widget/new-widget.jsx)
const NewWidget = ({ widgetData, widgetId }) => { /* ... */ };
export default NewWidget;

// 2. Settings mapper (src/widgets/settings-mappers.js)
export const mapNewWidgetSettings = (model) => {
    const settings = model.get('settings');
    return {
        setting1: settings.get('setting1'),
        // ...
    };
};

// 3. Registry (src/core/widget-registry.js)
import NewWidget from '../widgets/new-widget/new-widget';
import { mapNewWidgetSettings } from '../widgets/settings-mappers';

export const WIDGET_REGISTRY = {
    'new-widget': {
        component: NewWidget,
        settingsMapper: mapNewWidgetSettings
    }
};
```
