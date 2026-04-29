# AJAX & REST API Security — Detailed Examples

## AJAX Handler Pattern

```php
// Enqueue with nonce
wp_localize_script( 'my-script', 'MyAjax', array(
    'url'   => admin_url( 'admin-ajax.php' ),
    'nonce' => wp_create_nonce( 'my_ajax_action' ),
) );

// Handler
add_action( 'wp_ajax_my_action', 'handle_my_action' );
function handle_my_action() {
    // BAD: no nonce check, no capability check
    // $data = $_POST['data'];

    // GOOD: verify nonce + capability
    check_ajax_referer( 'my_ajax_action', 'nonce' );

    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
    }

    $data = isset( $_POST['data'] )
        ? sanitize_text_field( wp_unslash( $_POST['data'] ) )
        : '';

    // ... process ...

    wp_send_json_success( array( 'result' => $data ) );
}
```

## REST API Route Registration

```php
// BAD: no permission callback (triggers _doing_it_wrong notice)
register_rest_route( 'myplugin/v1', '/items', array(
    'methods'  => 'POST',
    'callback' => 'create_item',
) );

// BAD: __return_true on a write endpoint
register_rest_route( 'myplugin/v1', '/items', array(
    'methods'             => 'POST',
    'callback'            => 'create_item',
    'permission_callback' => '__return_true',
) );

// GOOD: proper permission callback
register_rest_route( 'myplugin/v1', '/items', array(
    'methods'             => 'POST',
    'callback'            => 'create_item',
    'permission_callback' => function( $request ) {
        return current_user_can( 'edit_posts' );
    },
    'args'                => array(
        'title' => array(
            'required'          => true,
            'validate_callback' => function( $value ) {
                return is_string( $value ) && strlen( $value ) <= 200;
            },
            'sanitize_callback' => 'sanitize_text_field',
        ),
    ),
) );
```
