# Group Controls, Custom Controls & Global Styles - PHP Code Examples

Full code examples for group controls, custom control creation, and global styles. See main SKILL.md for parameter tables and quick reference.

## Group Controls

```php
// TYPOGRAPHY
$this->add_group_control(\Elementor\Group_Control_Typography::get_type(), [
    'name' => 'title_typography',
    'selector' => '{{WRAPPER}} .title',
]);

// BACKGROUND
$this->add_group_control(\Elementor\Group_Control_Background::get_type(), [
    'name' => 'background',
    'types' => ['classic', 'gradient'],
    'selector' => '{{WRAPPER}} .content',
]);

// BORDER
$this->add_group_control(\Elementor\Group_Control_Border::get_type(), [
    'name' => 'border',
    'selector' => '{{WRAPPER}} .wrapper',
]);

// BOX SHADOW
$this->add_group_control(\Elementor\Group_Control_Box_Shadow::get_type(), [
    'name' => 'box_shadow',
    'selector' => '{{WRAPPER}} .wrapper',
]);

// TEXT SHADOW
$this->add_group_control(\Elementor\Group_Control_Text_Shadow::get_type(), [
    'name' => 'text_shadow',
    'selector' => '{{WRAPPER}} .heading',
]);

// TEXT STROKE
$this->add_group_control(\Elementor\Group_Control_Text_Stroke::get_type(), [
    'name' => 'text_stroke',
    'selector' => '{{WRAPPER}} .heading',
]);

// CSS FILTER
$this->add_group_control(\Elementor\Group_Control_Css_Filter::get_type(), [
    'name' => 'css_filters',
    'selector' => '{{WRAPPER}} img',
]);

// IMAGE SIZE (use with MEDIA control)
$this->add_group_control(\Elementor\Group_Control_Image_Size::get_type(), [
    'name' => 'thumbnail',
    'default' => 'large',
    'exclude' => ['custom'],
]);
// Render: Group_Control_Image_Size::get_attachment_image_html($settings, 'thumbnail');
```

## Customizing Inner Controls with fields_options

```php
$this->add_group_control(\Elementor\Group_Control_Border::get_type(), [
    'name' => 'box_border',
    'fields_options' => [
        'border' => ['default' => 'solid'],
        'width' => ['default' => ['top' => '1', 'right' => '2', 'bottom' => '3', 'left' => '4', 'isLinked' => false]],
        'color' => ['default' => '#D4D4D4'],
    ],
    'selector' => '{{WRAPPER}} .box',
]);
```

## Global Styles Code Examples

```php
// Color with global default
$this->add_control('heading_color', [
    'label' => esc_html__('Color', 'textdomain'),
    'type' => \Elementor\Controls_Manager::COLOR,
    'global' => ['default' => Global_Colors::COLOR_PRIMARY],
    'selectors' => ['{{WRAPPER}} .heading' => 'color: {{VALUE}};'],
]);

// Typography with global default
$this->add_group_control(\Elementor\Group_Control_Typography::get_type(), [
    'name' => 'heading_typo',
    'selector' => '{{WRAPPER}} .heading',
    'global' => ['default' => Global_Typography::TYPOGRAPHY_PRIMARY],
]);
```

## Custom Controls

### Creating a Custom Control

```php
class My_Custom_Control extends \Elementor\Base_Data_Control {

    public function get_type(): string {
        return 'my-custom-control';
    }

    protected function get_default_settings(): array {
        return ['my_setting' => 'default_value'];
    }

    public function get_default_value(): string {
        return '';
    }

    public function content_template(): void {
        $control_uid = $this->get_control_uid();
        ?>
        <div class="elementor-control-field">
            <# if (data.label) { #>
                <label for="<?php echo $control_uid; ?>" class="elementor-control-title">{{{ data.label }}}</label>
            <# } #>
            <div class="elementor-control-input-wrapper">
                <input id="<?php echo $control_uid; ?>" type="text" data-setting="{{ data.name }}" />
            </div>
        </div>
        <# if (data.description) { #>
            <div class="elementor-control-field-description">{{{ data.description }}}</div>
        <# } #>
        <?php
    }

    public function enqueue(): void {
        wp_register_style('my-control-css', plugins_url('assets/css/control.css', __FILE__));
        wp_enqueue_style('my-control-css');
        wp_register_script('my-control-js', plugins_url('assets/js/control.js', __FILE__));
        wp_enqueue_script('my-control-js');
    }
}
```

### Registration

```php
add_action('elementor/controls/register', function($controls_manager) {
    require_once(__DIR__ . '/controls/my-custom-control.php');
    $controls_manager->register(new \My_Custom_Control());
});
```

### Required Methods

| Method | Purpose |
|---|---|
| `get_type(): string` | Unique control identifier |
| `content_template(): void` | JS/HTML template for panel UI (uses `data` object) |
| `get_default_settings(): array` | Default control settings |
| `get_default_value()` | Default stored value |
| `enqueue(): void` | Register/enqueue CSS & JS assets |
