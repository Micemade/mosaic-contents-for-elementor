# Custom Post Types, HTTP API & WP-Cron -- Code Examples

---

## Custom Post Types & Taxonomies

### Registering a Custom Post Type

```php
add_action( 'init', 'map_register_post_types' );

function map_register_post_types(): void {
    register_post_type( 'map_portfolio', array(
        'labels'             => array(
            'name'               => __( 'Portfolio', 'my-plugin' ),
            'singular_name'      => __( 'Project', 'my-plugin' ),
            'add_new_item'       => __( 'Add New Project', 'my-plugin' ),
            'edit_item'          => __( 'Edit Project', 'my-plugin' ),
            'not_found'          => __( 'No projects found.', 'my-plugin' ),
            'not_found_in_trash' => __( 'No projects found in Trash.', 'my-plugin' ),
        ),
        'public'             => true,
        'has_archive'        => true,
        'show_in_rest'       => true,       // Required for Block Editor + REST API.
        'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
        'rewrite'            => array( 'slug' => 'portfolio' ),
        'menu_icon'          => 'dashicons-portfolio',
        'capability_type'    => 'post',
    ) );
}
```

### Registering a Custom Taxonomy

```php
add_action( 'init', 'map_register_taxonomies' );

function map_register_taxonomies(): void {
    register_taxonomy( 'map_skill', array( 'map_portfolio' ), array(
        'labels'            => array(
            'name'          => __( 'Skills', 'my-plugin' ),
            'singular_name' => __( 'Skill', 'my-plugin' ),
            'add_new_item'  => __( 'Add New Skill', 'my-plugin' ),
        ),
        'hierarchical'      => true,       // true = categories, false = tags.
        'show_in_rest'      => true,       // Block Editor support.
        'rewrite'           => array( 'slug' => 'skill' ),
        'show_admin_column' => true,       // Column in post list table.
    ) );
}
```

### Flushing Rewrite Rules

Rewrite rules are cached. Flush on activation only -- never on every request:

```php
register_activation_hook( __FILE__, function (): void {
    map_register_post_types();
    map_register_taxonomies();
    flush_rewrite_rules();
} );
```

---

## HTTP API

### GET Request

```php
$response = wp_remote_get( 'https://api.example.com/data', array(
    'timeout' => 15,
    'headers' => array(
        'Authorization' => 'Bearer ' . $api_key,
        'Accept'        => 'application/json',
    ),
) );

if ( is_wp_error( $response ) ) {
    return new WP_Error( 'api_failure', $response->get_error_message() );
}

$code = wp_remote_retrieve_response_code( $response );
if ( $code < 200 || $code >= 300 ) {
    return new WP_Error( 'api_http_error', "HTTP {$code}" );
}

$data = json_decode( wp_remote_retrieve_body( $response ), true );
```

### POST Request

```php
$response = wp_remote_post( 'https://api.example.com/submit', array(
    'timeout' => 30,
    'body'    => wp_json_encode( array( 'name' => 'Alice' ) ),
    'headers' => array( 'Content-Type' => 'application/json' ),
) );
```

### Caching External Requests with Transients

```php
function map_get_external_data(): array {
    $cached = get_transient( 'map_api_data' );
    if ( false !== $cached ) {
        return $cached;
    }

    $response = wp_remote_get( 'https://api.example.com/data' );
    if ( is_wp_error( $response ) ) {
        return array();
    }

    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( ! is_array( $data ) ) {
        return array();
    }

    set_transient( 'map_api_data', $data, HOUR_IN_SECONDS );
    return $data;
}
```

---

## WP-Cron

### Scheduling a Recurring Event

```php
register_activation_hook( __FILE__, 'map_activate_cron' );

function map_activate_cron(): void {
    if ( ! wp_next_scheduled( 'map_daily_cleanup' ) ) {
        wp_schedule_event( time(), 'daily', 'map_daily_cleanup' );
    }
}

add_action( 'map_daily_cleanup', 'map_run_cleanup' );
function map_run_cleanup(): void { /* daily maintenance */ }
```

### Single Event

```php
wp_schedule_single_event( time() + 300, 'map_deferred_task', array( $post_id ) );
add_action( 'map_deferred_task', function ( int $post_id ): void { /* runs once */ } );
```

### Custom Intervals

```php
add_filter( 'cron_schedules', function ( array $schedules ): array {
    $schedules['map_five_minutes'] = array(
        'interval' => 300,
        'display'  => __( 'Every 5 Minutes', 'my-plugin' ),
    );
    return $schedules;
} );
```

### Cleanup on Deactivation

```php
register_deactivation_hook( __FILE__, function (): void {
    $timestamp = wp_next_scheduled( 'map_daily_cleanup' );
    if ( $timestamp ) {
        wp_unschedule_event( $timestamp, 'map_daily_cleanup' );
    }
} );
```

### Real Cron for Production

WP-Cron is triggered by page visits -- unreliable on low-traffic sites:

```php
// wp-config.php -- disable virtual cron.
define( 'DISABLE_WP_CRON', true );
```

```bash
# System crontab -- trigger WP-Cron every minute via WP-CLI.
* * * * * cd /var/www/html && wp cron event run --due-now > /dev/null 2>&1
```
