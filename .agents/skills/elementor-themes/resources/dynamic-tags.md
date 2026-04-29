# Dynamic Tags — Code Examples

### Simple Example: Random Number

```php
class Elementor_Dynamic_Tag_Random_Number extends \Elementor\Core\DynamicTags\Tag {
    public function get_name(): string { return 'random-number'; }
    public function get_title(): string { return esc_html__( 'Random Number', 'textdomain' ); }
    public function get_group(): array { return [ 'actions' ]; }
    public function get_categories(): array {
        return [ \Elementor\Modules\DynamicTags\Module::NUMBER_CATEGORY ];
    }
    public function render(): void { echo rand(); }
}
```

### Advanced Example: ACF Average

Uses `register_controls()` with a text control and `get_settings()` in `render()`.

```php
class Elementor_Dynamic_Tag_ACF_Average extends \Elementor\Core\DynamicTags\Tag {
    public function get_name(): string { return 'acf-average'; }
    public function get_title(): string { return esc_html__( 'ACF Average', 'textdomain' ); }
    public function get_group(): array { return [ 'site' ]; }
    public function get_categories(): array {
        return [ \Elementor\Modules\DynamicTags\Module::TEXT_CATEGORY ];
    }
    protected function register_controls(): void {
        $this->add_control( 'fields', [
            'label' => esc_html__( 'Fields', 'textdomain' ),
            'type' => 'text',
        ] );
    }
    public function render(): void {
        $fields = $this->get_settings( 'fields' );
        if ( ! function_exists( 'get_field' ) ) { echo 0; return; }
        $sum = 0; $count = 0;
        foreach ( explode( ',', $fields ) as $field_name ) {
            $field = get_field( $field_name );
            if ( (int) $field > 0 ) { $sum += (int) $field; $count++; }
        }
        echo ( 0 !== $count ) ? $sum / $count : 0;
    }
}
```

### Complex Example: Server Variables

Uses `Controls_Manager::SELECT` with dynamically built options from `$_SERVER`.

```php
class Elementor_Dynamic_Tag_Server_Variable extends \Elementor\Core\DynamicTags\Tag {
    public function get_name(): string { return 'server-variable'; }
    public function get_title(): string { return esc_html__( 'Server Variable', 'textdomain' ); }
    public function get_group(): array { return [ 'request-variables' ]; }
    public function get_categories(): array {
        return [ \Elementor\Modules\DynamicTags\Module::TEXT_CATEGORY ];
    }
    protected function register_controls(): void {
        $variables = [];
        foreach ( array_keys( $_SERVER ) as $variable ) {
            $variables[ $variable ] = ucwords( str_replace( '_', ' ', $variable ) );
        }
        $this->add_control( 'user_selected_variable', [
            'type' => \Elementor\Controls_Manager::SELECT,
            'label' => esc_html__( 'Variable', 'textdomain' ),
            'options' => $variables,
        ] );
    }
    public function render(): void {
        $var = $this->get_settings( 'user_selected_variable' );
        if ( ! $var || ! isset( $_SERVER[ $var ] ) ) { return; }
        echo wp_kses_post( $_SERVER[ $var ] );
    }
}
```

### Unregistering Dynamic Tags

```php
function unregister_dynamic_tags( $dynamic_tags_manager ) {
    $dynamic_tags_manager->unregister( 'dynamic-tag-name' );
}
add_action( 'elementor/dynamic_tags/register', 'unregister_dynamic_tags' );
```
