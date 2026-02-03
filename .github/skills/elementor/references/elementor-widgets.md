# Elementor Widget Development Reference

## Official Documentation

- **Widget Development**: https://developers.elementor.com/docs/widgets/
- **Controls Reference**: https://developers.elementor.com/docs/controls/
- **Hooks Reference**: https://developers.elementor.com/docs/hooks/

## Elementor GitHub Repository

- https://github.com/elementor/elementor

## Widget Class Structure

```php
<?php
namespace MyPlugin\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

class My_Widget extends Widget_Base {
    
    // Required: Unique widget identifier (kebab-case)
    public function get_name() {
        return 'my-widget';
    }
    
    // Required: Widget title in panel
    public function get_title() {
        return __('My Widget', 'text-domain');
    }
    
    // Required: Widget icon
    public function get_icon() {
        return 'eicon-code';
    }
    
    // Required: Widget categories
    public function get_categories() {
        return ['general'];
    }
    
    // Optional: Search keywords
    public function get_keywords() {
        return ['custom', 'widget'];
    }
    
    // Define controls
    protected function register_controls() { }
    
    // Frontend render
    protected function render() { }
    
    // Editor template (JavaScript)
    protected function content_template() { }
}
```

## Common Controls

### Text Input
```php
$this->add_control('title', [
    'label' => __('Title', 'text-domain'),
    'type' => Controls_Manager::TEXT,
    'default' => __('Default Title', 'text-domain'),
    'placeholder' => __('Enter title', 'text-domain'),
]);
```

### Textarea
```php
$this->add_control('description', [
    'label' => __('Description', 'text-domain'),
    'type' => Controls_Manager::TEXTAREA,
    'rows' => 5,
]);
```

### Select
```php
$this->add_control('layout', [
    'label' => __('Layout', 'text-domain'),
    'type' => Controls_Manager::SELECT,
    'default' => 'grid',
    'options' => [
        'grid' => __('Grid', 'text-domain'),
        'list' => __('List', 'text-domain'),
    ],
]);
```

### Number
```php
$this->add_control('columns', [
    'label' => __('Columns', 'text-domain'),
    'type' => Controls_Manager::NUMBER,
    'min' => 1,
    'max' => 6,
    'default' => 3,
]);
```

### Color
```php
$this->add_control('bg_color', [
    'label' => __('Background Color', 'text-domain'),
    'type' => Controls_Manager::COLOR,
    'selectors' => [
        '{{WRAPPER}} .my-element' => 'background-color: {{VALUE}}',
    ],
]);
```

### Switcher (Toggle)
```php
$this->add_control('show_title', [
    'label' => __('Show Title', 'text-domain'),
    'type' => Controls_Manager::SWITCHER,
    'label_on' => __('Show', 'text-domain'),
    'label_off' => __('Hide', 'text-domain'),
    'return_value' => 'yes',
    'default' => 'yes',
]);
```

### Image
```php
$this->add_control('image', [
    'label' => __('Image', 'text-domain'),
    'type' => Controls_Manager::MEDIA,
    'default' => [
        'url' => \Elementor\Utils::get_placeholder_image_src(),
    ],
]);
```

## Control Sections

```php
// Content Tab
$this->start_controls_section('content_section', [
    'label' => __('Content', 'text-domain'),
    'tab' => Controls_Manager::TAB_CONTENT,
]);
// ... add controls
$this->end_controls_section();

// Style Tab
$this->start_controls_section('style_section', [
    'label' => __('Style', 'text-domain'),
    'tab' => Controls_Manager::TAB_STYLE,
]);
// ... add style controls
$this->end_controls_section();
```

## Frontend Hooks

```javascript
// Initialize when widget is ready
elementorFrontend.hooks.addAction(
    'frontend/element_ready/my-widget.default',
    ($scope) => {
        // $scope is jQuery element wrapping the widget
        const settings = $scope.find('.settings-data').val();
    }
);
```

## Widget Registration

```php
add_action('elementor/widgets/widgets_registered', function($widgets_manager) {
    require_once __DIR__ . '/widgets/my-widget.php';
    $widgets_manager->register(new \MyPlugin\Widgets\My_Widget());
});
```
