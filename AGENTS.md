# Mosaic Contents for Elementor - Agent and Development Guide

Welcome to the Mosaic Contents for Elementor plugin development environment.

## Quick Start

**Essential Commands:**
```bash
# Build production bundle
npm run build

# Watch for changes during development
npm run watch

# Watch specific bundles
npm run watch:editor
npm run watch:control
npm run watch:all
```

## Project Structure

```
mosaic-contents-for-elementor/
├── src/
│   ├── main-frontend.jsx    # Frontend React entry point
│   ├── main-editor.jsx      # Editor React entry point
│   ├── widgets/             # Widget components with settings mappers
│   ├── controls/            # Custom Elementor controls
│   └── core/                # Core utilities (hooks, registry, etc.)
├── widgets/                 # PHP widget classes for Elementor
├── assets/                  # Built output (js/css)
└── docs/                    # Architecture and reference docs
```

## Development Workflow

### Adding a New Widget

1. **Create PHP Widget** (`widgets/new-widget/new-widget.php`):
   - Use `WidgetHelpers` trait for base functionality
   - Register using `micemade-widgets` category
   - Settings defined in `react-settings.json`

2. **Create React Component** (`src/widgets/new-widget/new-widget.jsx`):
   - Accept `widgetData`, `widgetId`, `mode` props
   - Use `updateElementorSetting()` for editor sync
   - Fetch data via REST API
   - Conditionally use editor-specific utilities

3. **Register Settings** (`src/widgets/new-widget/react-settings.json`):
   - JSON schema drives PHP controls, editor template, and React mapping
   - Supports responsive settings, booleans, numbers, etc.

4. **Register in Widget Registry** (`src/core/widget-registry.js`):
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

5. **Update PHP Registration** (`mosaic-contents-for-elementor.php`):
   ```php
   require_once __DIR__ . '/widgets/new-widget.php';
   $widgets_manager->register( new NewWidget() );
   ```

6. **Add Editor Hook** (`src/main-editor.jsx`):
   ```javascript
   elementorFrontend.hooks.addAction(
       'frontend/element_ready/new-widget.default',
       initWidget
   );
   ```

## Architecture Overview

### Dual-Bundle Strategy

- **Frontend (~150KB)**: Display-only widgets for published pages
- **Editor (~300KB)**: Full-featured widgets with drag/resize and sync

This reduces frontend payload by ~50%.

### Data Flow

1. **Initial Load**: Elementor registers hooks → WidgetInitializer creates React root
2. **Settings Change**: Backbone model change → updateInstance → React re-render (no mount)
3. **Layout Save**: React → updateElementorSetting → Elementor model → Database on Update
4. **Widget Addition**: MutationObserver detects DOM node → Auto-initialize

### Key Global Objects

```javascript
// React Widget Manager
window.MosaicLayoutsReact = {
    instances: { /* widget instances */ },
    modelGetters: { /* getters for models */ },
    models: { /* Elementor Backbone models */ },
    init, updateInstance, updateModelSetting, getModel
};

// PHP Data Bridge
window.MC4E = {
    restApiNonce, ajaxUrl, placeholderImg
};
```

### Common Patterns

**Editors Detection:**
```javascript
const inEditor = mode === 'edit' || isElementorEditor();
if (inEditor) {
    updateElementorSetting(widgetType, widgetId, 'settingName', value);
}
```

**REST API Fetch:**
```javascript
const response = await fetch('/wp-json/wp/v2/posts?' + params, {
    headers: {'X-WP-Nonce': window.MC4E.restApiNonce}
});
```

**Elementor Events:**
```javascript
// Trigger events
elementor.channels.editor.trigger('mosaic:resetLayout');
elementor.channels.editor.trigger('mosaic:addItem');

// Listen events (in editor preview iframe)
elementor.channels.editor.on('mosaic:resetLayout', callback);
```

## Reference Documents

See `docs/` directory:
- **ARCHITECTURE.md**: Complete technical architecture
- **IMPLEMENTATION_SUMMARY.md**: What was built and why
- **VISUAL_ARCHITECTURE.md**: Visual diagrams
- **QUICK_REFERENCE.md**: Command and API reference

## Useful Skills

### Elementor Integration Skill
- Create/modify custom Elementor extensions
- WooCommerce widget integration
- React integration with Elementor controls
- WordPress REST API integration
- Site deployment workflows

### WP Interactivity Skill
- WordPress interactivity API patterns
- Store API integration
- PHP functions and directives

## Code Standards

- **PHP**: PSR-12, WordPress coding standards for Elementor
- **JS/TS**: Prettier, ESLint
- **React**: Functional components, hooks, no HMR in editor

## Debugging

**Frontend Console:**
```javascript
console.log(window.MosaicLayoutsReact);  // Check manager
console.log(window.MosaicLayoutsReact.instances);  // Check instances
```

**Editor Console (preview iframe):**
```javascript
console.log(window.elementor);  // Check editor API
console.log(window.MosaicLayoutsReact.models);  // Check models
elementor.channels.editor.trigger('mosaic:resetLayout');  // Trigger test event
```

**Build Verification:**
```bash
npm run build          # Dev build with sourcemaps
npm run build:prod     # Production build without sourcemaps
npm run lint           # Run linter
```

## Important Notes

- **No HMR in Editor**: Elementor iframe prevents hot reload. Use manual refresh after `npm run watch`
- **Content Template = Editor Only**: `render()` handles frontend; keep it minimal
- **Widget Category**: All widgets register under `micemade-widgets`
- **WC Store API**: Use `/wp-json/wc/store/v1/` for public product data (no auth needed)
- **Settings Source of Truth**: One `react-settings.json` file drives everything

## Environment

- **Local Site**: http://micemade-dev.local
- **WordPress**: Local by Flywheel
- **Page Builder**: Elementor
- **E-commerce**: WooCommerce with custom integrations
- **Alternative**: Docker with `docker-compose up -d`

## Questions?

Check the reference docs in `docs/` or see additional skills in `.github/skills/`
