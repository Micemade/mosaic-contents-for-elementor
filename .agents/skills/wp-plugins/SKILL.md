---
name: wp-plugins
description: Use when building WordPress plugins or themes. Covers plugin architecture, plugin header and text domain, register_activation_hook, register_deactivation_hook, uninstall.php, settings API (add_options_page, register_setting), $wpdb and dbDelta for custom tables, schema upgrades, transients, data storage patterns, WP_CLI custom commands, PHPStan configuration, phpcs (WordPress coding standards linting), PHPUnit testing, wp scaffold plugin, PSR-4 autoloading, and build/deploy workflows.
---

# WordPress Plugin & Theme Development

Consolidated reference for plugin architecture, lifecycle, settings, data storage,
WP-CLI integration, static analysis, coding standards, testing, and deployment.

**Resource files** (detailed code examples):

- `resources/settings-api.md` — Full Settings_Page class implementation
- `resources/wp-cli.md` — WP-CLI custom commands and operations reference
- `resources/static-analysis-testing.md` — PHPStan, PHPCS, and PHPUnit testing
- `resources/build-deploy.md` — Build, deploy, and release workflows

---

## 1. Plugin Architecture

### Main Plugin File

Every plugin starts with a single PHP file containing the plugin header comment.
WordPress reads this header to register the plugin in the admin UI.

```php
<?php
/**
 * Plugin Name: My Awesome Plugin
 * Plugin URI:  https://example.com/my-awesome-plugin
 * Description: A short description of what this plugin does.
 * Version:     1.0.0
 * Author:      Your Name
 * Author URI:  https://example.com
 * License:     GPL-2.0-or-later
 * Text Domain: my-awesome-plugin
 * Domain Path: /languages
 * Requires at least: 6.2
 * Requires PHP: 7.4
 */

// Prevent direct access.
defined( 'ABSPATH' ) || exit;

// Define constants.
define( 'MAP_VERSION', '1.0.0' );
define( 'MAP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MAP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'MAP_PLUGIN_FILE', __FILE__ );

// Autoloader (Composer PSR-4).
if ( file_exists( MAP_PLUGIN_DIR . 'vendor/autoload.php' ) ) {
    require_once MAP_PLUGIN_DIR . 'vendor/autoload.php';
}

// Lifecycle hooks — must be registered at top level, not inside other hooks.
register_activation_hook( __FILE__, [ 'MyAwesomePlugin\\Activator', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'MyAwesomePlugin\\Deactivator', 'deactivate' ] );

// Bootstrap the plugin on `plugins_loaded`.
add_action( 'plugins_loaded', function () {
    MyAwesomePlugin\Plugin::instance()->init();
} );
```

### Bootstrap Pattern

- The main file loads, defines constants, requires the autoloader, registers
  lifecycle hooks, and defers initialization to a `plugins_loaded` callback.
- Avoid heavy side effects at file load time. Load on hooks.
- Keep admin-only code behind `is_admin()` checks or admin-specific hooks.

### Namespaces and Autoloading (PSR-4)

Configure in `composer.json`:

```json
{
    "autoload": {
        "psr-4": {
            "MyAwesomePlugin\\": "includes/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "MyAwesomePlugin\\Tests\\": "tests/"
        }
    }
}
```

Run `composer dump-autoload` after changes.

### Folder Structure

```
my-awesome-plugin/
  my-awesome-plugin.php      # Main plugin file with header
  uninstall.php              # Cleanup on uninstall
  composer.json / phpstan.neon / phpcs.xml / .distignore
  includes/                  # Core PHP classes (PSR-4 root)
    Plugin.php / Activator.php / Deactivator.php
    Admin/  Frontend/  CLI/  REST/
  admin/  public/            # View partials
  assets/  templates/  languages/  tests/
```

### Singleton vs Dependency Injection

Use singleton for the root plugin class only. Prefer dependency injection for
everything else (testability).

```php
namespace MyAwesomePlugin;

class Plugin {
    private static ?Plugin $instance = null;

    public static function instance(): Plugin {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function init(): void {
        ( new Admin\Settings_Page() )->register();
        ( new Frontend\Assets() )->register();
        if ( defined( 'WP_CLI' ) && WP_CLI ) {
            CLI\Commands::register();
        }
    }
}
```

### Action / Filter Hook Architecture

- **Actions** execute code at a specific point (`do_action` / `add_action`).
- **Filters** modify data and return it (`apply_filters` / `add_filter`).
- Always specify the priority (default 10) and accepted args count.
- Provide your own hooks so other developers can extend your plugin.

```php
// Registering hooks in your plugin.
add_action( 'init', [ $this, 'register_post_types' ] );
add_filter( 'the_content', [ $this, 'append_cta' ], 20 );

// Providing extensibility.
$output = apply_filters( 'map_formatted_price', $formatted, $raw_price );
do_action( 'map_after_order_processed', $order_id );
```

---

## 2. Lifecycle Hooks

Lifecycle hooks **must** be registered at top-level scope in the main plugin
file, not inside other hooks or conditional blocks.

### Activation

```php
namespace MyAwesomePlugin;

class Activator {
    public static function activate(): void {
        self::create_tables();

        if ( false === get_option( 'map_settings' ) ) {
            update_option( 'map_settings', [
                'enabled' => true, 'api_key' => '', 'max_results' => 10,
            ], false );
        }

        update_option( 'map_db_version', MAP_VERSION, false );

        // Register CPTs first, then flush so rules exist.
        ( new Plugin() )->register_post_types();
        flush_rewrite_rules();
    }

    private static function create_tables(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'map_logs';
        $sql = "CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL DEFAULT 0,
            action varchar(100) NOT NULL DEFAULT '',
            data longtext NOT NULL DEFAULT '',
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id)
        ) {$wpdb->get_charset_collate()};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }
}
```

### Deactivation

```php
namespace MyAwesomePlugin;

class Deactivator {
    public static function deactivate(): void {
        // Clear scheduled cron events.
        wp_clear_scheduled_hook( 'map_daily_cleanup' );
        wp_clear_scheduled_hook( 'map_hourly_sync' );

        // Flush rewrite rules to remove custom rewrites.
        flush_rewrite_rules();
    }
}
```

### Uninstall

Create `uninstall.php` in the plugin root (preferred over `register_uninstall_hook`):

```php
<?php
// uninstall.php — runs when plugin is deleted via admin UI.
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;
delete_option( 'map_settings' );
delete_option( 'map_db_version' );
$wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE 'map\_%'" );
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}map_logs" );
$wpdb->query(
    "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_map_%'
     OR option_name LIKE '_transient_timeout_map_%'"
);
$wpdb->query( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE 'map\_%'" );
```

**Key rule:** Never run expensive operations on every request. Activation,
deactivation, and uninstall hooks exist precisely so you can perform setup and
teardown only when needed.

---

## 3. Settings API

Full Settings_Page class implementation: see `resources/settings-api.md`.

### Options API

```php
$settings = get_option( 'map_settings', [] );          // Read.
update_option( 'map_settings', $new_values );           // Write.
delete_option( 'map_settings' );                        // Delete.
update_option( 'map_large_cache', $data, false );       // autoload=false for infrequent options.
```

---

## 4. Data Storage

### When to Use What

| Storage            | Use Case                                  | Size Guidance            |
|--------------------|-------------------------------------------|--------------------------|
| Options API        | Small config, plugin settings             | < 1 MB per option        |
| Post meta          | Per-post data tied to a specific post     | Keyed per post           |
| User meta          | Per-user preferences or state             | Keyed per user           |
| Custom tables      | Structured, queryable, or large datasets  | No practical limit       |
| Transients         | Cached data with expiration               | Temporary, auto-expires  |

### Custom Tables with dbDelta

`dbDelta()` rules: each field on its own line, two spaces between name and type,
`PRIMARY KEY` with two spaces before, use `KEY` not `INDEX`.

```php
function map_create_table(): void {
    global $wpdb;
    $sql = "CREATE TABLE {$wpdb->prefix}map_events (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        name varchar(255) NOT NULL DEFAULT '',
        status varchar(20) NOT NULL DEFAULT 'draft',
        event_date datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        PRIMARY KEY  (id),
        KEY status (status)
    ) {$wpdb->get_charset_collate()};";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
}
```

### Schema Upgrades

Store a version and compare on `plugins_loaded`:

```php
add_action( 'plugins_loaded', function () {
    if ( version_compare( get_option( 'map_db_version', '0' ), MAP_VERSION, '<' ) ) {
        map_create_table();  // dbDelta handles ALTER for existing tables.
        update_option( 'map_db_version', MAP_VERSION, false );
    }
} );
```

### Transients

```php
$data = get_transient( 'map_api_results' );
if ( false === $data ) {
    $data = map_fetch_from_api();
    set_transient( 'map_api_results', $data, HOUR_IN_SECONDS );
}
```

### Safe SQL

Always use `$wpdb->prepare()` for user input. Never concatenate variables into SQL.

```php
$results = $wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}map_events WHERE status = %s AND event_date > %s",
    $status, $date
) );
```

---

## 5. WP-CLI, Static Analysis, Testing, Build & Deploy

Detailed references in resource files:

- **WP-CLI** (custom commands, operations reference): `resources/wp-cli.md`
- **PHPStan, PHPCS, Testing**: `resources/static-analysis-testing.md`
- **Build & Deploy** (Composer, JS/CSS, SVN, GitHub releases): `resources/build-deploy.md`

---

## 6. Security Checklist

- Sanitize on input, escape on output. Never trust `$_POST`/`$_GET` directly.
- Use `wp_unslash()` before sanitizing superglobals. Read explicit keys only.
- Pair nonce checks with `current_user_can()`. Nonces prevent CSRF, not authz.
- Use `$wpdb->prepare()` for all SQL with user input.
- Escape output: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`.

---

## 7. WordPress 6.7-6.9 Breaking Changes

### WP 6.7 -- Translation Loading

`load_plugin_textdomain()` is auto-called for plugins with a `Text Domain` header.
If you call it manually from `init`, it may load before the preferred translation
source (language packs). Move manual calls to `after_setup_theme` or remove them
entirely if the header is set.

### WP 6.8 -- Bcrypt Password Hashing

WordPress 6.8 migrates from phpass MD5 to bcrypt (`password_hash()`). Existing
hashes upgrade transparently on next login. **Impact on plugins:**

- `wp_check_password()` / `wp_hash_password()` still work -- use these, never
  hash passwords manually.
- Plugins that store or compare raw `$hash` strings from the `user_pass` column
  will break if they assume `$P$` prefix.
- Custom authentication that bypasses `wp_check_password()` must handle both
  `$P$` (legacy) and `$2y$` (bcrypt) prefixes.

### WP 6.9 -- Abilities API & WP_Dependencies Deprecation

- `WP_Dependencies` class is deprecated. Use `wp_enqueue_script()` /
  `wp_enqueue_style()` -- never instantiate `WP_Dependencies` directly.
- Abilities API (`register_ability()`) replaces ad-hoc `current_user_can()` for
  REST route permissions (see wp-rest-api skill).

---

## 8. Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Lifecycle hooks inside `add_action('init', ...)` | Activation/deactivation hooks not detected | Register at top-level scope in main file |
| `flush_rewrite_rules()` without registering CPTs first | Rules flushed before custom post types exist | Call CPT registration, then flush |
| Missing `sanitize_callback` on `register_setting()` | Unsanitized data saved to database | Always provide sanitize callback |
| `autoload` left as `yes` for large/infrequent options | Every page load fetches unused data | Pass `false` as 4th arg to `update_option()` |
| Using `$wpdb->query()` with string concatenation | SQL injection vulnerability | Use `$wpdb->prepare()` |
| Nonce check without capability check | CSRF prevented but no authorization | Always pair nonce + `current_user_can()` |
| `innerHTML =` in admin JS | XSS vector | Use `textContent` or DOM creation methods |
| No `defined('ABSPATH')` guard | Direct file access possible | Add `defined('ABSPATH') \|\| exit;` to every PHP file |
| Running `dbDelta()` on every request | Slow table introspection on every page load | Run only on activation or version upgrade |
| Not checking `WP_UNINSTALL_PLUGIN` in uninstall.php | File could be loaded outside uninstall context | Check constant before running cleanup |
| PHPStan baseline grows unchecked | New errors silently added to baseline | Review baseline changes in PRs; never baseline new code |
| Missing `--dry-run` on `wp search-replace` | Irreversible changes to production database | Always dry-run first, then backup, then run |
| Forgetting `--url=` in multisite WP-CLI | Command hits wrong site | Always include `--url=` for site-specific operations |
