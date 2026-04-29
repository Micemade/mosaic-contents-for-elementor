# Administration Menus, Shortcodes & Custom Meta Boxes -- Code Examples

---

## Administration Menus

### Top-Level Menu

```php
add_action( 'admin_menu', 'map_register_menus' );

function map_register_menus(): void {
    add_menu_page(
        __( 'My Plugin', 'my-plugin' ),   // Page title (<title> tag).
        __( 'My Plugin', 'my-plugin' ),   // Menu label.
        'manage_options',                  // Capability required.
        'my-plugin',                       // Menu slug (unique).
        'map_render_admin_page',           // Callback that outputs page HTML.
        'dashicons-admin-generic',         // Icon URL or dashicon class.
        80                                 // Position (lower = higher).
    );
}
```

### Submenus

```php
add_submenu_page(
    'my-plugin',                         // Parent slug.
    __( 'Settings', 'my-plugin' ),       // Page title.
    __( 'Settings', 'my-plugin' ),       // Menu label.
    'manage_options',                     // Capability.
    'my-plugin-settings',                // Submenu slug.
    'map_render_settings_page'           // Callback.
);
```

### Form Processing Pattern

Use `load-{$hook_suffix}` to process form submissions before output:

```php
function map_register_menus(): void {
    $hook = add_menu_page( /* ... */ );
    add_action( "load-{$hook}", 'map_handle_form_submit' );
}

function map_handle_form_submit(): void {
    if ( 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
        return;
    }
    check_admin_referer( 'map_save_action', 'map_nonce' );
    wp_safe_redirect( add_query_arg( 'updated', '1', wp_get_referer() ) );
    exit;
}
```

### Removing Menus

```php
remove_menu_page( 'edit-comments.php' );
remove_submenu_page( 'options-general.php', 'options-writing.php' );
```

---

## Shortcodes

### Registration

```php
add_shortcode( 'map_greeting', 'map_greeting_shortcode' );

// Handler: ($atts, $content, $tag) -- always RETURN, never echo.
function map_greeting_shortcode( $atts, $content = null, $tag = '' ): string {
    $atts = shortcode_atts(
        array(
            'name'  => 'World',
            'color' => 'blue',
        ),
        $atts,
        $tag  // Enables the shortcode_atts_{$tag} filter for overrides.
    );

    return sprintf(
        '<span style="color:%s">Hello, %s!</span>',
        esc_attr( $atts['color'] ),
        esc_html( $atts['name'] )
    );
}
```

### Self-Closing vs Enclosing

```
[map_greeting name="Alice"]                         <!-- Self-closing -->
[map_box]This is wrapped content.[/map_box]         <!-- Enclosing -->
```

For enclosing shortcodes, call `do_shortcode( $content )` to process nested shortcodes:

```php
function map_box_shortcode( $atts, $content = null ): string {
    return '<div class="map-box">' . do_shortcode( (string) $content ) . '</div>';
}
```

---

## Custom Meta Boxes

### Registering

```php
add_action( 'add_meta_boxes', 'map_add_meta_boxes' );

function map_add_meta_boxes(): void {
    add_meta_box(
        'map_details',                      // Unique ID.
        __( 'Extra Details', 'my-plugin' ), // Box title.
        'map_render_details_meta_box',      // Render callback.
        'post',                             // Screen (post type or array of types).
        'side',                             // Context: normal | side | advanced.
        'high'                              // Priority: high | core | default | low.
    );
}
```

### Rendering

```php
function map_render_details_meta_box( WP_Post $post ): void {
    $value = get_post_meta( $post->ID, '_map_detail', true );
    wp_nonce_field( 'map_save_detail', 'map_detail_nonce' );
    printf(
        '<label for="map-detail">%s</label>
         <input type="text" id="map-detail" name="map_detail" value="%s" class="widefat" />',
        esc_html__( 'Detail:', 'my-plugin' ),
        esc_attr( $value )
    );
}
```

### Saving

```php
add_action( 'save_post', 'map_save_detail_meta', 10, 2 );

function map_save_detail_meta( int $post_id, WP_Post $post ): void {
    if ( ! isset( $_POST['map_detail_nonce'] )
        || ! wp_verify_nonce( $_POST['map_detail_nonce'], 'map_save_detail' )
    ) {
        return;
    }
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
        return;
    }
    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return;
    }
    if ( isset( $_POST['map_detail'] ) ) {
        update_post_meta(
            $post_id,
            '_map_detail',
            sanitize_text_field( wp_unslash( $_POST['map_detail'] ) )
        );
    }
}
```

### OOP Pattern

```php
class MAP_Detail_Meta_Box {
    public static function register(): void {
        add_action( 'add_meta_boxes', array( __CLASS__, 'add' ) );
        add_action( 'save_post', array( __CLASS__, 'save' ), 10, 2 );
    }
    public static function add(): void { /* add_meta_box(...) */ }
    public static function render( WP_Post $post ): void { /* output fields */ }
    public static function save( int $post_id, WP_Post $post ): void { /* verify nonce + save */ }
}
MAP_Detail_Meta_Box::register();
```

### Removing Meta Boxes

```php
remove_meta_box( 'postcustom', 'post', 'normal' );   // Custom Fields.
remove_meta_box( 'slugdiv', 'post', 'normal' );      // Slug.
```
