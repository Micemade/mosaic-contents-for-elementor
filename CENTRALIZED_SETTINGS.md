# Centralized Settings Architecture

## Overview

Widget settings are now defined in a **single JSON file** that serves as the source of truth for all three locations where settings are used:

1. **PHP `render()`** - Frontend rendering
2. **PHP `content_template()`** - Elementor editor template  
3. **JavaScript `settings-mappers.js`** - React component settings

## Settings Definition File

**Location**: [`src/shared/products-layout-settings.json`](src/shared/products-layout-settings.json)

**Structure**:
```json
{
  "setting_name": {
    "default": <default_value>,
    "type": "string|number|boolean"
  }
}
```

**Example**:
```json
{
  "per_page": {
    "default": 10,
    "type": "number"
  },
  "on_sale": {
    "default": false,
    "type": "boolean"
  },
  "layout": {
    "default": "grid",
    "type": "string"
  }
}
```

## How It Works

### PHP Usage

**In [`widgets/products-layout.php`](widgets/products-layout.php)**:

```php
// Static property caches the JSON data
private static $settings_definitions = null;

// Loads JSON file once and caches it
private static function get_settings_definitions() {
    if (self::$settings_definitions === null) {
        $json_file = plugin_dir_path(__DIR__) . 'src/shared/products-layout-settings.json';
        if (file_exists($json_file)) {
            $json_content = file_get_contents($json_file);
            self::$settings_definitions = json_decode($json_content, true);
        }
    }
    return self::$settings_definitions;
}

// Extracts and formats all settings
private function get_widget_settings() {
    $definitions = self::get_settings_definitions();
    $result = array();
    
    foreach ($definitions as $key => $definition) {
        $default = $definition['default'];
        $type = $definition['type'];
        $raw_value = $this->sanitize_setting($key, $default);
        
        // Type conversion based on JSON definition
        if ($type === 'boolean') {
            $result[$key] = 'yes' === $raw_value;
        } elseif ($type === 'number') {
            $result[$key] = $raw_value;
        } else {
            $result[$key] = $raw_value;
        }
    }
    
    return $result;
}
```

### JavaScript Usage

**In [`src/widgets/settings-mappers.js`](src/widgets/settings-mappers.js)**:

```javascript
import productsLayoutSettingsDefinition from '../shared/products-layout-settings.json';

export const mapProductsLayoutSettings = (model) => {
    const settings = model.get('settings');
    const result = {};
    
    // Iterate through all settings defined in JSON
    Object.keys(productsLayoutSettingsDefinition).forEach(key => {
        const definition = productsLayoutSettingsDefinition[key];
        const value = settings.get(key);
        
        // Apply type-specific conversion
        if (definition.type === 'boolean') {
            result[key] = value === 'yes';
        } else if (definition.type === 'number') {
            result[key] = value !== undefined ? value : definition.default;
        } else {
            result[key] = value !== undefined ? value : definition.default;
        }
    });
    
    return result;
};
```

### Editor Template Generation

**In `content_template()`**:

```php
protected function content_template() {
    // Dynamically generate JavaScript code from JSON definitions
    $definitions = self::get_settings_definitions();
    $js_settings = array();
    
    foreach ($definitions as $key => $definition) {
        $default = $definition['default'];
        $type = $definition['type'];
        
        if ($type === 'boolean') {
            $js_settings[] = "\t{$key}: settings.{$key} === 'yes'";
        } elseif ($type === 'number') {
            $js_settings[] = "\t{$key}: settings.{$key} || {$default}";
        } else {
            $default_escaped = addslashes($definition['default']);
            $js_settings[] = "\t{$key}: settings.{$key} || '{$default_escaped}'";
        }
    }
    
    $js_settings_code = implode(",\n", $js_settings);
    ?>
<#
const widgetId = view.model.id;
const data = {
<?php echo $js_settings_code; ?>
};
const jsonData = JSON.stringify(data);
#>
<!-- Rest of template -->
<?php
}
```

## Benefits

✅ **Single Source of Truth** - Settings defined once in JSON  
✅ **DRY Principle** - No duplication across PHP/JavaScript  
✅ **Type Safety** - Consistent type conversion everywhere  
✅ **Easy Maintenance** - Add/modify settings in one place  
✅ **Automatic Sync** - All three locations stay synchronized  

## Adding a New Setting

1. **Add to JSON** ([`src/shared/products-layout-settings.json`](src/shared/products-layout-settings.json)):
   ```json
   {
     "new_setting": {
       "default": "value",
       "type": "string"
     }
   }
   ```

2. **Add Elementor Control** (in `register_controls()` method):
   ```php
   $this->add_control('new_setting', [
       'label' => __('New Setting', 'mosaic-product-layouts-for-elementor'),
       'type' => Controls_Manager::TEXT,
       'default' => 'value', // Must match JSON default
   ]);
   ```

3. **Rebuild**:
   ```bash
   npm run build
   ```

That's it! The setting will automatically be available in:
- Frontend rendering (`render()`)
- Editor template (`content_template()`)
- React components (via `widgetData` prop)

## Type Mappings

| JSON Type | Elementor Value | Output Value |
|-----------|-----------------|--------------|
| `boolean` | `'yes'` / `'no'` (string) | `true` / `false` |
| `number` | `10` (number) | `10` |
| `string` | `'value'` (string) | `'value'` |

## Future Enhancements

For future widgets, create similar JSON files:
- `src/shared/categories-layout-settings.json`
- `src/shared/single-product-layout-settings.json`

Follow the same pattern to maintain consistency across all widgets.
