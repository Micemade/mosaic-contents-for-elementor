# Heartbeat API & wp.template — Full Code Examples

Detailed code examples for WordPress Heartbeat send/receive cycle, interval control,
and `wp.template()` Underscore-based client-side rendering.

---

## Heartbeat: Sending Data (JavaScript)

```js
jQuery( document ).on( 'heartbeat-send', function( event, data ) {
    data.map_check_status = {
        postId: mapConfig.postId,
        timestamp: Date.now(),
    };
} );
```

## Heartbeat: Processing on Server (PHP)

```php
add_filter( 'heartbeat_received', 'map_heartbeat_received', 10, 2 );

function map_heartbeat_received( array $response, array $data ): array {
    if ( empty( $data['map_check_status'] ) ) {
        return $response;
    }

    $post_id = absint( $data['map_check_status']['postId'] );
    $post    = get_post( $post_id );

    $response['map_check_status'] = array(
        'modified' => $post ? $post->post_modified : null,
        'status'   => $post ? $post->post_status : 'not_found',
    );

    return $response;
}
```

## Heartbeat: Receiving Response (JavaScript)

```js
jQuery( document ).on( 'heartbeat-tick', function( event, data ) {
    if ( data.map_check_status ) {
        console.log( 'Post status:', data.map_check_status.status );
        console.log( 'Last modified:', data.map_check_status.modified );
    }
} );
```

## Controlling the Interval

```php
add_filter( 'heartbeat_settings', function ( array $settings ): array {
    $settings['interval'] = 30; // Seconds (15–120).
    return $settings;
} );
```

## Disabling Heartbeat

```php
// Disable everywhere except the post editor.
add_action( 'init', function (): void {
    global $pagenow;
    if ( 'post.php' !== $pagenow && 'post-new.php' !== $pagenow ) {
        wp_deregister_script( 'heartbeat' );
    }
} );
```

---

## wp.template: Define Template (PHP)

```php
add_action( 'admin_footer', function (): void {
    ?>
    <script type="text/html" id="tmpl-map-item">
        <div class="map-item" data-id="{{ data.id }}">
            <h3>{{ data.title }}</h3>
            <p>{{{ data.description }}}</p>
            <# if ( data.featured ) { #>
                <span class="map-badge">Featured</span>
            <# } #>
        </div>
    </script>
    <?php
} );
```

## wp.template: Render Template (JavaScript)

```js
( function( $ ) {
    var template = wp.template( 'map-item' ); // Matches id="tmpl-map-item".

    var html = template( {
        id: 42,
        title: 'Sample Item',
        description: '<em>A great item.</em>',
        featured: true,
    } );

    $( '#map-container' ).append( html );
} )( jQuery );
```

Requires `wp-util` dependency:

```php
wp_enqueue_script( 'map-admin', '...', array( 'jquery', 'wp-util' ), '1.0.0', true );
```
