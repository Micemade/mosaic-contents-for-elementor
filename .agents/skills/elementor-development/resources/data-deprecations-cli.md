# Data Structure, Deprecations & CLI

Detailed reference for Elementor JSON data format, deprecation lifecycle, and WP-CLI commands.
Parent reference: [Elementor Development SKILL.md](../SKILL.md)

---

## 5. Data Structure

### JSON Document Format

```json
{
    "title": "Page Title",
    "type": "page",
    "version": "0.4",
    "page_settings": {},
    "content": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Template title |
| `type` | string | `page`, `post`, `header`, `footer`, `popup`, `error-404` |
| `version` | string | Data structure version (`0.4` is current) |
| `page_settings` | object | Page-level settings (background, margin, padding, etc.) |
| `content` | array | Top-level elements |

### Element Structure

```json
{
    "id": "6af611eb",
    "elType": "container",
    "isInner": false,
    "settings": {},
    "elements": [
        {
            "id": "6a637978",
            "elType": "widget",
            "widgetType": "heading",
            "isInner": false,
            "settings": {
                "title": "Hello World",
                "align": "center"
            },
            "elements": []
        }
    ]
}
```

| Field | Type | Values |
|-------|------|--------|
| `elType` | string | `container` or `widget` |
| `widgetType` | string | Widget name (only for `elType: widget`) |
| `isInner` | boolean | Whether the element is nested |
| `settings` | object | Control values; responsive keys use `_tablet`/`_mobile` suffixes |
| `elements` | array | Nested child elements |

### Responsive Settings

Dimension-type controls store responsive variants:

```json
{
    "_padding": { "unit": "px", "top": "100", "right": "0", "bottom": "100", "left": "0", "isLinked": false },
    "_padding_tablet": { "unit": "px", "top": "50", "right": "0", "bottom": "50", "left": "0", "isLinked": false }
}
```

---

## 6. Deprecations

### Deprecation Timeline

| Phase | Duration | Behavior |
|-------|----------|----------|
| Soft deprecation | 4 major versions | Browser console notices only |
| Hard deprecation | 4 major versions | PHP `E_USER_DEPRECATED` errors |
| Deletion | After 8+ major versions | Code removed entirely |

### Key Migrations

```diff
# Underscore prefix methods (removed)
- protected function _register_controls(): void {}
+ protected function register_controls(): void {}
- protected function _render(): void {}
+ protected function render(): void {}
- protected function _content_template(): void {}
+ protected function content_template(): void {}

# Widget registration hook + method
- add_action( 'elementor/widgets/widgets_registered', ... );
+ add_action( 'elementor/widgets/register', ... );
- $widgets_manager->register_widget_type( new Widget() );
+ $widgets_manager->register( new Widget() );

# Control registration hook + method
- add_action( 'elementor/controls/controls_registered', ... );
+ add_action( 'elementor/controls/register', ... );
- $controls_manager->register_control( 'name', new Control() );
+ $controls_manager->register( new Control() );

# Schemes replaced by Globals
- 'scheme' => \Elementor\Core\Schemes\Typography::TYPOGRAPHY_1,
+ 'global' => [ 'default' => \Elementor\Core\Kits\Documents\Tabs\Global_Typography::TYPOGRAPHY_PRIMARY ],

- 'scheme' => [ 'type' => Color::get_type(), 'value' => Color::COLOR_1 ],
+ 'global' => [ 'default' => \Elementor\Core\Kits\Documents\Tabs\Global_Colors::COLOR_PRIMARY ],
```

### Using the Deprecation API in Your Addon

```php
use Elementor\Plugin;

// Deprecated function
Plugin::$instance->modules_manager->get_modules( 'dev-tools' )->deprecation->deprecated_function(
    'old_method()', '3.5.0', 'new_method()'
);

// Deprecated argument
Plugin::instance()->modules_manager->get_modules( 'dev-tools' )->deprecation->deprecated_argument(
    '$id', '3.5.0'
);

// Deprecated action hook
Plugin::$instance->modules_manager->get_modules( 'dev-tools' )->deprecation->do_deprecated_action(
    'elementor/old/action', [ $args ], '3.5.0', 'elementor/new/action'
);

// Deprecated filter hook
Plugin::$instance->modules_manager->get_modules( 'dev-tools' )->deprecation->apply_deprecated_filter(
    'elementor/old/filter', [ $args ], '3.5.0', 'elementor/new/filter'
);
```

---

## 7. CLI Commands

### Quick Reference

| Command | Description |
|---------|-------------|
| `wp elementor system-info` | Display system info (JSON) |
| `wp elementor flush-css [--regenerate] [--network]` | Flush/regenerate CSS files |
| `wp elementor replace-urls <old> <new> [--force]` | Replace URLs in Elementor data |
| `wp elementor update db [--force] [--network]` | Run Elementor DB update |
| `wp elementor-pro update db [--force] [--network]` | Run Elementor Pro DB update |
| `wp elementor library sync [--force] [--network]` | Sync template library |
| `wp elementor library connect --user=<u> --token=<t>` | Connect library account |
| `wp elementor library disconnect --user=<u>` | Disconnect library account |
| `wp elementor library import <file> [--returnType=ids]` | Import template JSON |
| `wp elementor library import-dir <dir>` | Import all templates in directory |
| `wp elementor kit export <path.zip> [--include=...]` | Export site kit |
| `wp elementor kit import <path.zip> [--include=...] [--overrideConditions=...]` | Import site kit |
| `wp elementor experiments status <name>` | Check experiment status |
| `wp elementor experiments activate <name>` | Activate experiment |
| `wp elementor experiments deactivate <name>` | Deactivate experiment |
| `wp elementor-pro license activate <key>` | Activate Pro license |
| `wp elementor-pro license deactivate` | Deactivate Pro license |
| `wp elementor-pro theme-builder clear-conditions` | Clear theme builder conditions |

### Common Workflows

```bash
# Flush and regenerate CSS after style changes
wp elementor flush-css --regenerate

# Domain migration
wp elementor replace-urls http://old.example.com https://new.example.com

# Export full kit for staging
wp elementor kit export /tmp/my-site-kit.zip --include=site-settings,content,templates

# Import kit on new environment
wp elementor kit import /tmp/my-site-kit.zip --include=site-settings,content

# Install via Composer
composer require wpackagist-plugin/elementor
composer config --global --auth http-basic.composer.elementor.com token <license-key>
composer require elementor/elementor-pro
```
