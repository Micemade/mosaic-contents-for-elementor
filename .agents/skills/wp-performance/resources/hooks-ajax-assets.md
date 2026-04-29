# Hooks, AJAX, Assets & Cron Code Examples

Detailed code examples for Sections 3, 4, 5, 7, and 8 of the [wp-performance skill](../SKILL.md).

---

## Section 3: Hooks & Actions Anti-Patterns

### Expensive Code on init / wp_loaded (WARNING)

```php
// BAD: HTTP call on every request.
add_action( 'init', function() {
    $data = wp_remote_get( 'https://api.example.com/data' );
} );

// GOOD: Cache the result.
add_action( 'init', function() {
    $data = get_transient( 'prefix_external_data' );
    if ( false === $data ) {
        $response = wp_remote_get( 'https://api.example.com/data' );
        if ( ! is_wp_error( $response ) ) {
            $data = wp_remote_retrieve_body( $response );
            set_transient( 'prefix_external_data', $data, HOUR_IN_SECONDS );
        }
    }
} );
```

### Database Writes on Frontend Page Loads (CRITICAL)

```php
// BAD: DB write on every page view.
add_action( 'wp_head', function() {
    update_option( 'page_views', get_option( 'page_views', 0 ) + 1 );
} );

// GOOD: Buffer in object cache, flush via cron.
add_action( 'shutdown', function() {
    wp_cache_incr( 'page_views_buffer', 1, 'counters' );
} );
```

### Conditional Loading Patterns

```php
// BAD: Runs on admin AND frontend.
add_action( 'init', 'prefix_frontend_only_function' );

// GOOD: Use appropriate hook.
add_action( 'template_redirect', 'prefix_frontend_only_function' );

// GOOD: Guard with context check.
add_action( 'init', function() {
    if ( is_admin() || wp_doing_cron() ) { return; }
    // Frontend-only code.
} );
```

---

## Section 4: AJAX & External Requests

### REST API Over admin-ajax.php

```php
// BAD: admin-ajax.php loads full WP including admin_init hooks.
add_action( 'wp_ajax_nopriv_get_posts', 'prefix_ajax_handler' );

// GOOD: REST API has leaner bootstrap.
add_action( 'rest_api_init', function() {
    register_rest_route( 'prefix/v1', '/posts', array(
        'methods'             => 'GET',
        'callback'            => 'prefix_rest_get_posts',
        'permission_callback' => '__return_true',
    ) );
} );
```

### No AJAX Polling (CRITICAL)

```javascript
// BAD: Self-DDoS. Every user hits server every 5 seconds.
setInterval(() => fetch('/wp-json/myapp/v1/updates'), 5000);

// GOOD: Use WebSockets, SSE, or long-polling with exponential backoff.
```

### Cache External HTTP Requests

```php
// BAD: Blocks page render, no timeout.
$response = wp_remote_get( $url );

// GOOD: Timeout + cache + error handling.
function prefix_get_api_data( $url ) {
    $cached = wp_cache_get( 'api_' . md5( $url ), 'external' );
    if ( false !== $cached ) { return $cached; }

    $response = wp_remote_get( $url, array( 'timeout' => 2 ) );
    if ( is_wp_error( $response ) ) { return get_fallback_data(); }

    $body = wp_remote_retrieve_body( $response );
    wp_cache_set( 'api_' . md5( $url ), $body, 'external', 300 );
    return $body;
}
```

### Batch External API Calls

Move heavy remote work to cron/queue. Never call external APIs synchronously on every page load.

---

## Section 5: Asset Loading

### Conditional Enqueue

```php
// BAD: Assets load globally.
add_action( 'wp_enqueue_scripts', function() {
    wp_enqueue_script( 'contact-form-js', get_template_directory_uri() . '/js/contact.js' );
} );

// GOOD: Only load on pages that need it.
add_action( 'wp_enqueue_scripts', function() {
    if ( is_page( 'contact' ) ) {
        wp_enqueue_script( 'contact-form-js', get_template_directory_uri() . '/js/contact.js' );
    }
} );
```

### Script Loading Strategy (WordPress 6.3+)

```php
// BAD: Blocks rendering (default).
wp_enqueue_script( 'my-script', $url );

// GOOD: Non-blocking with defer.
wp_enqueue_script( 'my-script', $url, array(), '1.0.0', array(
    'strategy' => 'defer',
) );
```

### Bundle Splitting

```javascript
// BAD: Full lodash (~70KB).
import _ from 'lodash';

// GOOD: Import only what you need (~2KB).
import map from 'lodash/map';
```

### Version Strings

```php
// BAD: No version -- stale assets after deploy.
wp_enqueue_script( 'my-script', $url );

// GOOD: Use theme version constant.
define( 'THEME_VERSION', '1.0.0' );
wp_enqueue_script( 'my-script', $url, array(), THEME_VERSION );
```

---

## Section 7: WP-Cron

### Disable Default WP-Cron

```php
// In wp-config.php:
define( 'DISABLE_WP_CRON', true );
// Server crontab:
// * * * * * cd /path/to/wp && wp cron event run --due-now
```

### Batch Processing

```php
// BAD: Process all 50k users in one cron run.
add_action( 'my_daily_sync', function() {
    foreach ( get_users() as $user ) { sync_user_data( $user ); }
} );

// GOOD: Process in batches, reschedule.
add_action( 'my_batch_sync', function() {
    $offset = (int) get_option( 'sync_offset', 0 );
    $users  = get_users( array( 'number' => 100, 'offset' => $offset ) );
    if ( empty( $users ) ) { delete_option( 'sync_offset' ); return; }
    foreach ( $users as $user ) { sync_user_data( $user ); }
    update_option( 'sync_offset', $offset + 100 );
    wp_schedule_single_event( time() + 60, 'my_batch_sync' );
} );
```

### Always Check Before Scheduling

```php
// BAD: Creates duplicate schedules.
wp_schedule_event( time(), 'hourly', 'my_task' );

// GOOD:
if ( ! wp_next_scheduled( 'my_task' ) ) {
    wp_schedule_event( time(), 'hourly', 'my_task' );
}
```

---

## Section 8: Uncached Function Calls — Caching Wrapper

### Generic Caching Wrapper

```php
function prefix_cached_url_to_postid( $url ) {
    $cache_key = 'url_to_postid_' . md5( $url );
    $post_id   = wp_cache_get( $cache_key, 'url_lookups' );
    if ( false === $post_id ) {
        $post_id = url_to_postid( $url );
        wp_cache_set( $cache_key, $post_id, 'url_lookups', HOUR_IN_SECONDS );
    }
    return $post_id;
}
```

### VIP Platform Helpers

On WordPress VIP, use built-in cached alternatives:

```php
// Instead of:                          // Use:
url_to_postid( $url )                   wpcom_vip_url_to_postid( $url )
attachment_url_to_postid( $url )        wpcom_vip_attachment_url_to_postid( $url )
count_user_posts( $uid )                wpcom_vip_count_user_posts( $uid )
get_adjacent_post()                     wpcom_vip_get_adjacent_post()
wp_oembed_get( $url )                   wpcom_vip_wp_oembed_get( $url )
wp_remote_get( $url )                   vip_safe_wp_remote_get( $url )
```
