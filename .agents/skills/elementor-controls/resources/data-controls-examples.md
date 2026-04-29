# Data Controls - PHP Code Examples

Full code examples for all Elementor data controls. See main SKILL.md for parameter tables and quick reference.

## Text Input Controls

```php
// TEXT
$this->add_control('title', [
    'label' => esc_html__('Title', 'textdomain'),
    'type' => \Elementor\Controls_Manager::TEXT,
    'default' => esc_html__('Default title', 'textdomain'),
    'placeholder' => esc_html__('Enter title', 'textdomain'),
]);

// TEXTAREA
$this->add_control('desc', [
    'label' => esc_html__('Description', 'textdomain'),
    'type' => \Elementor\Controls_Manager::TEXTAREA,
    'rows' => 10,
    'default' => esc_html__('Default description', 'textdomain'),
]);

// WYSIWYG
$this->add_control('content', [
    'label' => esc_html__('Content', 'textdomain'),
    'type' => \Elementor\Controls_Manager::WYSIWYG,
    'default' => '<p>Default content</p>',
]);

// CODE
$this->add_control('custom_css', [
    'label' => esc_html__('Custom CSS', 'textdomain'),
    'type' => \Elementor\Controls_Manager::CODE,
    'language' => 'css',
    'rows' => 20,
]);

// NUMBER
$this->add_control('count', [
    'label' => esc_html__('Count', 'textdomain'),
    'type' => \Elementor\Controls_Manager::NUMBER,
    'min' => 1, 'max' => 100, 'step' => 1,
    'default' => 10,
]);

// HIDDEN
$this->add_control('version', [
    'type' => \Elementor\Controls_Manager::HIDDEN,
    'default' => '2',
]);
```

## Selection Controls

```php
// SELECT
$this->add_control('border_style', [
    'label' => esc_html__('Border Style', 'textdomain'),
    'type' => \Elementor\Controls_Manager::SELECT,
    'default' => 'solid',
    'options' => [
        'none' => esc_html__('None', 'textdomain'),
        'solid' => esc_html__('Solid', 'textdomain'),
        'dashed' => esc_html__('Dashed', 'textdomain'),
    ],
    'selectors' => [
        '{{WRAPPER}} .el' => 'border-style: {{VALUE}};',
    ],
]);

// SELECT with groups (optgroup)
$this->add_control('animation', [
    'label' => esc_html__('Animation', 'textdomain'),
    'type' => \Elementor\Controls_Manager::SELECT,
    'groups' => [
        ['label' => 'Slide', 'options' => ['slide-right' => 'Slide Right', 'slide-left' => 'Slide Left']],
        ['label' => 'Zoom', 'options' => ['zoom-in' => 'Zoom In', 'zoom-out' => 'Zoom Out']],
    ],
]);

// SELECT2
$this->add_control('categories', [
    'label' => esc_html__('Categories', 'textdomain'),
    'type' => \Elementor\Controls_Manager::SELECT2,
    'multiple' => true,
    'options' => ['cat1' => 'Category 1', 'cat2' => 'Category 2'],
    'default' => [],
]);

// CHOOSE
$this->add_control('alignment', [
    'label' => esc_html__('Alignment', 'textdomain'),
    'type' => \Elementor\Controls_Manager::CHOOSE,
    'options' => [
        'left' => ['title' => esc_html__('Left', 'textdomain'), 'icon' => 'eicon-text-align-left'],
        'center' => ['title' => esc_html__('Center', 'textdomain'), 'icon' => 'eicon-text-align-center'],
        'right' => ['title' => esc_html__('Right', 'textdomain'), 'icon' => 'eicon-text-align-right'],
    ],
    'default' => 'center',
    'toggle' => true,
    'selectors' => [
        '{{WRAPPER}} .el' => 'text-align: {{VALUE}};',
    ],
]);

// SWITCHER
$this->add_control('show_title', [
    'label' => esc_html__('Show Title', 'textdomain'),
    'type' => \Elementor\Controls_Manager::SWITCHER,
    'label_on' => esc_html__('Yes', 'textdomain'),
    'label_off' => esc_html__('No', 'textdomain'),
    'return_value' => 'yes',
    'default' => 'yes',
]);
```

## Unit / Dimension Controls

```php
// SLIDER
$this->add_control('width', [
    'label' => esc_html__('Width', 'textdomain'),
    'type' => \Elementor\Controls_Manager::SLIDER,
    'size_units' => ['px', '%', 'em', 'rem', 'custom'],
    'range' => [
        'px' => ['min' => 0, 'max' => 1000, 'step' => 5],
        '%' => ['min' => 0, 'max' => 100],
    ],
    'default' => ['unit' => '%', 'size' => 50],
    'selectors' => [
        '{{WRAPPER}} .el' => 'width: {{SIZE}}{{UNIT}};',
    ],
]);

// DIMENSIONS
$this->add_control('margin', [
    'label' => esc_html__('Margin', 'textdomain'),
    'type' => \Elementor\Controls_Manager::DIMENSIONS,
    'size_units' => ['px', '%', 'em', 'rem', 'custom'],
    'selectors' => [
        '{{WRAPPER}} .el' => 'margin: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
    ],
]);

// IMAGE_DIMENSIONS
$this->add_control('image_size', [
    'label' => esc_html__('Image Dimension', 'textdomain'),
    'type' => \Elementor\Controls_Manager::IMAGE_DIMENSIONS,
    'default' => ['width' => '', 'height' => ''],
]);
```

## Media / Asset Controls

```php
// COLOR
$this->add_control('text_color', [
    'label' => esc_html__('Text Color', 'textdomain'),
    'type' => \Elementor\Controls_Manager::COLOR,
    'selectors' => [
        '{{WRAPPER}} .el' => 'color: {{VALUE}};',
    ],
]);

// MEDIA
$this->add_control('image', [
    'label' => esc_html__('Choose Image', 'textdomain'),
    'type' => \Elementor\Controls_Manager::MEDIA,
    'media_types' => ['image', 'svg'],
    'default' => ['url' => \Elementor\Utils::get_placeholder_image_src()],
]);

// GALLERY
$this->add_control('gallery', [
    'label' => esc_html__('Gallery', 'textdomain'),
    'type' => \Elementor\Controls_Manager::GALLERY,
    'default' => [],
]);

// ICONS
$this->add_control('icon', [
    'label' => esc_html__('Icon', 'textdomain'),
    'type' => \Elementor\Controls_Manager::ICONS,
    'default' => ['value' => 'fas fa-circle', 'library' => 'fa-solid'],
    'recommended' => [
        'fa-solid' => ['circle', 'dot-circle', 'square-full'],
        'fa-regular' => ['circle', 'dot-circle', 'square-full'],
    ],
]);

// URL
$this->add_control('link', [
    'label' => esc_html__('Link', 'textdomain'),
    'type' => \Elementor\Controls_Manager::URL,
    'placeholder' => esc_html__('https://your-link.com', 'textdomain'),
    'options' => ['url', 'is_external', 'nofollow'],
    'default' => ['url' => '', 'is_external' => true, 'nofollow' => true],
]);

// FONT
$this->add_control('font_family', [
    'label' => esc_html__('Font Family', 'textdomain'),
    'type' => \Elementor\Controls_Manager::FONT,
    'default' => "'Open Sans', sans-serif",
]);

// DATE_TIME
$this->add_control('due_date', [
    'label' => esc_html__('Due Date', 'textdomain'),
    'type' => \Elementor\Controls_Manager::DATE_TIME,
    'default' => gmdate('Y-m-d H:i'),
]);
```

## REPEATER

```php
$repeater = new \Elementor\Repeater();

$repeater->add_control('list_title', [
    'label' => esc_html__('Title', 'textdomain'),
    'type' => \Elementor\Controls_Manager::TEXT,
    'default' => esc_html__('List Title', 'textdomain'),
    'label_block' => true,
]);

$repeater->add_control('list_color', [
    'label' => esc_html__('Color', 'textdomain'),
    'type' => \Elementor\Controls_Manager::COLOR,
    'selectors' => [
        '{{WRAPPER}} {{CURRENT_ITEM}}' => 'color: {{VALUE}}',
    ],
]);

$this->add_control('list', [
    'label' => esc_html__('Items', 'textdomain'),
    'type' => \Elementor\Controls_Manager::REPEATER,
    'fields' => $repeater->get_controls(),
    'default' => [
        ['list_title' => esc_html__('Title #1', 'textdomain')],
        ['list_title' => esc_html__('Title #2', 'textdomain')],
    ],
    'title_field' => '{{{ list_title }}}',
    'prevent_empty' => true,
]);
```

## POPOVER_TOGGLE

```php
$this->add_control('box_toggle', [
    'label' => esc_html__('Box', 'textdomain'),
    'type' => \Elementor\Controls_Manager::POPOVER_TOGGLE,
    'label_off' => esc_html__('Default', 'textdomain'),
    'label_on' => esc_html__('Custom', 'textdomain'),
    'return_value' => 'yes',
]);

$this->start_popover();
// ... add controls inside popover ...
$this->end_popover();
```
