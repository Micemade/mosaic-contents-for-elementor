# Caching Patterns Code Examples

Detailed code examples for Section 2 of the [wp-performance skill](../SKILL.md).

---

## Page Cache Headers

```php
function set_cache_headers() {
    if ( ! is_user_logged_in() && ! is_admin() ) {
        header( 'Cache-Control: public, max-age=300, s-maxage=3600' );
        header( 'Vary: Accept-Encoding' );
    }
}
add_action( 'send_headers', 'set_cache_headers' );
```

---

## Object Cache (wp_cache) — Cache-Aside Pattern

```php
// Cache-aside pattern.
function get_featured_posts() {
    $cache_key = 'featured_posts_v1';
    $posts     = wp_cache_get( $cache_key, 'my_plugin' );

    if ( false === $posts ) {
        $query = new WP_Query( array(
            'post_type'      => 'post',
            'posts_per_page' => 5,
            'meta_key'       => 'featured',
            'meta_compare'   => 'EXISTS',
        ) );
        $posts = $query->posts;
        wp_cache_set( $cache_key, $posts, 'my_plugin', HOUR_IN_SECONDS );
    }
    return $posts;
}

// Invalidate on update.
add_action( 'save_post', function( $post_id ) {
    wp_cache_delete( 'featured_posts_v1', 'my_plugin' );
} );
```

---

## Object Cache — Batch Lookups

```php
// BAD: Multiple round-trips.
foreach ( $ids as $id ) {
    $data[ $id ] = wp_cache_get( "item_{$id}", 'items' );
}

// GOOD: Single round-trip.
$keys = array_map( fn( $id ) => "item_{$id}", $ids );
$data = wp_cache_get_multiple( $keys, 'items' );
```

---

## Object Cache — Key Versioning for Bulk Invalidation

```php
function get_cache_key( $base ) {
    $version = wp_cache_get( 'cache_version', 'my_plugin' ) ?: 1;
    return "{$base}_v{$version}";
}
function invalidate_all_cache() {
    wp_cache_incr( 'cache_version', 1, 'my_plugin' );
}
```

---

## Transients

**When to use:** Data with known expiration, external API responses, expensive computed results.

**When NOT to use:** Dynamic per-user keys without object cache (creates wp_options bloat), frequently-changing data.

```php
// BAD: Dynamic keys = table bloat without object cache.
set_transient( "user_{$user_id}_cart", $data, HOUR_IN_SECONDS );

// GOOD: Use object cache for user-specific data.
wp_cache_set( "cart_{$user_id}", $data, 'user_carts', HOUR_IN_SECONDS );

// GOOD: Check for object cache before using transients for large data.
if ( wp_using_ext_object_cache() ) {
    set_transient( 'api_response', $data, DAY_IN_SECONDS );
} else {
    // File cache or skip on shared hosting.
}
```

---

## In-Memory / Static Variable Caching (Request-Scoped)

```php
function get_expensive_data( $id ) {
    static $cache = array();
    if ( ! isset( $cache[ $id ] ) ) {
        $cache[ $id ] = expensive_computation( $id );
    }
    return $cache[ $id ];
}
```

---

## Race Conditions: Locking Pattern

```php
function get_expensive_data() {
    $data = wp_cache_get( 'expensive_data' );
    if ( false !== $data ) { return $data; }

    // Acquire lock (atomic).
    if ( wp_cache_add( 'expensive_data_lock', true, '', 30 ) ) {
        $data = expensive_computation();
        wp_cache_set( 'expensive_data', $data, '', 3600 );
        wp_cache_delete( 'expensive_data_lock' );
        return $data;
    }

    // Another process regenerating -- wait and retry.
    usleep( 100000 );
    return get_expensive_data(); // Add max retries in production.
}
```

---

## Stale-While-Revalidate

```php
function get_data_with_stale() {
    $data = wp_cache_get( 'my_data' );
    if ( false !== $data ) { return $data; }

    $stale = wp_cache_get( 'my_data_stale' );
    if ( false !== $stale ) {
        wp_schedule_single_event( time(), 'regenerate_my_data' );
        return $stale; // Serve stale immediately.
    }

    $data = regenerate_data();
    wp_cache_set( 'my_data', $data, '', 300 );
    wp_cache_set( 'my_data_stale', $data, '', 3600 );
    return $data;
}
```

---

## Cache Stampede Prevention

**Jitter:** Randomize TTL by +/-10% so keys do not expire simultaneously.

**Pre-warming via cron:** Regenerate popular caches before they expire.

**Early expiry check:** When cache is in last 10% of TTL, trigger background regeneration while serving current value.
