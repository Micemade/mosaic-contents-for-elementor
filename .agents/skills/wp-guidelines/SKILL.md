---
name: wp-guidelines
description: Use when writing, reviewing, or refactoring WordPress PHP code. Covers WordPress Coding Standards (WPCS), naming conventions, Yoda conditions, $wpdb usage, escaping with esc_html/esc_attr/esc_url, wp_kses, hooks (add_action, add_filter, apply_filters, do_action), i18n functions (__(), _e(), _x, _n), wp_enqueue_script, wp_enqueue_style, formatting rules, deprecated function replacements, and WordPress API best practices. For security see wp-security; for performance see wp-performance; for blocks see wp-blocks.
---

# WordPress Coding Standards & Conventions

Quick-reference for WordPress PHP development. Rules are distilled from the official WordPress Coding Standards (WPCS) sniffs and WordPress core documentation.

---

## 1. Naming Conventions

All names use `snake_case` for functions, variables, and properties. Classes use `Pascal_Case` with underscores (`My_Plugin_Admin`). Hook names are all-lowercase with underscores, prefixed with your plugin slug.

| Element | Convention | Example |
|---------|-----------|---------|
| Functions | `snake_case` | `acme_get_settings()` |
| Variables | `snake_case` | `$post_title` |
| Classes | `Pascal_Case` (underscored) | `Acme_Plugin_Admin` |
| Constants | `UPPER_SNAKE_CASE` | `ACME_VERSION` |
| Files | `lowercase-hyphens` | `class-acme-admin.php` |
| Hook names | `lowercase_underscores` | `acme_after_init` |
| Post type slugs | `lowercase`, `a-z0-9_-`, max 20 chars | `acme_book` |

**File naming rules:** All lowercase, hyphens as separators, `class-` prefix for single-class files.

**Global prefix rule:** ALL plugin/theme globals (functions, classes, constants, hooks, namespaces) must start with a unique prefix (min 4 chars). Blocked prefixes: `wordpress`, `wp`, `_`, `php`.

**Post type slugs:** Max 20 chars, no reserved names (`post`, `page`, `attachment`, etc.), no `wp_` prefix.

<!-- Detailed code examples: resources/naming-best-practices.md -->

---

## 2. PHP Best Practices (WordPress-Specific)

**Yoda conditions:** Place literals on the LEFT side of `==`, `!=`, `===`, `!==` comparisons.

**Strict comparisons:** Always pass `true` as third arg to `in_array()`, `array_search()`, `array_keys()`.

**Forbidden functions:**

| Function | Why | Alternative |
|----------|-----|-------------|
| `extract()` | Pollutes local scope unpredictably | Destructure manually |
| `@` (error suppression) | Hides errors | Check return values; use `wp_safe_*` |
| `ini_set()` | Breaks interoperability | Use WP constants (`WP_DEBUG`, etc.) |

**Development-only functions** (remove before shipping): `var_dump`, `var_export`, `print_r`, `error_log`, `trigger_error`, `phpinfo`, and related debug functions.

**Use WordPress functions over PHP natives:**

| PHP Native | WordPress Alternative |
|------------|----------------------|
| `json_encode()` | `wp_json_encode()` |
| `parse_url()` | `wp_parse_url()` |
| `curl_*()` | `wp_remote_get()` / `wp_remote_post()` |
| `file_get_contents()` (remote) | `wp_remote_get()` |
| `unlink()` | `wp_delete_file()` |
| `strip_tags()` | `wp_strip_all_tags()` |
| `rand()` / `mt_rand()` | `wp_rand()` |
| `file_put_contents()`, `fopen()` | `WP_Filesystem` methods |

Note: `file_get_contents()` for local files (using `ABSPATH`, `WP_CONTENT_DIR`, `plugin_dir_path()`) is acceptable.

**Type casts:** Use short forms: `(int)`, `(float)`, `(bool)`, `(string)`. Never `(integer)`, `(real)`, or `(unset)`.

<!-- Detailed code examples: resources/naming-best-practices.md -->

---

## 3. Hooks & Actions

### 3.1 Registration Patterns

```php
// Actions: side effects (send email, save data, enqueue assets)
add_action( 'init', 'acme_register_post_types' );
add_action( 'wp_enqueue_scripts', 'acme_enqueue_assets' );
add_action( 'admin_menu', 'acme_add_admin_page' );

// Filters: modify and return a value
add_filter( 'the_content', 'acme_append_cta' );
add_filter( 'excerpt_length', 'acme_custom_excerpt_length' );
```

### 3.2 Priority and Argument Count

```php
// Default priority is 10, default accepted args is 1
add_filter( 'the_title', 'acme_modify_title', 10, 2 );

function acme_modify_title( $title, $post_id ) {
    // Always declare the correct number of parameters
    return $title;
}
```

### 3.3 Removing Hooks

Must match the exact callback, priority, and (for objects) the same instance:

```php
// Remove a function callback
remove_action( 'wp_head', 'wp_generator' );

// Remove with matching priority
remove_filter( 'the_content', 'acme_append_cta', 10 );

// Remove an object method (must be same instance)
remove_action( 'init', array( $instance, 'init' ) );
```

### 3.4 Hook Naming Conventions

```php
// Plugin hooks should be prefixed and use underscores
do_action( 'acme_before_render', $context );
$value = apply_filters( 'acme_output_format', $default, $post );

// Dynamic hooks: prefix the static part
do_action( "acme_process_{$type}", $data );
```

---

## 4. Internationalization (i18n)

### 4.1 Core Functions

| Function | Purpose |
|----------|---------|
| `__( $text, $domain )` | Return translated string |
| `_e( $text, $domain )` | Echo translated string |
| `_x( $text, $context, $domain )` | Return with disambiguation context |
| `_ex( $text, $context, $domain )` | Echo with disambiguation context |
| `_n( $single, $plural, $number, $domain )` | Pluralization |
| `_nx( $single, $plural, $number, $context, $domain )` | Plural + context |
| `esc_html__( $text, $domain )` | Return translated + HTML-escaped |
| `esc_html_e( $text, $domain )` | Echo translated + HTML-escaped |
| `esc_attr__( $text, $domain )` | Return translated + attribute-escaped |
| `esc_attr_e( $text, $domain )` | Echo translated + attribute-escaped |
| `esc_html_x( $text, $context, $domain )` | Return translated + escaped + context |
| `esc_attr_x( $text, $context, $domain )` | Return translated + escaped + context |

### 4.2 Rules

- **Text domain** must match your plugin/theme slug exactly.
- **All user-facing strings** must be wrapped in a translation function.
- **Prefer combined escape+translate** over separate calls:

```php
// BAD - separate escape and translate
echo esc_html( __( 'Hello', 'acme-plugin' ) );

// GOOD - combined function
echo esc_html__( 'Hello', 'acme-plugin' );
```

If you pass two parameters to `esc_html()` or `esc_attr()`, you probably meant `esc_html__()` / `esc_attr__()`.

### 4.3 Translator Comments

Add translator comments for ambiguous strings, sprintf placeholders, or context:

```php
// BAD
printf( __( '%s: %s', 'acme-plugin' ), $label, $value );

// GOOD
/* translators: 1: field label, 2: field value */
printf( __( '%1$s: %2$s', 'acme-plugin' ), $label, $value );
```

### 4.4 sprintf Placeholder Rules

- With 2+ placeholders, use **ordered** placeholders: `%1$s`, `%2$s` (not `%s`, `%s`).
- Do NOT use `%1$s` if there is only one placeholder (use `%s`).
- The number of placeholders must match the number of arguments.

---

## 5. Enqueuing Assets

### 5.1 Never Use Direct Tags

```php
// BAD - direct output
echo '<script src="my-script.js"></script>';
echo '<link rel="stylesheet" href="my-style.css">';

// GOOD - proper enqueue
function acme_enqueue_assets() {
    wp_enqueue_script(
        'acme-main',
        plugin_dir_url( __FILE__ ) . 'js/main.js',
        array( 'jquery' ),
        '1.2.0',
        true  // in_footer
    );
    wp_enqueue_style(
        'acme-styles',
        plugin_dir_url( __FILE__ ) . 'css/styles.css',
        array(),
        '1.2.0'
    );
}
add_action( 'wp_enqueue_scripts', 'acme_enqueue_assets' );
```

### 5.2 Required Parameters

| Parameter | Required? | Notes |
|-----------|-----------|-------|
| `$handle` | Yes | Unique identifier |
| `$src` | Conditional | Omit only when registering dependency-only handle |
| `$deps` | Recommended | Array of dependency handles |
| `$ver` | Yes (when src given) | Must be non-false; use explicit version string. `false` = WP core version (bad for cache busting). `null` = no version query string (also discouraged). |
| `$in_footer` (scripts) | Yes | Explicitly set `true` (footer) or `false` (header). Defaults to header if omitted. |
| `$media` (styles) | Optional | Default `'all'` |

```php
// BAD - missing version, missing in_footer
wp_enqueue_script( 'acme-main', $url );

// GOOD
wp_enqueue_script( 'acme-main', $url, array(), '1.0.0', true );
```

### 5.3 Conditional Loading

Load assets only where needed:

```php
function acme_admin_assets( $hook ) {
    if ( 'toplevel_page_acme-settings' !== $hook ) {
        return;
    }
    wp_enqueue_style( 'acme-admin', ... );
}
add_action( 'admin_enqueue_scripts', 'acme_admin_assets' );

function acme_frontend_assets() {
    if ( ! is_singular( 'acme_portfolio' ) ) {
        return;
    }
    wp_enqueue_script( 'acme-portfolio', ... );
}
add_action( 'wp_enqueue_scripts', 'acme_frontend_assets' );
```

---

## 6. WordPress API Usage

Key rules for WordPress API calls. Use capabilities (not roles) in `current_user_can()`. Cron intervals must be 15+ minutes. Limit `posts_per_page` (no `-1`). Never overwrite WP globals (`$post`, `$wp_query`). Always pass `$single` to `get_post_meta()`. Avoid `current_time( 'timestamp' )` -- use `time()` for UTC or `current_time( 'mysql' )` for formatted local time.

Common capabilities: `manage_options`, `edit_posts`, `edit_others_posts`, `publish_posts`, `delete_posts`, `upload_files`, `edit_theme_options`, `activate_plugins`.

`get_post_meta()` `$single` applies to: `get_post_meta`, `get_user_meta`, `get_term_meta`, `get_comment_meta`, `get_site_meta`, `get_metadata`, `get_metadata_raw`, `get_metadata_default`.

<!-- Detailed code examples: resources/api-deprecated-formatting.md -->

---

## 7. Deprecated Functions (Common Replacements)

Common deprecated functions and their replacements. WPCS flags usage as an error if the function was deprecated before your configured minimum WP version, and a warning otherwise.

| Deprecated | Since | Replacement |
|-----------|-------|-------------|
| `get_currentuserinfo()` | 4.5 | `wp_get_current_user()` |
| `get_page_by_title()` | 6.2 | `WP_Query` |
| `is_taxonomy()` | 3.0 | `taxonomy_exists()` |
| `is_term()` | 3.0 | `term_exists()` |
| `get_settings()` | 2.1 | `get_option()` |
| `get_usermeta()` | 3.0 | `get_user_meta()` |
| `update_usermeta()` | 3.0 | `update_user_meta()` |
| `delete_usermeta()` | 3.0 | `delete_user_meta()` |
| `wp_get_sites()` | 4.6 | `get_sites()` |
| `like_escape()` | 4.0 | `$wpdb->esc_like()` |
| `get_all_category_ids()` | 4.0 | `get_terms()` |
| `post_permalink()` | 4.4 | `get_permalink()` |
| `force_ssl_login()` | 4.4 | `force_ssl_admin()` |
| `wp_no_robots()` | 5.7 | `wp_robots_no_robots()` |
| `wp_make_content_images_responsive()` | 5.5 | `wp_filter_content_tags()` |
| `add_option_whitelist()` | 5.5 | `add_allowed_options()` |
| `remove_option_whitelist()` | 5.5 | `remove_allowed_options()` |
| `wp_get_loading_attr_default()` | 6.3 | `wp_get_loading_optimization_attributes()` |
| `the_meta()` | 6.0.2 | `get_post_meta()` |
| `readonly()` | 5.9 | `wp_readonly()` |
| `attribute_escape()` | 2.8 | `esc_attr()` |
| `wp_specialchars()` | 2.8 | `esc_html()` |
| `js_escape()` | 2.8 | `esc_js()` |
| `clean_url()` | 3.0 | `esc_url()` |
| `seems_utf8()` | 6.9 | `wp_is_valid_utf8()` |
| `current_user_can_for_blog()` | 6.7 | `current_user_can_for_site()` |

<!-- Full table also in: resources/api-deprecated-formatting.md -->

---

## 8. Formatting

**Spacing:** WordPress uses spaces inside parentheses, brackets, and around operators. Control structures always have spaces after keywords and inside parens: `if ( $x )`, `foreach ( $arr as $v )`.

**Indentation:** Use **tabs**, not spaces. Multi-line arrays: one item per line, trailing comma.

**Operator spacing:** Spaces around `=`, `+`, `.`, `=>`, etc. No spaces around `->` or `?->`.

**Cast spacing:** Space after cast, no space inside: `(int) $val`.

<!-- Detailed code examples: resources/api-deprecated-formatting.md -->

---

## 9. Testing

**PHP:** Use PHPUnit with `WP_UnitTestCase`. Install via `composer require --dev phpunit/phpunit` or `wp scaffold plugin-tests`. Test files in `tests/`, named `test-class-{name}.php`.

**JavaScript:** Use `@wordpress/scripts` (bundles Jest): `npx wp-scripts test-unit-js`. E2E via `@wordpress/e2e-test-utils`.

**Linting:** `vendor/bin/phpcs --standard=WordPress src/` for PHP. `npx wp-scripts lint-js` and `npx wp-scripts lint-style` for JS/CSS.

<!-- Detailed code examples: resources/testing-patterns.md -->

---

## 10. Quick Reference Tables

### Control Structure Spacing

| Pattern | BAD | GOOD |
|---------|-----|------|
| if | `if($x)` | `if ( $x )` |
| elseif | `elseif($x)` | `elseif ( $x )` |
| foreach | `foreach($a as $b)` | `foreach ( $a as $b )` |
| for | `for($i=0;$i<10;$i++)` | `for ( $i = 0; $i < 10; $i++ )` |
| switch | `switch($x)` | `switch ( $x )` |
| while | `while($x)` | `while ( $x )` |

### Naming Quick Reference

| Element | Convention | Example |
|---------|-----------|---------|
| Functions | `snake_case` | `acme_get_settings()` |
| Variables | `snake_case` | `$post_title` |
| Classes | `Pascal_Case` (underscored) | `Acme_Plugin_Admin` |
| Constants | `UPPER_SNAKE_CASE` | `ACME_VERSION` |
| Files | `lowercase-hyphens` | `class-acme-admin.php` |
| Hook names | `lowercase_underscores` | `acme_after_init` |
| Post type slugs | `lowercase`, `a-z0-9_-` | `acme_book` |

### WordPress i18n Functions at a Glance

| Need | Function |
|------|----------|
| Return translated string | `__()` |
| Echo translated string | `_e()` |
| Return + HTML escape | `esc_html__()` |
| Echo + HTML escape | `esc_html_e()` |
| Return + attr escape | `esc_attr__()` |
| Echo + attr escape | `esc_attr_e()` |
| With context | `_x()`, `esc_html_x()`, `esc_attr_x()` |
| Singular/plural | `_n()` |
| Singular/plural + context | `_nx()` |
