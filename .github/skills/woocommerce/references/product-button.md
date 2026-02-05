# WooCommerce Product Button Reference

## Overview

The WooCommerce Product Button block provides AJAX add-to-cart functionality using the WordPress Interactivity API.

## File Locations

```
plugins/woocommerce/
├── client/blocks/assets/js/atomic/blocks/product-elements/button/
│   ├── block.tsx          # React editor component
│   ├── frontend.ts        # Interactivity API store
│   ├── types.ts           # TypeScript definitions
│   ├── style.scss         # Component styles
│   ├── edit.tsx           # Block editor controls
│   └── save.tsx           # Block save function
└── src/Blocks/BlockTypes/
    └── ProductButton.php  # Server-side rendering
```

---

## Context Interface

```typescript
interface Context {
    addToCartText: string;          // Button text
    productId: number;              // WooCommerce product ID
    productType: string;            // 'simple' | 'variable' | 'grouped' | 'external'
    groupedProductIds?: number[];   // For grouped products
    displayViewCart: boolean;       // Show "View cart" link
    quantityToAdd: number;          // Quantity to add (default: 1)
    tempQuantity: number;           // Current cart quantity
    animationStatus: AnimationStatus;  // Animation state
    hasPressedButton: boolean;      // User interaction tracking
    inTheCartText: string;          // Template for "X in cart"
}

enum AnimationStatus {
    IDLE = 'IDLE',
    SLIDE_OUT = 'SLIDE-OUT',
    SLIDE_IN = 'SLIDE-IN'
}
```

---

## State Properties

```typescript
const productButtonStore = {
    state: {
        // Current cart quantity for this product
        get quantity(): number {
            const { productId } = getContext<Context>();
            return wooState.cart?.items.find(
                item => item.id === productId
            )?.quantity || 0;
        },
        
        // Slide-in animation active
        get slideInAnimation(): boolean {
            const { animationStatus } = getContext<Context>();
            return animationStatus === AnimationStatus.SLIDE_IN;
        },
        
        // Slide-out animation active
        get slideOutAnimation(): boolean {
            const { animationStatus } = getContext<Context>();
            return animationStatus === AnimationStatus.SLIDE_OUT;
        },
        
        // Dynamic button text
        get addToCartText(): string {
            const context = getContext<Context>();
            const showTemporary = 
                context.animationStatus === AnimationStatus.IDLE ||
                context.animationStatus === AnimationStatus.SLIDE_OUT;
            
            const quantity = showTemporary 
                ? context.tempQuantity 
                : state.quantity;
            
            if (quantity > 0) {
                return context.inTheCartText.replace('###', String(quantity));
            }
            
            return context.addToCartText;
        },
        
        // Show/hide "View cart" link
        get displayViewCart(): boolean {
            const { displayViewCart } = getContext<Context>();
            return displayViewCart && state.quantity > 0;
        }
    }
};
```

---

## Actions

```typescript
actions: {
    // Add product to cart via Store API
    *addCartItem(): Generator<unknown, void> {
        const context = getContext<Context>();
        
        yield import('@woocommerce/stores/woocommerce/cart');
        const { actions } = store<WooCommerce>('woocommerce', {});
        
        yield actions.addCartItem(
            {
                id: state.productId,
                quantity: state.quantity + context.quantityToAdd,
                type: context.productType,
            },
            {
                showCartUpdatesNotices: false,
            }
        );
        
        context.displayViewCart = true;
    },
    
    // Refresh cart data on initialization
    *refreshCartItems() {
        yield import('@woocommerce/stores/woocommerce/cart');
        const { actions } = store<WooCommerce>('woocommerce', {});
        actions.refreshCartItems();
    },
    
    // Handle animation end event
    handleAnimationEnd(event: AnimationEvent) {
        const context = getContext<Context>();
        
        if (event.animationName === 'slideOut') {
            context.animationStatus = AnimationStatus.SLIDE_IN;
        } else if (event.animationName === 'slideIn') {
            context.animationStatus = AnimationStatus.IDLE;
            context.tempQuantity = state.quantity;
        }
    },
    
    // Track button press for animation
    handlePressedState() {
        const context = getContext<Context>();
        
        context.hasPressedButton = true;
        
        if (context.tempQuantity !== state.quantity &&
            context.animationStatus === AnimationStatus.IDLE) {
            context.animationStatus = AnimationStatus.SLIDE_OUT;
        }
    }
}
```

---

## Callbacks

```typescript
callbacks: {
    // Sync temp quantity on page load
    syncTempQuantityOnLoad() {
        const context = getContext<Context>();
        context.tempQuantity = state.quantity;
    },
    
    // Start animation when quantity changes
    startAnimation() {
        const context = getContext<Context>();
        
        if (!context.hasPressedButton) return;
        
        if (context.tempQuantity !== state.quantity &&
            context.animationStatus === AnimationStatus.IDLE) {
            context.animationStatus = AnimationStatus.SLIDE_OUT;
        }
    }
}
```

---

## HTML Directives

### Wrapper Element
```html
<div 
    data-wp-interactive="woocommerce/product-button"
    data-wp-init="actions.refreshCartItems"
    data-wp-context='{"productId":123,"quantityToAdd":1,...}'
>
```

### Button Element
```html
<button
    data-wp-on--click="actions.addCartItem"
    type="button"
>
```

### Text Span
```html
<span 
    data-wp-text="state.addToCartText"
    data-wp-class--wc-block-slide-in="state.slideInAnimation"
    data-wp-class--wc-block-slide-out="state.slideOutAnimation"
    data-wp-on--animationend="actions.handleAnimationEnd"
    data-wp-watch="callbacks.startAnimation"
    data-wp-run="callbacks.syncTempQuantityOnLoad"
>
    Add to cart
</span>
```

### View Cart Link
```html
<span data-wp-bind--hidden="!state.displayViewCart">
    <a href="/cart/" class="added_to_cart wc_forward">View cart</a>
</span>
```

---

## CSS Animations

```css
@keyframes slideOut {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-100%);
    }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(100%);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.wc-block-slide-out {
    animation: slideOut 0.15s ease-out forwards;
}

.wc-block-slide-in {
    animation: slideIn 0.15s ease-out forwards;
}
```

---

## PHP Server Rendering

```php
$context = [
    'quantityToAdd' => apply_filters(
        'woocommerce_add_to_cart_quantity', 
        1, 
        $product->get_id()
    ),
    'productId' => $product->get_id(),
    'productType' => $product->get_type(),
    'addToCartText' => $product->add_to_cart_text(),
    'tempQuantity' => $this->get_cart_item_quantities_by_product_id($product->get_id()),
    'animationStatus' => 'IDLE',
    'inTheCartText' => sprintf(
        /* translators: %s: number */
        _n('%s in cart', '%s in cart', 1, 'woocommerce'),
        '###'
    ),
    'noticeId' => '',
    'hasPressedButton' => false,
];

if ($product->is_type('grouped')) {
    $context['groupedProductIds'] = $product->get_children();
}
```

---

## Required CSS Classes

| Class | Purpose |
|-------|---------|
| `wp-block-button` | WordPress button block wrapper |
| `wc-block-components-product-button` | WooCommerce product button |
| `wp-block-button__link` | Button link styling |
| `wp-element-button` | WordPress element button |
| `add_to_cart_button` | WooCommerce add to cart |
| `ajax_add_to_cart` | AJAX-enabled button |
| `product_type_{type}` | Product type indicator |
| `wc-interactive` | Interactivity marker |

---

## Data Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `data-product_id` | number | Yes | Product ID |
| `data-product_sku` | string | No | Product SKU |
| `aria-label` | string | Recommended | Accessibility label |
