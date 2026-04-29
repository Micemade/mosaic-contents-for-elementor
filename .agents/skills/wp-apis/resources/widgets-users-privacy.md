# Dashboard Widgets, Users & Roles, Privacy API -- Code Examples

---

## Dashboard Widgets

```php
add_action( 'wp_dashboard_setup', 'map_add_dashboard_widget' );

function map_add_dashboard_widget(): void {
    wp_add_dashboard_widget(
        'map_status_widget',                     // Widget ID.
        __( 'Plugin Status', 'my-plugin' ),      // Title.
        'map_render_status_widget'                // Render callback.
    );
}

function map_render_status_widget(): void {
    $count = wp_count_posts( 'map_portfolio' );
    printf(
        '<p>%s</p>',
        sprintf( esc_html__( 'Published projects: %d', 'my-plugin' ), absint( $count->publish ) )
    );
}
```

For side column placement, use `add_meta_box()` with `'dashboard'` screen and `'side'` context.

### Removing Default Widgets

```php
add_action( 'wp_dashboard_setup', function (): void {
    remove_meta_box( 'dashboard_quick_press', 'dashboard', 'side' );
    remove_meta_box( 'dashboard_primary', 'dashboard', 'side' );
} );
```

---

## Users & Roles

### Adding a Custom Role

```php
// Run once on activation -- roles persist in the database.
register_activation_hook( __FILE__, function (): void {
    add_role( 'map_project_manager', __( 'Project Manager', 'my-plugin' ), array(
        'read'         => true,
        'edit_posts'   => true,
        'delete_posts' => true,
        'publish_posts' => true,
        'upload_files'  => true,
    ) );
} );

// Clean up on uninstall.
register_uninstall_hook( __FILE__, function (): void {
    remove_role( 'map_project_manager' );
} );
```

### Custom Capabilities

```php
// Add on activation:
$admin = get_role( 'administrator' );
if ( $admin ) {
    $admin->add_cap( 'manage_map_settings' );
}

// Check in code:
if ( current_user_can( 'manage_map_settings' ) ) { /* admin-only UI */ }
```

### User Meta

```php
update_user_meta( $user_id, '_map_onboarded', '1' );           // Store.
$val = get_user_meta( $user_id, '_map_onboarded', true );       // Retrieve.
delete_user_meta( $user_id, '_map_onboarded' );                 // Delete.
```

### Querying Users

```php
$query = new WP_User_Query( array(
    'role'       => 'map_project_manager',
    'orderby'    => 'registered',
    'order'      => 'DESC',
    'number'     => 20,
    'meta_query' => array(                    // phpcs:ignore WordPress.DB.SlowDBQuery
        array( 'key' => '_map_onboarded', 'value' => '1', 'compare' => '=' ),
    ),
) );

foreach ( $query->get_results() as $user ) { /* WP_User */ }
```

---

## Privacy API

WordPress 4.9.6+ includes GDPR/privacy tools. Plugins storing personal data
should register exporters and erasers.

### Personal Data Exporter

```php
add_filter( 'wp_privacy_personal_data_exporters', function ( array $exporters ): array {
    $exporters['my-plugin'] = array(
        'exporter_friendly_name' => __( 'My Plugin Data', 'my-plugin' ),
        'callback'               => 'map_privacy_exporter',
    );
    return $exporters;
} );

function map_privacy_exporter( string $email, int $page = 1 ): array {
    $user = get_user_by( 'email', $email );
    $data = array();

    if ( $user ) {
        $pref = get_user_meta( $user->ID, '_map_preference', true );
        if ( $pref ) {
            $data[] = array(
                'group_id'    => 'map-preferences',
                'group_label' => __( 'Plugin Preferences', 'my-plugin' ),
                'item_id'     => "map-pref-{$user->ID}",
                'data'        => array(
                    array( 'name' => __( 'Preference', 'my-plugin' ), 'value' => $pref ),
                ),
            );
        }
    }

    return array( 'data' => $data, 'done' => true );
    // Set 'done' => false and increment $page for large datasets.
}
```

### Personal Data Eraser

Same pattern -- register via `wp_privacy_personal_data_erasers` filter. Callback returns:

```php
return array(
    'items_removed'  => $count,    // How many items were erased.
    'items_retained' => 0,         // Items kept (with reason in 'messages').
    'messages'       => array(),   // Human-readable notes.
    'done'           => true,      // false + $page for pagination.
);
```

### Privacy Policy Suggestion

```php
add_action( 'admin_init', function (): void {
    if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
        wp_add_privacy_policy_content(
            __( 'My Plugin', 'my-plugin' ),
            wp_kses_post( __( '<p>This plugin stores your preferences.</p>', 'my-plugin' ) )
        );
    }
} );
```
