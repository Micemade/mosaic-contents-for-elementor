# WordPress Interactivity API - Store API Reference

## Overview

The Store API provides client-side state management for the WordPress Interactivity API.

## Importing

```javascript
import { store, getContext, getElement, getConfig } from '@wordpress/interactivity';
```

## store()

Creates or retrieves a store for a namespace.

### Syntax

```javascript
const myStore = store(namespace, storeDefinition, options);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | string | Unique store identifier (e.g., 'woocommerce/product-button') |
| `storeDefinition` | object | Object containing state, actions, and callbacks |
| `options` | object | Optional: `{ lock: true }` to prevent third-party access |

### Store Definition Structure

```javascript
store('my-namespace', {
    // Global state - shared across all instances
    state: {
        // Static values
        staticValue: 'hello',
        
        // Computed values (getters)
        get computedValue() {
            const context = getContext();
            return context.count * 2;
        }
    },
    
    // Actions - handle user interactions
    actions: {
        // Sync action
        increment() {
            const context = getContext();
            context.count++;
        },
        
        // Async action using generator
        *fetchData() {
            const context = getContext();
            context.isLoading = true;
            
            try {
                const response = yield fetch('/api/data');
                const data = yield response.json();
                context.data = data;
            } finally {
                context.isLoading = false;
            }
        }
    },
    
    // Callbacks - reactive effects
    callbacks: {
        // Runs when dependencies change
        onDataChange() {
            const context = getContext();
            console.log('Data changed:', context.data);
        },
        
        // Initialize on mount
        init() {
            const { ref } = getElement();
            // Setup logic here
        }
    }
});
```

---

## getContext()

Retrieves the local context for the current element.

### Syntax

```javascript
const context = getContext(namespace);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | string | Optional. Namespace to get context from. Defaults to current namespace. |

### Usage

```javascript
actions: {
    handleClick() {
        const context = getContext();
        // context contains data from data-wp-context
        context.isOpen = !context.isOpen;
        context.count++;
    }
}
```

### Cross-namespace context

```javascript
// Get context from another namespace
const wcContext = getContext('woocommerce/product-button');
```

---

## getElement()

Returns the current element and its ref.

### Syntax

```javascript
const { ref, attributes } = getElement();
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `ref` | HTMLElement | The current DOM element |
| `attributes` | object | Element's attributes as object |

### Usage

```javascript
callbacks: {
    init() {
        const { ref } = getElement();
        // Access DOM element
        ref.style.display = 'block';
        ref.classList.add('initialized');
    }
}
```

---

## getConfig()

Retrieves configuration set via `wp_interactivity_config()`.

### Syntax

```javascript
const config = getConfig(namespace);
```

### Usage

```php
// PHP (server-side)
wp_interactivity_config('my-namespace', [
    'apiUrl' => rest_url('my-plugin/v1/'),
    'nonce' => wp_create_nonce('my-action'),
]);
```

```javascript
// JavaScript (client-side)
const config = getConfig();
console.log(config.apiUrl); // '/wp-json/my-plugin/v1/'
```

---

## useLayoutEffect

React-like hook for side effects in callbacks.

```javascript
import { store, useLayoutEffect } from '@wordpress/interactivity';

store('my-namespace', {
    callbacks: {
        setupEffect() {
            useLayoutEffect(() => {
                // Setup code
                return () => {
                    // Cleanup code
                };
            }, [/* dependencies */]);
        }
    }
});
```

---

## Async Actions with Generators

Use generator functions (`*function`) for async operations:

```javascript
actions: {
    *addToCart() {
        const context = getContext();
        
        // Import other stores dynamically
        yield import('@woocommerce/stores/woocommerce/cart');
        
        const { actions } = store('woocommerce', {});
        
        yield actions.addCartItem({
            id: context.productId,
            quantity: context.quantity,
        });
        
        context.addedToCart = true;
    }
}
```

---

## Accessing Other Stores

```javascript
// Get state from another store
const { state: wooState } = store('woocommerce', {});

// Access cart data
const cartItems = wooState.cart?.items || [];
```

---

## Best Practices

1. **Use descriptive namespaces**: `vendor/component` pattern
2. **Lock stores in production**: `{ lock: true }` for internal stores
3. **Prefer context for instance data**: Keeps state isolated per element
4. **Use generators for async**: Clean syntax for API calls
5. **Keep state minimal**: Only what's needed for reactivity
6. **Cleanup in callbacks**: Return cleanup functions from effects
