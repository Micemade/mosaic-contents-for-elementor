# Settings API — Full Settings_Page Class

Complete implementation of a WordPress Settings API page with menu registration,
field rendering, and sanitization.

## Registering Settings

```php
namespace MyAwesomePlugin\Admin;

class Settings_Page {

    public function register(): void {
        add_action( 'admin_menu', [ $this, 'add_menu' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
    }

    public function add_menu(): void {
        add_options_page(
            __( 'My Awesome Plugin', 'my-awesome-plugin' ),   // Page title
            __( 'My Plugin', 'my-awesome-plugin' ),            // Menu title
            'manage_options',                                   // Capability
            'my-awesome-plugin',                                // Menu slug
            [ $this, 'render_page' ]                           // Callback
        );
    }

    public function register_settings(): void {
        register_setting(
            'map_options_group',       // Option group
            'map_settings',            // Option name
            [
                'type'              => 'array',
                'sanitize_callback' => [ $this, 'sanitize' ],
                'default'           => [],
            ]
        );

        add_settings_section(
            'map_general',
            __( 'General Settings', 'my-awesome-plugin' ),
            '__return_null',
            'my-awesome-plugin'
        );

        add_settings_field(
            'map_api_key',
            __( 'API Key', 'my-awesome-plugin' ),
            [ $this, 'render_api_key_field' ],
            'my-awesome-plugin',
            'map_general'
        );

        add_settings_field(
            'map_max_results',
            __( 'Max Results', 'my-awesome-plugin' ),
            [ $this, 'render_max_results_field' ],
            'my-awesome-plugin',
            'map_general'
        );
    }

    public function sanitize( $input ): array {
        $clean = [];
        $clean['api_key']     = sanitize_text_field( $input['api_key'] ?? '' );
        $clean['max_results'] = absint( $input['max_results'] ?? 10 );
        $clean['enabled']     = ! empty( $input['enabled'] );
        return $clean;
    }

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields( 'map_options_group' );
                do_settings_sections( 'my-awesome-plugin' );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    public function render_api_key_field(): void {
        $options = get_option( 'map_settings', [] );
        printf(
            '<input type="text" name="map_settings[api_key]" value="%s" class="regular-text" />',
            esc_attr( $options['api_key'] ?? '' )
        );
    }

    public function render_max_results_field(): void {
        $options = get_option( 'map_settings', [] );
        printf(
            '<input type="number" name="map_settings[max_results]" value="%d" min="1" max="100" />',
            absint( $options['max_results'] ?? 10 )
        );
    }
}
```
