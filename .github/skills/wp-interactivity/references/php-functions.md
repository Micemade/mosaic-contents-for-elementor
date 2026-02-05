# WordPress Interactivity API - PHP Functions Reference

## Overview

PHP functions for server-side initialization and configuration of the Interactivity API.

---

## wp_interactivity_state()

Gets and/or sets the initial state for a store namespace.

### Syntax

```php
$state = wp_interactivity_state( string $namespace, array $state = [] ): array
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `$namespace` | string | The unique store namespace identifier |
| `$state` | array | Optional. State data to merge with existing state |

### Returns

`array` - The current state for the namespace

### Usage

```php
// Set initial state
wp_interactivity_state('woocommerce/product-button', [
    'addToCartText' => __('Add to cart', 'woocommerce'),
    'inTheCartText' => __('%d in cart', 'woocommerce'),
]);

// Get current state
$current_state = wp_interactivity_state('woocommerce/product-button');

// Dynamic state using closures
wp_interactivity_state('my-namespace', [
    'dynamicValue' => function() {
        $context = wp_interactivity_get_context();
        return $context['count'] * 2;
    }
]);
```

---

## wp_interactivity_config()

Sets configuration data for a store namespace.

### Syntax

```php
wp_interactivity_config( string $namespace, array $config = [] ): array
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `$namespace` | string | The unique store namespace identifier |
| `$config` | array | Configuration data |

### Usage

```php
wp_interactivity_config('woocommerce', [
    'messages' => [
        'addedToCartText' => __('Added to cart', 'woocommerce'),
        'errorText' => __('Error adding to cart', 'woocommerce'),
    ],
    'settings' => [
        'cartUrl' => wc_get_cart_url(),
        'ajaxEnabled' => true,
    ]
]);
```

---

## wp_interactivity_data_wp_context()

Generates a `data-wp-context` directive attribute from a PHP array.

### Syntax

```php
$attribute = wp_interactivity_data_wp_context( array $context, string $namespace = '' ): string
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `$context` | array | The context data to encode |
| `$namespace` | string | Optional. Namespace for the context |

### Returns

`string` - The encoded `data-wp-context` attribute

### Usage

```php
<div <?php echo wp_interactivity_data_wp_context([
    'productId' => $product->get_id(),
    'quantity' => 1,
    'productType' => $product->get_type(),
    'addToCartText' => $product->add_to_cart_text(),
]); ?>>
```

Output:
```html
<div data-wp-context='{"productId":123,"quantity":1,"productType":"simple","addToCartText":"Add to cart"}'>
```

With namespace:
```php
echo wp_interactivity_data_wp_context(
    ['isOpen' => false],
    'my-plugin/accordion'
);
```

---

## wp_interactivity_get_context()

Gets the current context during directive processing (used in state closures).

### Syntax

```php
$context = wp_interactivity_get_context( string $namespace = '' ): array
```

### Usage

```php
wp_interactivity_state('my-namespace', [
    'computedValue' => function() {
        $context = wp_interactivity_get_context();
        return $context['baseValue'] * 2;
    }
]);
```

---

## wp_interactivity_process_directives()

Processes Interactivity API directives in HTML content.

### Syntax

```php
$processed_html = wp_interactivity_process_directives( string $html ): string
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `$html` | string | HTML content containing directives |

### Returns

`string` - Processed HTML with evaluated directives

### Usage

```php
$html = '<div data-wp-text="state.message">Fallback</div>';
$processed = wp_interactivity_process_directives($html);
// Output: <div data-wp-text="state.message">Hello World</div>
```

---

## Complete Block Example

```php
<?php
// In your block's render.php or render callback

// Set up state
wp_interactivity_state('my-plugin/counter', [
    'message' => __('Click to increment', 'my-plugin'),
]);

// Build context
$context = [
    'count' => 0,
    'step' => 1,
];

// Get block wrapper attributes
$wrapper_attributes = get_block_wrapper_attributes([
    'class' => 'my-counter-block',
]);
?>

<div 
    <?php echo $wrapper_attributes; ?>
    data-wp-interactive="my-plugin/counter"
    <?php echo wp_interactivity_data_wp_context($context); ?>
    data-wp-init="callbacks.init"
>
    <button 
        type="button"
        data-wp-on--click="actions.increment"
        data-wp-bind--disabled="state.isLoading"
    >
        <span data-wp-text="state.message">Increment</span>
    </button>
    
    <span 
        class="count-display"
        data-wp-text="context.count"
    >0</span>
</div>
```

---

## WooCommerce Product Button Pattern

```php
<?php
// From WooCommerce ProductButton.php

$context = [
    'quantityToAdd' => 1,
    'productId' => $product->get_id(),
    'productType' => $product->get_type(),
    'addToCartText' => $product->add_to_cart_text(),
    'tempQuantity' => 0,
    'animationStatus' => 'IDLE',
    'inTheCartText' => sprintf(__('%d in cart', 'woocommerce'), '###'),
    'displayViewCart' => false,
];

wp_interactivity_state('woocommerce/product-button', [
    'addToCartText' => function() {
        $context = wp_interactivity_get_context();
        $quantity = $context['tempQuantity'];
        
        if ($quantity > 0) {
            return sprintf(_n('%d in cart', '%d in cart', $quantity), $quantity);
        }
        
        return $context['addToCartText'];
    }
]);
?>

<div 
    class="wp-block-button wc-block-components-product-button"
    data-wp-interactive="woocommerce/product-button"
    data-wp-init="actions.refreshCartItems"
    <?php echo wp_interactivity_data_wp_context($context); ?>
>
    <button 
        class="wp-block-button__link add_to_cart_button ajax_add_to_cart"
        type="button"
        data-product_id="<?php echo esc_attr($product->get_id()); ?>"
        data-wp-on--click="actions.addCartItem"
    >
        <span data-wp-text="state.addToCartText">
            <?php echo esc_html($product->add_to_cart_text()); ?>
        </span>
    </button>
    
    <span data-wp-bind--hidden="!state.displayViewCart">
        <a href="<?php echo esc_url(wc_get_cart_url()); ?>" class="added_to_cart">
            <?php esc_html_e('View cart', 'woocommerce'); ?>
        </a>
    </span>
</div>
```

---

## Best Practices

1. **Escape output**: Always escape dynamic values in attributes
2. **Use closures for dynamic state**: They evaluate during directive processing
3. **Namespace consistently**: Use `vendor/component` pattern
4. **Provide fallback content**: Users without JS should see meaningful content
5. **Keep context minimal**: Only pass what's needed for interactivity
