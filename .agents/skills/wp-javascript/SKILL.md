---
name: wp-javascript
description: Use when working with JavaScript in WordPress plugins or themes. Covers wp_enqueue_script, wp_localize_script, wp_add_inline_script, jQuery in WordPress (noConflict mode, $.ajax), AJAX handlers (wp_ajax_, admin-ajax.php, wp_create_nonce, check_ajax_referer), wp.ajax, wp.apiFetch (wp-api-fetch), wp-util and wp.template (Underscore templates), Heartbeat API, script dependencies, defer/async loading strategies (WordPress 6.3+), wp_set_script_translations, and frontend-backend communication patterns.
---

# WordPress JavaScript & AJAX

Reference for JavaScript integration in WordPress: script registration and enqueuing,
passing data from PHP to JS, AJAX request/response patterns, the Heartbeat API,
jQuery usage, and loading strategies.

---

## 1. Enqueuing Scripts

WordPress manages JavaScript dependencies through a registration and enqueuing system.
Never output `<script>` tags directly — always use the enqueue API.

### Basic Pattern

```php
add_action( 'wp_enqueue_scripts', 'map_enqueue_frontend_scripts' );

function map_enqueue_frontend_scripts(): void {
    wp_enqueue_script(
        'map-frontend',                                // Handle (unique identifier).
        plugins_url( 'assets/js/frontend.js', __FILE__ ), // Full URL to file.
        array( 'jquery' ),                             // Dependencies.
        '1.0.0',                                       // Version (cache busting).
        array( 'in_footer' => true )                   // Load in footer.
    );
}
```

### Enqueue Hooks

| Hook                       | Where Scripts Load          | Callback Parameter             |
|----------------------------|-----------------------------|--------------------------------|
| `wp_enqueue_scripts`       | Frontend pages              | None                           |
| `admin_enqueue_scripts`    | Admin pages                 | `$hook_suffix` (page filename) |
| `login_enqueue_scripts`    | Login page                  | None                           |

### Conditional Loading (Admin)

Load scripts only on your plugin's admin page — not on every admin screen:

```php
add_action( 'admin_enqueue_scripts', 'map_enqueue_admin_scripts' );

function map_enqueue_admin_scripts( string $hook_suffix ): void {
    // $hook_suffix examples: 'toplevel_page_my-plugin', 'settings_page_my-plugin-settings'.
    if ( 'toplevel_page_my-plugin' !== $hook_suffix ) {
        return;
    }

    wp_enqueue_script(
        'map-admin',
        plugins_url( 'assets/js/admin.js', __FILE__ ),
        array( 'jquery', 'wp-util' ),
        MAP_VERSION,
        array( 'in_footer' => true )
    );
}
```

### Conditional Loading (Frontend)

```php
add_action( 'wp_enqueue_scripts', 'map_enqueue_conditionally' );

function map_enqueue_conditionally(): void {
    // Only load on single posts.
    if ( ! is_single() ) {
        return;
    }

    wp_enqueue_script( 'map-single', /* ... */ );
}
```

### Register vs Enqueue

```php
// Register (makes handle available, doesn't load yet).
wp_register_script( 'map-charts', plugins_url( 'assets/js/charts.js', __FILE__ ), array(), '2.0.0', true );

// Enqueue later when needed (e.g., inside a shortcode callback).
function map_chart_shortcode( $atts ): string {
    wp_enqueue_script( 'map-charts' );  // Now it loads.
    return '<div id="map-chart"></div>';
}
```

Registration is useful when a script should only load conditionally (inside a
shortcode, meta box, or specific template).

---

## 2. Passing Data from PHP to JavaScript

### wp_localize_script()

Passes PHP values to JavaScript as a global object. Must be called after the
script is enqueued/registered and before `wp_head()`/`wp_footer()` fires.

```php
wp_enqueue_script( 'map-ajax', plugins_url( 'assets/js/ajax.js', __FILE__ ), array( 'jquery' ), '1.0.0', true );

wp_localize_script( 'map-ajax', 'mapAjax', array(
    'ajaxUrl' => admin_url( 'admin-ajax.php' ),
    'nonce'   => wp_create_nonce( 'map_ajax_nonce' ),
    'homeUrl' => home_url( '/' ),
    'i18n'    => array(
        'loading' => __( 'Loading...', 'my-plugin' ),
        'error'   => __( 'An error occurred.', 'my-plugin' ),
    ),
) );
```

In JavaScript, the data is available as a global:

```js
console.log( mapAjax.ajaxUrl );  // "https://example.com/wp-admin/admin-ajax.php"
console.log( mapAjax.nonce );    // "a1b2c3d4e5"
console.log( mapAjax.i18n.loading ); // "Loading..."
```

**Limitations:**
- All values are cast to strings (numbers become `"5"`, booleans become `""` or `"1"`).
- For complex data, use `wp_add_inline_script()` with `wp_json_encode()` instead.

### wp_add_inline_script()

Injects a `<script>` block tied to a registered handle. Supports `'before'` or
`'after'` positioning (default: `'after'`).

```php
wp_enqueue_script( 'map-app', plugins_url( 'assets/js/app.js', __FILE__ ), array(), '1.0.0', true );

wp_add_inline_script( 'map-app', sprintf(
    'var mapConfig = %s;',
    wp_json_encode( array(
        'apiBase'    => rest_url( 'map/v1/' ),
        'nonce'      => wp_create_nonce( 'wp_rest' ),
        'maxItems'   => 50,        // Stays as integer.
        'debug'      => WP_DEBUG,  // Stays as boolean.
    ) )
), 'before' );
```

Use `'before'` when your main script needs the config variable at load time.

### Script Translation (i18n)

For Block Editor scripts using `wp.i18n.__()`:

```php
wp_set_script_translations( 'map-editor', 'my-plugin', plugin_dir_path( __FILE__ ) . 'languages' );
```

---

## 3. Script Dependencies & Built-in Libraries

### Common WordPress Script Handles

| Handle            | Library                              | Notes                          |
|-------------------|--------------------------------------|--------------------------------|
| `jquery`          | jQuery (latest bundled)              | Runs in noConflict mode        |
| `jquery-core`     | jQuery core without migrate          | Lighter, no deprecated API shims|
| `wp-api-fetch`    | `@wordpress/api-fetch`               | REST API requests with nonce   |
| `wp-element`      | `@wordpress/element` (React wrapper) | Block Editor components        |
| `wp-data`         | `@wordpress/data`                    | Block Editor state management  |
| `wp-hooks`        | `@wordpress/hooks`                   | JS action/filter system        |
| `wp-i18n`         | `@wordpress/i18n`                    | `__()`, `_n()` for JS          |
| `wp-util`         | `wp.ajax`, `wp.template`             | AJAX helpers, Underscore templates |
| `underscore`      | Underscore.js                        | Utility library                |
| `backbone`        | Backbone.js                          | MV* framework                  |
| `wp-mediaelement` | MediaElement.js                      | Audio/video player             |
| `thickbox`        | ThickBox                             | Modal dialogs                  |

### jQuery in WordPress

WordPress loads jQuery in **noConflict mode** — the `$` shortcut is not available globally.

```js
// WRONG — $ is undefined in noConflict mode.
$( '.my-element' ).hide();

// Option 1: Use the full name.
jQuery( '.my-element' ).hide();

// Option 2: Wrap in an IIFE (recommended).
( function( $ ) {
    $( '.my-element' ).hide();
    $( document ).ready( function() {
        // DOM ready code.
    } );
} )( jQuery );

// Option 3: jQuery ready shorthand.
jQuery( function( $ ) {
    $( '.my-element' ).hide();
} );
```

### Loading Strategies (WordPress 6.3+)

| Strategy  | Behavior                                                 |
|-----------|----------------------------------------------------------|
| `defer`   | Script executes after DOM is constructed, in order       |
| `async`   | Script executes immediately when downloaded, no order    |
| (default) | Blocking — halts parsing until script runs               |

```php
wp_enqueue_script( 'map-analytics', plugins_url( 'assets/js/analytics.js', __FILE__ ), array(), '1.0.0', array(
    'in_footer' => true,
    'strategy'  => 'defer',   // Non-blocking, ordered execution.
) );
```

WordPress automatically adjusts strategies to prevent dependency conflicts. If a
dependency uses blocking, the dependent script cannot use `async`.

---

## 4. AJAX

WordPress routes all AJAX requests through `wp-admin/admin-ajax.php`. The standard
pattern: register `wp_ajax_{action}` (and optionally `wp_ajax_nopriv_{action}`) hooks,
verify the nonce with `check_ajax_referer()`, sanitize input, process data, and return
a JSON response via `wp_send_json_success()` or `wp_send_json_error()`. On the client
side, use `jQuery.post()` with the localized AJAX URL and action name.

<!-- Full PHP handler and jQuery client examples: resources/ajax-patterns.md -->

### Response Functions

| Function                | Use Case                                |
|-------------------------|-----------------------------------------|
| `wp_send_json_success( $data )` | `{ success: true, data: $data }`  |
| `wp_send_json_error( $data )`   | `{ success: false, data: $data }` |
| `wp_send_json( $data )`         | Raw JSON (no success wrapper)     |

All three call `wp_die()` internally — do not `echo` or `exit` after them.

### Nonce Verification

| Function                          | Use Case                                   |
|-----------------------------------|--------------------------------------------|
| `check_ajax_referer( $action, $key )` | Dies on failure (use for AJAX handlers) |
| `wp_verify_nonce( $_POST['nonce'], $action )` | Returns false on failure (manual check) |

### Admin-Only vs Public AJAX

| Hook Pattern                          | Who Can Call                       |
|---------------------------------------|------------------------------------|
| `wp_ajax_{action}`                    | Logged-in users only               |
| `wp_ajax_nopriv_{action}`             | Non-logged-in users only           |
| Both hooks registered                 | All users                          |

Register `nopriv` only if the endpoint must work for anonymous visitors.
Always verify a nonce even on logged-in-only endpoints.

---

## 5. Fetch API & wp.apiFetch (Modern Alternative)

For modern JavaScript (no jQuery dependency), use `wp.apiFetch` or the native
Fetch API with the WordPress REST API instead of admin-ajax.php.

### wp.apiFetch

```js
// Automatically includes X-WP-Nonce header.
wp.apiFetch( { path: '/wp/v2/posts?per_page=5' } )
    .then( function( posts ) {
        console.log( posts );
    } );

// POST request.
wp.apiFetch( {
    path: '/map/v1/settings',
    method: 'POST',
    data: { key: 'value' },
} ).then( function( response ) {
    console.log( response );
} );
```

Requires `wp-api-fetch` as a dependency:

```php
wp_enqueue_script( 'map-modern', plugins_url( 'assets/js/modern.js', __FILE__ ), array( 'wp-api-fetch' ), '1.0.0', true );
```

### Native Fetch with REST API

```js
fetch( mapConfig.apiBase + 'settings', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': mapConfig.nonce,
    },
    body: JSON.stringify( { key: 'value' } ),
} )
.then( r => r.json() )
.then( data => console.log( data ) );
```

### When to Use What

| Approach            | Best For                                         |
|---------------------|--------------------------------------------------|
| admin-ajax.php      | Legacy code, simple form submissions, no REST API |
| `wp.apiFetch`       | Block Editor scripts, admin React UI             |
| Native Fetch + REST | Headless/decoupled, modern JS, custom REST routes|

---

## 6. Heartbeat API

The Heartbeat API provides near-real-time server polling. WordPress uses it for
post locking, autosave, and login session management.

### How It Works

1. Browser fires a "tick" every 15-120 seconds (default: 60s on most pages, 15s on post editor).
2. Client-side code attaches data via `heartbeat-send` event.
3. Server processes data through `heartbeat_received` filter.
4. Client receives response via `heartbeat-tick` event.

<!-- Full send/receive code, interval control, and disabling examples: resources/heartbeat-templates.md -->

### Hooks

| Hook                          | Type   | Side   | Purpose                          |
|-------------------------------|--------|--------|----------------------------------|
| `heartbeat-send`              | Event  | JS     | Attach data before sending       |
| `heartbeat-tick`              | Event  | JS     | Process server response          |
| `heartbeat-error`             | Event  | JS     | Handle connection errors         |
| `heartbeat_received`          | Filter | PHP    | Process data for logged-in users |
| `heartbeat_nopriv_received`   | Filter | PHP    | Process data for logged-out users|
| `heartbeat_settings`          | Filter | PHP    | Modify heartbeat interval        |

### Use Cases

- **Post locking** — warn when another user is editing the same post.
- **Autosave** — periodically save draft content.
- **Session management** — extend logged-in session while user is active.
- **Real-time notifications** — poll for new data without WebSockets.
- **Dashboard widgets** — auto-refresh stats or activity feeds.

---

## 7. wp.template (Underscore Templates)

WordPress bundles `wp-util` which provides `wp.template()` for client-side
HTML rendering using Underscore.js template syntax. Define templates in PHP
using `<script type="text/html" id="tmpl-{name}">` blocks (typically in
`admin_footer`), then render in JavaScript with `wp.template( '{name}' )`.
Requires `wp-util` as a script dependency.

### Template Syntax

| Syntax            | Purpose                             | Example                    |
|-------------------|-------------------------------------|----------------------------|
| `{{ data.val }}`  | Escaped output (XSS-safe)           | `{{ data.title }}`         |
| `{{{ data.val }}}` | Raw HTML output (trust the source) | `{{{ data.html }}}`        |
| `<# code #>`     | JavaScript logic (if/for)           | `<# if (data.x) { #>`     |

<!-- Full PHP template definition and JS rendering examples: resources/heartbeat-templates.md -->

---

## 8. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Outputting `<script>` tags directly | Always use `wp_enqueue_script()` |
| Loading scripts on every admin page | Check `$hook_suffix` in `admin_enqueue_scripts` callback |
| Using `$` without jQuery wrapper | Wrap in `(function($) { ... })(jQuery);` — noConflict mode |
| Hardcoding `admin-ajax.php` URL in JS | Pass via `wp_localize_script()` using `admin_url('admin-ajax.php')` |
| Forgetting nonce in AJAX requests | Always create with `wp_create_nonce()`, verify with `check_ajax_referer()` |
| Echoing after `wp_send_json_*()` | These call `wp_die()` internally — no code runs after them |
| Not registering `nopriv` hook for public AJAX | Frontend AJAX for visitors needs `wp_ajax_nopriv_{action}` |
| Loading jQuery from CDN instead of bundled | Use the WordPress handle `jquery` — prevents version conflicts |
| Using `wp_localize_script()` for non-string data | Use `wp_add_inline_script()` with `wp_json_encode()` instead |
| Heartbeat running at 15s on non-editor pages | Use `heartbeat_settings` filter to slow it down or disable |
| Not declaring script dependencies | List all deps so WordPress loads them in correct order |
| Mixing admin-ajax and REST API unnecessarily | Pick one approach per feature — REST API for new code |
