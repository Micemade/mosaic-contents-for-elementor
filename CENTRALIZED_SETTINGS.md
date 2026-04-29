# Centralized Settings Architecture

## Overview

Each widget's settings are defined in a **single `react-settings.json` file** that acts as the source of truth for all three places where settings are consumed:

1. **PHP `render()`** — Frontend HTML, serializes settings into a hidden input for React hydration
2. **PHP `content_template()`** — Elementor editor Backbone template, generates the JS settings object inline
3. **JavaScript `settings-mappers.js`** — Reads Elementor model → produces the `widgetData` prop passed to React

All three consumers are driven generically from the same JSON; adding or modifying a setting in one place keeps all consumers in sync automatically.

---

## Settings Schema Files

**Location:** `src/widgets/{widget-name}/react-settings.json`

| Widget | Schema File |
|--------|-------------|
| Content Layout | `src/widgets/content-layout/react-settings.json` |
| Categories Layout | `src/widgets/categories-layout/react-settings.json` |
| Single Product Layout | `src/widgets/single-product-layout/react-settings.json` |

**Structure:**
```json
{
  "setting_key": {
    "type": "string|number|boolean|responsive|object|array",
    "default": "<default_value>"
  }
}
```

Responsive settings support per-breakpoint defaults:
```json
{
  "mc4e_title_size": {
    "type": "responsive",
    "default": { "size": 24, "unit": "px" },
    "tablet_default": { "size": 22, "unit": "px" },
    "mobile_default": { "size": 20, "unit": "px" }
  }
}
```

---

## Type System

| JSON `type` | Elementor storage | Produced value |
|-------------|-------------------|----------------|
| `string` | String | String (or default) |
| `number` | Number/Slider | Number (or default) |
| `boolean` | `'yes'` / `''` | `true` / `false` |
| `responsive` | Base key + `_tablet`, `_mobile` | `{ desktop: val, tablet: val, mobile: val }` |
| `object` | Object (e.g. focal point `{x,y}`) | Object (or default) |
| `array` | Repeater collection | Plain JS array (or default) |

---

## PHP Layer — `includes/trait-widget-helpers.php`

A shared trait used by all three widget classes. The static method `get_settings_definitions()` loads and caches the JSON for the calling widget, keyed by `get_name()`:

```php
// Loads src/widgets/{widget-name}/react-settings.json
protected static function get_settings_definitions( $widget_name ) {
    if ( ! isset( self::$settings_cache[ $widget_name ] ) ) {
        $json_file = plugin_dir_path( __DIR__ ) . "src/widgets/{$widget_name}/react-settings.json";
        if ( file_exists( $json_file ) ) {
            self::$settings_cache[ $widget_name ] = json_decode( file_get_contents( $json_file ), true );
        } else {
            self::$settings_cache[ $widget_name ] = [];
        }
    }
    return self::$settings_cache[ $widget_name ];
}
```

### `render()` (Frontend)

Iterates all definitions, resolves each value (with type conversion and responsive unpacking), JSON-encodes the result, and writes it to a hidden input for React to hydrate:

```php
protected function render() {
    $query_settings = $this->get_widget_settings();
    $json_data      = wp_json_encode( $query_settings );
    $widget_name    = $this->get_name();
    $widget_id      = $this->get_id();
    ?>
<div class="<?php echo esc_attr( $widget_name ); ?>-wrapper"
     data-widget-id="<?php echo esc_attr( $widget_id ); ?>">
    <input type="hidden" class="elementor-settings-data"
           value="<?php echo esc_attr( $json_data ); ?>" />
    <div class="<?php echo esc_attr( $widget_name ); ?>-react-root"></div>
</div>
    <?php
}
```

### `content_template()` (Editor)

Dynamically generates a Backbone/Underscore template (PHP string → rendered in-browser) that reads live `settings` attributes and produces the same JSON object:

```php
protected function content_template() {
    $widget_name = $this->get_name();
    $definitions = self::get_settings_definitions( $widget_name );
    $js_settings = [];

    foreach ( $definitions as $key => $definition ) {
        // Per-type JS code generation:
        // boolean    → key: settings.key === 'yes'
        // number     → key: settings.key || default
        // object     → key: settings.key || {default_json}
        // array      → key: settings.key || [default_json]
        // responsive → key: { desktop: settings.key || 'd', tablet: settings.key_tablet || 't', ... }
        // string     → key: settings.key || 'default'
    }

    // Outputs a Backbone template:
    // <# const data = { ...generated_keys... }; const jsonData = JSON.stringify(data); #>
    // <div class="{widget}-wrapper" data-widget-id="{{ widgetId }}">
    //   <input type="hidden" class="elementor-settings-data" value="{{ jsonData }}" />
    //   <div class="{widget}-react-root"></div>
    // </div>
}
```

---

## JavaScript Layer — `src/widgets/settings-mappers.js`

Uses the `createSettingsMapper(settingsDef)` **factory function**, driven entirely by the same JSON schema:

```javascript
import { createSettingsMapper } from './settings-mappers';

import productsSettingsDef       from './content-layout/react-settings.json';
import categoriesSettingsDef     from './categories-layout/react-settings.json';
import singleProductSettingsDef  from './single-product-layout/react-settings.json';

// Each widget gets a mapper built from its own JSON schema
export const WIDGET_REGISTRY = {
    'content-layout':       { ..., settingsMapper: createSettingsMapper(productsSettingsDef) },
    'categories-layout':     { ..., settingsMapper: createSettingsMapper(categoriesSettingsDef) },
    'single-product-layout': { ..., settingsMapper: createSettingsMapper(singleProductSettingsDef) },
};
```

The factory handles all types and responsive variants automatically:

```javascript
export const createSettingsMapper = (settingsDefinition) => (model) => {
    const settings = model.get('settings');
    const result = {};

    Object.keys(settingsDefinition).forEach(key => {
        const definition = settingsDefinition[key];
        const value = settings.get(key);

        if (definition.type === 'responsive') {
            result[key] = getResponsiveValue(settings, key, getActiveBreakpointNames(), definition);
            // → { desktop: val, tablet: val_tablet, mobile: val_mobile }
        } else if (definition.type === 'boolean') {
            result[key] = value === 'yes';
        } else if (definition.type === 'number') {
            result[key] = value !== undefined ? value : definition.default;
        } else if (definition.type === 'array') {
            result[key] = value?.toJSON ? value.toJSON()
                        : (Array.isArray(value) ? value : definition.default);
        } else {
            result[key] = value !== undefined ? value : definition.default;
        }
    });

    return result;
};
```

---

## Adding a New Setting

1. **Add to the widget's `react-settings.json`:**
   ```json
   {
     "mc4e_new_setting": {
       "type": "string",
       "default": "auto"
     }
   }
   ```

2. **Add the Elementor control** in the widget's `register_controls()` method:
   ```php
   $this->add_control( 'mc4e_new_setting', [
       'label'   => __( 'New Setting', 'mosaic-contents-for-elementor' ),
       'type'    => Controls_Manager::SELECT,
       'default' => 'auto',
       'options' => [ 'auto' => 'Auto', 'manual' => 'Manual' ],
   ] );
   ```

3. **Rebuild:**
   ```bash
   npm run build
   ```

The setting is now automatically available in `render()`, `content_template()`, and as `widgetData.mc4e_new_setting` inside the React component.

---

## Benefits

| Concern | How it's addressed |
|---------|-------------------|
| Single source of truth | One JSON file per widget drives all three layers |
| DRY | No duplicated defaults or type logic across PHP/JS |
| Type safety | Consistent `boolean`/`responsive`/`number` conversions everywhere |
| Easy maintenance | Add or rename a setting in one file only |
| Multi-widget support | Each widget has its own schema; factory pattern removes per-widget boilerplate |
| Bug prevention | **Mismatched paths cause empty settings** — PHP and JS both resolve to the same `react-settings.json` |
