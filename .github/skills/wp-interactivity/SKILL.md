---
name: WordPress Interactivity API
description: This skill covers the WordPress Interactivity API for building interactive, client-side behaviors in WordPress blocks and themes without requiring custom JavaScript builds.
version: 1.0.0
---

# WordPress Interactivity API Skill

Use this skill when working with interactive WordPress blocks, client-side state management, or dynamic UI behaviors using WordPress's native Interactivity API.

## When to Use This Skill

Invoke this skill when:

- Building interactive WordPress blocks with client-side behavior
- Creating add-to-cart buttons, forms, or dynamic UI components
- Implementing state management in WordPress without React
- Working with WooCommerce blocks that use Interactivity API
- Need to handle click events, form submissions, or dynamic content updates

## Core Concepts

### 1. Store and State Management

The Interactivity API uses a store pattern for managing client-side state:

**JavaScript (client-side):**
```javascript
import { store, getContext, getElement } from '@wordpress/interactivity';

const myStore = store('my-namespace', {
    state: {
        // Global state (shared across all instances)
        get computedValue() {
            const context = getContext();
            return context.someValue * 2;
        }
    },
    actions: {
        // Actions modify state or context
        *handleClick() {
            const context = getContext();
            context.isActive = !context.isActive;
        }
    },
    callbacks: {
        // Callbacks run when dependencies change
        init() {
            // Runs on initialization
        }
    }
});
```

**PHP (server-side state initialization):**
```php
// Set initial state on the server
wp_interactivity_state('my-namespace', [
    'items' => [],
    'isLoading' => false,
]);
```

### 2. Directives

Directives are HTML attributes that define interactive behaviors:

| Directive | Purpose | Example |
|-----------|---------|---------|
| `data-wp-interactive` | Declares namespace for element | `data-wp-interactive="woocommerce/product-button"` |
| `data-wp-context` | Defines local context data | `data-wp-context='{"productId": 123}'` |
| `data-wp-on--click` | Binds click handler | `data-wp-on--click="actions.addToCart"` |
| `data-wp-bind--hidden` | Binds attribute to state | `data-wp-bind--hidden="!state.isVisible"` |
| `data-wp-text` | Sets text content from state | `data-wp-text="state.buttonText"` |
| `data-wp-class--active` | Toggles class based on state | `data-wp-class--active="state.isActive"` |
| `data-wp-init` | Runs action on initialization | `data-wp-init="actions.initialize"` |
| `data-wp-watch` | Runs callback when dependencies change | `data-wp-watch="callbacks.updateDisplay"` |
| `data-wp-run` | Runs callback on every render | `data-wp-run="callbacks.syncState"` |

### 3. Context vs State

- **State**: Global, shared across all instances of a namespace
- **Context**: Local to each DOM element, scoped per instance

```javascript
// Access global state
const { state } = store('my-namespace', {});

// Access local context (unique per element)
const context = getContext();
```

### 4. PHP Helper Functions

```php
// Generate data-wp-context attribute
echo wp_interactivity_data_wp_context([
    'productId' => 123,
    'quantity' => 1,
]);
// Output: data-wp-context='{"productId":123,"quantity":1}'

// Set global state
wp_interactivity_state('my-namespace', [
    'buttonText' => __('Add to cart', 'textdomain'),
]);

// Configure namespace
wp_interactivity_config('my-namespace', [
    'messages' => ['success' => 'Added!']
]);
```

## WooCommerce Product Button Pattern

WooCommerce's Product Button uses Interactivity API for AJAX add-to-cart:

### HTML Structure
```html
<div 
    data-wp-interactive="woocommerce/product-button"
    data-wp-init="actions.refreshCartItems"
    data-wp-context='{"quantityToAdd":1,"productId":123,"productType":"simple","addToCartText":"Add to cart"}'
    class="wp-block-button wc-block-components-product-button"
>
    <button 
        class="wp-block-button__link add_to_cart_button ajax_add_to_cart"
        type="button"
        data-product_id="123"
        data-wp-on--click="actions.addCartItem"
    >
        <span 
            data-wp-text="state.addToCartText"
            data-wp-class--wc-block-slide-in="state.slideInAnimation"
        >Add to cart</span>
    </button>
    <span data-wp-bind--hidden="!state.displayViewCart">
        <a href="/cart/" class="added_to_cart">View cart</a>
    </span>
</div>
```

### Key Patterns

1. **Context provides instance-specific data** (productId, quantity)
2. **State provides computed values** (buttonText based on cart contents)
3. **Actions handle user interactions** (addCartItem)
4. **Callbacks sync state** (refreshCartItems on init)

## References

See `references/` directory for:
- [Directives Reference](references/directives.md)
- [Store API Reference](references/store-api.md)
- [PHP Functions Reference](references/php-functions.md)
