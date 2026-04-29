# Theme Mods, Site Health, Responsive Images & Advanced Hooks -- Code Examples

---

## Theme Modification API

### Core Functions

```php
// Store a mod for the current theme.
set_theme_mod( 'header_color', '#ff6600' );

// Retrieve with a fallback default.
$color = get_theme_mod( 'header_color', '#000000' );

// Remove a single mod.
remove_theme_mod( 'header_color' );

// Retrieve all mods for the active theme (returns array or empty array).
$all_mods = get_theme_mods();
```

### Customizer Integration

Theme mods are the standard storage backend for the Customizer:

```php
add_action( 'customize_register', function ( WP_Customize_Manager $wp_customize ): void {
    $wp_customize->add_setting( 'map_accent_color', array(
        'default'           => '#0073aa',
        'type'              => 'theme_mod',        // Default -- stored per-theme.
        'sanitize_callback' => 'sanitize_hex_color',
        'transport'         => 'postMessage',       // Live preview via JS.
    ) );

    $wp_customize->add_control( new WP_Customize_Color_Control(
        $wp_customize,
        'map_accent_color',
        array(
            'label'   => __( 'Accent Color', 'my-theme' ),
            'section' => 'colors',
        )
    ) );
} );
```

### Using Theme Mods in Templates

```php
<style>
    .site-header { background-color: <?php echo esc_attr( get_theme_mod( 'header_color', '#fff' ) ); ?>; }
</style>
```

---

## Site Health API

### Custom Tab

```php
add_filter( 'site_health_navigation_tabs', function ( array $tabs ): array {
    $tabs['map-status'] = esc_html__( 'Plugin Status', 'my-plugin' );
    return $tabs;
} );

add_action( 'site_health_tab_content', function ( string $tab ): void {
    if ( 'map-status' !== $tab ) {
        return;
    }
    echo '<div class="health-check-body">';
    // Render tab content.
    echo '</div>';
} );
```

### Custom Status Test

```php
add_filter( 'site_status_tests', function ( array $tests ): array {
    $tests['direct']['map_check'] = array(
        'label' => __( 'My Plugin Check', 'my-plugin' ),
        'test'  => 'map_site_health_test',
    );
    return $tests;
} );

function map_site_health_test(): array {
    $result = array(
        'label'       => __( 'My Plugin is configured', 'my-plugin' ),
        'status'      => 'good',             // good | recommended | critical.
        'badge'       => array(
            'label' => __( 'Performance', 'my-plugin' ),
            'color' => 'blue',               // blue | green | red | orange | purple | gray.
        ),
        'description' => '<p>' . __( 'Everything looks good.', 'my-plugin' ) . '</p>',
        'actions'     => '',                  // HTML for action links.
        'test'        => 'map_check',         // Must match the key above.
    );

    if ( ! get_option( 'map_api_key' ) ) {
        $result['status']      = 'recommended';
        $result['label']       = __( 'My Plugin API key is missing', 'my-plugin' );
        $result['description'] = '<p>' . __( 'Add an API key for full functionality.', 'my-plugin' ) . '</p>';
    }

    return $result;
}
```

### Debug Information Section

```php
add_filter( 'debug_information', function ( array $info ): array {
    $info['my-plugin'] = array(
        'label'  => __( 'My Plugin', 'my-plugin' ),
        'fields' => array(
            'version' => array(
                'label' => __( 'Version', 'my-plugin' ),
                'value' => MAP_VERSION,
            ),
            'api_connected' => array(
                'label' => __( 'API Connected', 'my-plugin' ),
                'value' => get_option( 'map_api_key' ) ? __( 'Yes' ) : __( 'No' ),
            ),
        ),
    );
    return $info;
} );
```

---

## Responsive Images

### Default Behavior

When you use `wp_get_attachment_image()` or insert images in the editor, WordPress
generates markup like:

```html
<img src="image-768x512.jpg"
     srcset="image-300x200.jpg 300w, image-768x512.jpg 768w, image-1024x683.jpg 1024w"
     sizes="(max-width: 768px) 100vw, 768px"
     alt="...">
```

### Key Functions

```php
// Full <img> tag with srcset/sizes.
echo wp_get_attachment_image( $attachment_id, 'medium' );

// Just the srcset value string.
$srcset = wp_get_attachment_image_srcset( $attachment_id, 'medium' );

// Just the sizes value string.
$sizes = wp_get_attachment_image_sizes( $attachment_id, 'medium' );
```

### Custom Image Sizes

```php
add_action( 'after_setup_theme', function (): void {
    add_image_size( 'hero', 1200, 600, true );      // Hard crop.
    add_image_size( 'card', 400, 300, true );
} );
```

New sizes are included in `srcset` automatically if they match the original's aspect ratio.

### Customizing `sizes` Attribute

The default `sizes` assumes full-width (`100vw` up to image width). Override for your layout:

```php
add_filter( 'wp_calculate_image_sizes', function ( string $sizes, array $size, ?string $image_src, ?array $image_meta, int $attachment_id ): string {
    // Two-column layout: images are 50% wide above 768px.
    return '(max-width: 768px) 100vw, 50vw';
}, 10, 5 );
```

### Customizing `srcset` Sources

```php
add_filter( 'wp_calculate_image_srcset', function ( array $sources, array $size_array, string $image_src, array $image_meta, int $attachment_id ): array {
    // Remove sources wider than 1600px.
    foreach ( $sources as $width => $source ) {
        if ( $width > 1600 ) {
            unset( $sources[ $width ] );
        }
    }
    return $sources;
}, 10, 5 );
```

### Max Width

The `max_srcset_image_width` filter caps which sizes appear in `srcset` (default: 2048px):

```php
add_filter( 'max_srcset_image_width', function (): int {
    return 1600; // Don't include anything wider than 1600px.
} );
```

### Lazy Loading

WordPress 5.5+ adds `loading="lazy"` to images and iframes automatically.
Override per-image via the `wp_img_tag_add_loading_optimization_attrs` filter or
by passing `'loading' => 'eager'` to `wp_get_attachment_image()` for above-the-fold images.

---

## Advanced Hooks

### Removing Actions & Filters

Removal must happen after the original `add_action()` has run and at the same priority:

```php
add_action( 'plugins_loaded', function (): void {
    remove_action( 'wp_head', 'wp_generator' );
    remove_filter( 'the_content', 'wpautop' );
} );
```

For class-based hooks, you need the exact instance or use the `$wp_filter` global (fragile).

### Single-Run Guards

```php
add_action( 'save_post', function ( int $post_id ): void {
    if ( did_action( 'save_post' ) > 1 ) {
        return;     // Prevent recursive triggers.
    }
} );
```

### Making Your Plugin Extensible

```php
// Action -- let others react to events.
do_action( 'map_order_processed', $order );

// Filter -- let others modify data.
$name = apply_filters( 'map_display_name', $name, $user_id );
```

Rules: prefix all hook names, document with `@since`/`@param`, pass enough context, never change signatures after release.
