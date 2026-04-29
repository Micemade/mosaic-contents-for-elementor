# PHP Hooks Code Examples

Code examples for Sections 1 and 2 of the Elementor Hooks Reference.

---

## Lifecycle

```php
// Wait for Elementor to fully load before running addon code
add_action( 'elementor/loaded', function() {
    // Elementor is available but not yet initialized
});

add_action( 'elementor/init', function() {
    // Elementor is fully initialized - safe to use all APIs
});
```

## Registration

```php
// Register a custom widget
add_action( 'elementor/widgets/register', function( $widgets_manager ) {
    $widgets_manager->register( new \My_Custom_Widget() );
});

// Register a custom widget category
add_action( 'elementor/elements/categories_registered', function( $elements_manager ) {
    $elements_manager->add_category( 'my-category', [
        'title' => esc_html__( 'My Category', 'textdomain' ),
        'icon'  => 'fa fa-plug',
    ]);
});
```

## Frontend Scripts and Styles

```php
// Register a frontend script
add_action( 'elementor/frontend/after_register_scripts', function() {
    wp_register_script( 'my-script', plugins_url( 'js/my-script.js', __FILE__ ), [ 'jquery' ], '1.0.0', true );
});

// Enqueue a frontend style
add_action( 'elementor/frontend/after_enqueue_styles', function() {
    wp_enqueue_style( 'my-style', plugins_url( 'css/my-style.css', __FILE__ ) );
});
```

## Editor Scripts and Styles

```php
add_action( 'elementor/editor/after_enqueue_scripts', function() {
    wp_enqueue_script( 'my-editor-script', plugins_url( 'js/editor.js', __FILE__ ), [ 'elementor-editor' ], '1.0.0', true );
});
```

## Widget Rendering

```php
// Add custom skin to Google Maps widget
add_action( 'elementor/widget/google_maps/skins_init', function( $widget ) {
    $widget->add_skin( new \MySkins\Skin_Dark_Map( $widget ) );
});

// Add a custom attribute to elements with a specific setting
add_action( 'elementor/frontend/before_render', function( $element ) {
    if ( ! $element->get_settings( 'my-custom-setting' ) ) {
        return;
    }
    $element->add_render_attribute( '_wrapper', [
        'class'                => 'my-custom-class',
        'data-my-custom-value' => 'my-custom-data-value',
    ]);
});

// Add HTML before all widgets
add_action( 'elementor/frontend/widget/before_render', function( $element ) {
    echo '<div class="before-widget">Before widget</div>';
});
```

## Document and Editor Save

```php
add_action( 'elementor/editor/after_save', function( $post_id, $editor_data ) {
    // Clear cache after Elementor save
    if ( get_post_status( $post_id ) === 'publish' ) {
        clear_cache_for_post( $post_id );
    }
}, 10, 2 );
```

## CSS File Hooks

```php
add_action( 'elementor/element/parse_css', function( $post_css_file, $element ) {
    $post_css_file->get_stylesheet()->add_rules(
        $element->get_unique_selector(),
        [ 'width' => '50px', 'height' => '50px' ]
    );
}, 10, 2 );
```

## Forms (Pro)

```php
// Validate a custom field format
add_action( 'elementor_pro/forms/validation', function( $record, $ajax_handler ) {
    $fields = $record->get_field( [ 'id' => 'ticket_id' ] );
    if ( empty( $fields ) ) return;
    $field = current( $fields );
    if ( 1 !== preg_match( '/^\w{3}-\w{4}$/', $field['value'] ) ) {
        $ajax_handler->add_error( $field['id'], 'Invalid Ticket ID, must be XXX-XXXX' );
    }
}, 10, 2 );

// Send data to external API after form submission
add_action( 'elementor_pro/forms/new_record', function( $record, $handler ) {
    if ( 'MY_FORM_NAME' !== $record->get_form_settings( 'form_name' ) ) return;
    $raw_fields = $record->get( 'fields' );
    $fields = [];
    foreach ( $raw_fields as $id => $field ) {
        $fields[ $id ] = $field['value'];
    }
    wp_remote_post( 'https://api.example.com/', [ 'body' => $fields ] );
}, 10, 2 );
```

## Query (Pro)

```php
add_action( 'elementor/query/my_custom_filter', function( $query ) {
    $query->set( 'post_type', [ 'custom-post-type1', 'custom-post-type2' ] );
});
```

---

## Widget Output Filters

```php
// Add icon to heading widgets with external links
add_filter( 'elementor/widget/render_content', function( $content, $widget ) {
    if ( 'heading' === $widget->get_name() ) {
        $settings = $widget->get_settings();
        if ( ! empty( $settings['link']['is_external'] ) ) {
            $content .= '<i class="fa fa-external-link" aria-hidden="true"></i>';
        }
    }
    return $content;
}, 10, 2 );

// Restrict content via membership check
add_filter( 'elementor/frontend/the_content', function( $content ) {
    if ( ! membership_plugin_is_content_allowed() ) {
        return esc_html__( 'Forbidden', 'textdomain' );
    }
    return $content;
});
```

## Visual Element Filters

```php
// Disable Google Fonts
add_filter( 'elementor/frontend/print_google_fonts', '__return_false' );

// Add custom shape dividers
add_filter( 'elementor/shapes/additional_shapes', function() {
    return [
        'my-shape' => [
            'title'       => esc_html__( 'My Shape', 'textdomain' ),
            'url'         => PLUGIN_URL . 'shapes/my-shape.svg',
            'path'        => PLUGIN_PATH . 'shapes/my-shape.svg',
            'has_flip'    => true,
            'has_negative' => true,
            'height_only' => true,
        ],
    ];
});

// Add custom mask shapes
add_filter( 'elementor/mask_shapes/additional_shapes', function() {
    return [
        'my-mask' => [
            'title' => esc_html__( 'My Mask', 'textdomain' ),
            'image' => PLUGIN_URL . 'masks/my-mask.svg',
        ],
    ];
});

// Change placeholder image
add_filter( 'elementor/utils/get_placeholder_image_src', function() {
    return plugins_url( 'assets/images/placeholder.png', __FILE__ );
});
```

## Forms Filters (Pro)

```php
// Set font-display to swap for custom fonts
add_filter( 'elementor_pro/custom_fonts/font_display', function() {
    return 'swap';
});
```
