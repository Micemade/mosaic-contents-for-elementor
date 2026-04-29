# Injecting Controls Code Examples

Code examples for Section 3 of the Elementor Hooks Reference.

---

## Targeting All Elements

```php
// Add a control inside an existing section (all elements)
add_action( 'elementor/element/after_section_start', function( $element, $section_id, $args ) {
    if ( 'section' === $element->get_name() && 'section_background' === $section_id ) {
        $element->add_control( 'custom_control', [
            'type'  => \Elementor\Controls_Manager::NUMBER,
            'label' => esc_html__( 'Custom Control', 'textdomain' ),
        ]);
    }
}, 10, 3 );
```

## Targeting Specific Elements

```php
// Add a new section before the heading widget's title section
add_action( 'elementor/element/heading/section_title/before_section_start', function( $element, $args ) {
    $element->start_controls_section( 'custom_section', [
        'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
        'label' => esc_html__( 'Custom Section', 'textdomain' ),
    ]);
    $element->add_control( 'custom_control', [
        'type'  => \Elementor\Controls_Manager::NUMBER,
        'label' => esc_html__( 'Custom Control', 'textdomain' ),
    ]);
    $element->end_controls_section();
}, 10, 2 );
```

## Page Settings

```php
// Add control to page settings
add_action( 'elementor/documents/register_controls', function( $document ) {
    $document->start_controls_section( 'my_custom_section', [
        'tab'   => \Elementor\Controls_Manager::TAB_SETTINGS,
        'label' => esc_html__( 'My Settings', 'textdomain' ),
    ]);
    $document->add_control( 'my_setting', [
        'type'  => \Elementor\Controls_Manager::TEXT,
        'label' => esc_html__( 'My Setting', 'textdomain' ),
    ]);
    $document->end_controls_section();
});
```

## User Preferences

```php
// Add control to user preferences
add_action( 'elementor/element/editor-preferences/preferences/before_section_end', function( $element, $args ) {
    $element->add_control( 'my_preference', [
        'type'    => \Elementor\Controls_Manager::SWITCHER,
        'label'   => esc_html__( 'My Preference', 'textdomain' ),
        'default' => 'yes',
    ]);
}, 10, 2 );
```
