---
name: elementor
description: This skill should be used when the user asks to "integrate React compnent with ELementor", "generate Elementor widget or widgets", "integrate WooCommerce with Elementor".
version: 1.0.0
---

# WordPress Elementor Integration Skill

Use this skill when working with Elementor page builder, WooCommerce integration, or React-based widget development.

## When to Use This Skill

Invoke this skill when the user:

- Wants to create or modify custom extension for Elementor
- Asks about WooCommerce integration for creating widgets or custom integrations
- Requests React integration with Elementor controls, rendering, and live editing
- Wants to implement React components for rendering output in Elementor
- Needs WordPress REST API integration with the Elementor
- Needs deeper technical insight of creating Elementor related code

## Architecture: PHP → React Widget Pattern

This plugin renders Elementor widgets using **React** instead of traditional PHP templates:

1. **PHP Widget** (`widgets/*.php`) → Defines Elementor controls and outputs a DOM wrapper via `content_template()`
2. **React Component** (`src/widgets/*/*.jsx`) → Mounts into the wrapper and handles all rendering
3. **Vite Build** → Compiles `src/main.jsx` → `assets/js/main.js` + `assets/css/main.css`

### Data Flow: Elementor Settings → React

Settings pass through a hidden input pattern to avoid full re-renders:

```
Elementor controls → content_template() → JSON in hidden input → React reads via initWidget()
```

**PHP template pattern** (see `widgets/content-layout.php`):
```php
protected function content_template() {
    ?>
    <# const data={ title: settings.widget_title }; const jsonData=JSON.stringify(data); #>
    <div class="content-layout-wrapper" data-widget-id="{{ view.model.id }}">
        <input type="hidden" class="elementor-settings-data" value="{{ jsonData }}" />
        <div class="content-layout-react-root"></div>
    </div>
    <?php
}
```

### React State Management

The global `window.ContentLayoutReact` registry in `src/main.jsx` manages widget instances to:
- Prevent duplicate React roots on Elementor re-renders
- Enable external settings updates without remounting

```javascript
window.ContentLayoutReact = {
    instances: {},
    init: function(widgetId, rootElement, initialSettings) { /* ... */ },
    updateInstance: function(widgetId, newSettings) { /* ... */ }
};
```

## Adding a New Widget

### Step 1: Create PHP Widget

Create `widgets/new-widget.php`:

```php
<?php
namespace Micemade\MosaicProductLayoutsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

class NewWidget extends Widget_Base {
    public function get_name() { return 'new-widget'; }  // kebab-case
    public function get_title() { return __('New Widget', 'mosaic-product-layouts-for-elementor'); }
    public function get_categories() { return ['micemade-widgets']; }

    public function register_controls() {
        $this->start_controls_section('content_section', [
            'label' => __('Content', 'mosaic-product-layouts-for-elementor'),
            'tab' => Controls_Manager::TAB_CONTENT,
        ]);
        // Add controls here
        $this->end_controls_section();
    }

    protected function render() {
        // Empty - React handles rendering
    }

    protected function content_template() {
        ?>
        <# const data = { /* map settings */ }; #>
        <div class="new-widget-wrapper" data-widget-id="{{ view.model.id }}">
            <input type="hidden" class="elementor-settings-data" value="{{ JSON.stringify(data) }}" />
            <div class="new-widget-react-root"></div>
        </div>
        <?php
    }
}
```

### Step 2: Create React Component

Create `src/widgets/new-widget/new-widget.jsx`:

```jsx
import React from 'react';

const NewWidget = ({ widgetData = {} }) => {
    return <div>{/* Widget content */}</div>;
};

export default NewWidget;
```

### Step 3: Register in Main Plugin

In `mosaic-product-layouts-for-elementor.php`, add to `init_widgets()`:

```php
require_once __DIR__ . '/widgets/new-widget.php';
$widgets_manager->register(new NewWidget());
```

### Step 4: Add Initialization Hook

In `src/main.jsx`, add the Elementor hook:

```javascript
elementorFrontend.hooks.addAction(
    'frontend/element_ready/new-widget.default',  // matches get_name()
    initWidget
);
```

## WordPress REST API Integration

React components fetch data via WordPress REST API:

```javascript
// Fetch posts
const response = await fetch('/wp-json/wp/v2/posts?_fields=id,title,excerpt&per_page=10');

// Fetch WooCommerce products via Store API (public, no auth)
const products = await fetch('/wp-json/wc/store/v1/products?per_page=12&_fields=id,name,price_html,images,permalink');
```

## Important Caveats

- **No HMR in editor**: Elementor's iframe prevents hot module replacement. Use `npm run watch` + manual refresh
- **content_template() is for editor only**: The `render()` method handles frontend; keep it minimal since React takes over
- **Widget category**: All widgets register under `micemade-widgets` category
- **MutationObserver**: Used in `src/main.jsx` to detect DOM changes in Elementor preview iframe
- **WC Store API vs WC REST API**: Use Store API (`/wc/store/v1/`) for public product data (no auth needed)

## WordPress Setup

### Current Development Environment

- **Local Development Site**: `http://micemade-dev.local`
- **Local Development Server**: Local by Flywheel
- **Docker Alternative**: `docker-compose up -d` → `http://localhost:8000`
- **Page Builder**: Elementor
- **E-commerce**: WooCommerce with custom integrations

## References

See `references/` directory for:

- [WordPress REST API](references/wordpress-rest-api.md)
- [Elementor Widget Development](references/elementor-widgets.md)
- [React Integration Patterns](references/react-integration.md)
- [WooCommerce API](references/woocommerce-api.md)
- [Mosaic Product Layouts Patterns](references/mosaic-product-layouts.md) - Reference implementation for WC Store API fetching
