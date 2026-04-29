# Naming Conventions & PHP Best Practices -- Detailed Examples

Extended code examples for Sections 1 and 2 of the WordPress Coding Standards skill.

---

## 1. Naming Conventions

### 1.1 Functions & Methods

All function and method names MUST be `snake_case`. Magic methods and PHP4 constructors are exempt. Methods in child classes / interface implementations may follow the parent convention.

```php
// BAD
function getPostData() {}
function Get_Post_Data() {}

// GOOD
function get_post_data() {}
```

Do NOT prefix functions with double underscores (`__`) unless they are PHP magic methods.

### 1.2 Variables & Properties

All variables and object properties MUST be `snake_case`.

```php
// BAD
$postTitle = 'Hello';
$this->postTitle = 'Hello';

// GOOD
$post_title = 'Hello';
$this->post_title = 'Hello';
```

**Known exceptions from WP core** (allowed as-is): `$post_ID`, `$comment_ID`, `$user_ID`, `$tag_ID`, `$cat_ID`, `$is_IE`, `$is_IIS`, `$PHP_SELF`.

### 1.3 Classes, Interfaces, Traits, Enums

Use `Pascal_Case` with underscores separating words (WordPress convention, not PSR).

```php
// BAD
class myPlugin {}
class my_plugin {}

// GOOD
class My_Plugin {}
class My_Plugin_Admin {}
```

WP native classes use this pattern: `WP_Query`, `WP_REST_Controller`, `Custom_Background`.

### 1.4 File Names

| Rule | Example |
|------|---------|
| All lowercase | `my-plugin.php` |
| Hyphens as separators (no underscores) | `class-my-widget.php` |
| Files containing a single class: prefix with `class-` | `class-my-plugin-admin.php` |
| Theme template files may use underscores | `single-my_cpt.php` |

### 1.5 Hook Names

Hook names (actions/filters) invoked with `do_action()` / `apply_filters()` MUST be:

- **All lowercase**
- **Words separated by underscores**
- **Prefixed with your plugin/theme slug**

```php
// BAD
do_action( 'MyPlugin_Init' );
do_action( 'my-plugin-init' );

// GOOD
do_action( 'myplugin_init' );
do_action( 'myplugin_after_setup' );
apply_filters( 'myplugin_post_title', $title );
```

### 1.6 Post Type Slugs

Rules enforced by `ValidPostTypeSlugSniff`:

| Rule | Detail |
|------|--------|
| Max length | 20 characters (SQL column limit) |
| Valid characters | Lowercase `a-z`, `0-9`, hyphens, underscores |
| No reserved names | `post`, `page`, `attachment`, `revision`, `nav_menu_item`, `action`, `author`, `order`, `theme` |
| No `wp_` prefix | Reserved for WordPress core post types |

```php
// BAD
register_post_type( 'MyBooks' );            // uppercase
register_post_type( 'wp_custom_books' );    // wp_ prefix reserved
register_post_type( 'page' );              // reserved name
register_post_type( 'a_very_long_custom_post_type_name' ); // >20 chars

// GOOD
register_post_type( 'acme_book' );
```

### 1.7 Global Prefix Rule

ALL globals defined by a plugin or theme must start with a unique prefix (minimum 4 characters). This applies to:

- Functions, classes, interfaces, traits, enums in the global namespace
- Global variables and `$GLOBALS` keys
- Constants (both `const` and `define()`)
- Hook names
- Namespaces

**Blocked prefixes:** `wordpress`, `wp`, `_`, `php`.

```php
// BAD (no prefix or too short)
function init() {}
define( 'VERSION', '1.0' );
$GLOBALS['data'] = [];

// GOOD
function acme_init() {}
define( 'ACME_VERSION', '1.0' );
$GLOBALS['acme_data'] = [];
// Or use a namespace:
namespace Acme\Plugin;
```

---

## 2. PHP Best Practices (WordPress-Specific)

### 2.1 Yoda Conditions

Place the literal/constant on the LEFT side of comparisons. This prevents accidental assignment.

```php
// BAD
if ( $value === true ) {}
if ( $status == 'active' ) {}

// GOOD
if ( true === $value ) {}
if ( 'active' === $status ) {}
```

Applies to `==`, `!=`, `===`, `!==`. Variable-to-variable comparisons are exempt.

### 2.2 Strict `in_array()` / `array_search()` / `array_keys()`

Always pass `true` as the third parameter for strict type comparison.

```php
// BAD
in_array( $value, $allowed );
array_search( $key, $haystack );
array_keys( $data, $filter_value );

// GOOD
in_array( $value, $allowed, true );
array_search( $key, $haystack, true );
array_keys( $data, $filter_value, true );
```

### 2.3 Forbidden Functions

| Function | Why | Alternative |
|----------|-----|-------------|
| `extract()` | Pollutes local scope unpredictably | Destructure manually |
| `@` (error suppression) | Hides errors; use proper handling | Check return values; use `wp_safe_*` |
| `ini_set()` | Breaks interoperability between plugins | See table below |

**`ini_set()` replacements:**

| ini directive | Use instead |
|---------------|-------------|
| `display_errors` | `WP_DEBUG_DISPLAY` constant |
| `error_reporting` | `WP_DEBUG` constant |
| `log_errors` | `WP_DEBUG_LOG` constant |
| `memory_limit` | `wp_raise_memory_limit()` |
| `max_execution_time` | `set_time_limit()` |

### 2.4 Development Functions (No Production Use)

These trigger warnings. Remove before shipping:

`var_dump`, `var_export`, `print_r`, `error_log`, `trigger_error`, `set_error_handler`, `debug_backtrace`, `debug_print_backtrace`, `wp_debug_backtrace_summary`, `error_reporting`, `phpinfo`

### 2.5 Use WordPress Functions Over PHP Natives

| PHP Native | WordPress Alternative | Since WP |
|------------|----------------------|----------|
| `json_encode()` | `wp_json_encode()` | 4.1 |
| `parse_url()` | `wp_parse_url()` | 4.4 |
| `curl_*()` | `wp_remote_get()` / `wp_remote_post()` | 2.7 |
| `file_get_contents()` (remote) | `wp_remote_get()` | 2.7 |
| `unlink()` | `wp_delete_file()` | 4.2 |
| `rename()` | `WP_Filesystem::move()` | 2.5 |
| `strip_tags()` | `wp_strip_all_tags()` | 2.9 |
| `rand()` / `mt_rand()` | `wp_rand()` | 2.6.2 |
| `file_put_contents()`, `fopen()`, etc. | `WP_Filesystem` methods | 2.5 |

Note: `file_get_contents()` for local files (using `ABSPATH`, `WP_CONTENT_DIR`, `plugin_dir_path()`, etc.) is acceptable.

### 2.6 Type Casts

Use short, normalized forms:

```php
// BAD
$val = (integer) $input;
$val = (real) $input;
(unset) $var;  // removed in PHP 8.0

// GOOD
$val = (int) $input;
$val = (float) $input;
unset( $var );
```
