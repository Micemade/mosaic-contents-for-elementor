# Widget Rendering Details

Full code examples for `register_controls()`, `render()`, `content_template()`, and render attributes.
Parent reference: [Elementor Development SKILL.md](../SKILL.md)

---

## register_controls()

```php
protected function register_controls(): void {

    // --- Content Tab ---
    $this->start_controls_section( 'content_section', [
        'label' => esc_html__( 'Content', 'textdomain' ),
        'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
    ] );

    $this->add_control( 'title', [
        'type'        => \Elementor\Controls_Manager::TEXT,
        'label'       => esc_html__( 'Title', 'textdomain' ),
        'placeholder' => esc_html__( 'Enter your title', 'textdomain' ),
    ] );

    $this->add_control( 'image', [
        'type'    => \Elementor\Controls_Manager::MEDIA,
        'label'   => esc_html__( 'Image', 'textdomain' ),
        'default' => [ 'url' => \Elementor\Utils::get_placeholder_image_src() ],
    ] );

    $this->add_group_control( \Elementor\Group_Control_Image_Size::get_type(), [
        'name'    => 'image',
        'default' => 'large',
    ] );

    $this->add_control( 'link', [
        'type'        => \Elementor\Controls_Manager::URL,
        'label'       => esc_html__( 'Link', 'textdomain' ),
        'placeholder' => esc_html__( 'https://your-link.com', 'textdomain' ),
    ] );

    // Repeater
    $repeater = new \Elementor\Repeater();
    $repeater->add_control( 'text', [
        'type'    => \Elementor\Controls_Manager::TEXT,
        'label'   => esc_html__( 'Text', 'textdomain' ),
        'default' => esc_html__( 'List Item', 'textdomain' ),
    ] );
    $repeater->add_control( 'link', [
        'type'  => \Elementor\Controls_Manager::URL,
        'label' => esc_html__( 'Link', 'textdomain' ),
    ] );
    $this->add_control( 'list', [
        'type'        => \Elementor\Controls_Manager::REPEATER,
        'label'       => esc_html__( 'List', 'textdomain' ),
        'fields'      => $repeater->get_controls(),
        'title_field' => '{{{ text }}}',
    ] );

    $this->end_controls_section();

    // --- Style Tab ---
    $this->start_controls_section( 'style_section', [
        'label' => esc_html__( 'Style', 'textdomain' ),
        'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
    ] );

    $this->add_control( 'title_color', [
        'type'      => \Elementor\Controls_Manager::COLOR,
        'label'     => esc_html__( 'Title Color', 'textdomain' ),
        'global'    => [
            'default' => \Elementor\Core\Kits\Documents\Tabs\Global_Colors::COLOR_PRIMARY,
        ],
        'selectors' => [ '{{WRAPPER}} .title' => 'color: {{VALUE}};' ],
    ] );

    $this->add_group_control( \Elementor\Group_Control_Typography::get_type(), [
        'name'     => 'title_typography',
        'global'   => [
            'default' => \Elementor\Core\Kits\Documents\Tabs\Global_Typography::TYPOGRAPHY_PRIMARY,
        ],
        'selector' => '{{WRAPPER}} .title',
    ] );

    $this->end_controls_section();
}
```

---

## render() -- PHP Frontend

```php
protected function render(): void {
    $settings = $this->get_settings_for_display();

    if ( empty( $settings['title'] ) ) {
        return;
    }

    // Render attributes
    $this->add_render_attribute( 'wrapper', 'class', 'my-widget-wrapper' );
    $this->add_inline_editing_attributes( 'title', 'none' );

    // Link attributes
    if ( ! empty( $settings['link']['url'] ) ) {
        $this->add_link_attributes( 'link', $settings['link'] );
    }
    ?>
    <div <?php $this->print_render_attribute_string( 'wrapper' ); ?>>
        <h3 <?php $this->print_render_attribute_string( 'title' ); ?>>
            <?php echo esc_html( $settings['title'] ); ?>
        </h3>
        <?php
        // Image with Group_Control_Image_Size
        echo \Elementor\Group_Control_Image_Size::get_attachment_image_html( $settings );

        // Repeater
        if ( $settings['list'] ) : ?>
            <ul>
            <?php foreach ( $settings['list'] as $index => $item ) : ?>
                <li>
                <?php if ( ! empty( $item['link']['url'] ) ) :
                    $this->add_link_attributes( "link_{$index}", $item['link'] ); ?>
                    <a <?php $this->print_render_attribute_string( "link_{$index}" ); ?>>
                        <?php echo esc_html( $item['text'] ); ?>
                    </a>
                <?php else :
                    echo esc_html( $item['text'] );
                endif; ?>
                </li>
            <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
    <?php
}
```

---

## content_template() -- JS Editor Preview

Template syntax: `<# ... #>` for logic, `{{ }}` for escaped output, `{{{ }}}` for unescaped output.

```php
protected function content_template(): void {
    ?>
    <#
    if ( '' === settings.title ) {
        return;
    }

    view.addRenderAttribute( 'wrapper', 'class', 'my-widget-wrapper' );
    view.addInlineEditingAttributes( 'title', 'none' );
    #>
    <div {{{ view.getRenderAttributeString( 'wrapper' ) }}}>
        <h3 {{{ view.getRenderAttributeString( 'title' ) }}}>
            {{ settings.title }}
        </h3>

        <# /* Advanced image rendering */ #>
        <#
        const image = {
            id: settings.image.id,
            url: settings.image.url,
            size: settings.image_size,
            dimension: settings.image_custom_dimension,
            model: view.getEditModel()
        };
        const image_url = elementor.imagesManager.getImageUrl( image );
        if ( '' !== image_url ) { #>
            <img src="{{{ image_url }}}">
        <# } #>

        <# if ( settings.list.length ) { #>
        <ul>
        <# _.each( settings.list, function( item, index ) { #>
            <li>
            <# if ( item.link && item.link.url ) { #>
                <a href="{{{ item.link.url }}}">{{{ item.text }}}</a>
            <# } else { #>
                {{{ item.text }}}
            <# } #>
            </li>
        <# } ); #>
        </ul>
        <# } #>
    </div>
    <?php
}
```

---

## Render Attributes (PHP)

```php
$this->add_render_attribute( 'wrapper', [
    'id'    => 'custom-widget-id',
    'class' => [ 'wrapper-class', $settings['custom_class'] ],
    'role'  => $settings['role'],
] );

// Output: echo or print
echo $this->get_render_attribute_string( 'wrapper' );
$this->print_render_attribute_string( 'wrapper' );
```

---

## Render Attributes (JS)

```js
view.addRenderAttribute( 'wrapper', {
    'id': 'custom-widget-id',
    'class': [ 'wrapper-class', settings.custom_class ],
    'role': settings.role,
} );
// Output
{{{ view.getRenderAttributeString( 'wrapper' ) }}}
```
