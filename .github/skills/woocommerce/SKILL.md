---
name: WooCommerce Block Development
description: This skill covers WooCommerce block development, product button implementations, Store API integration, and Interactivity API usage for WooCommerce blocks.
version: 1.0.0
---

# WooCommerce Block Development Skill

Use this skill when working with WooCommerce blocks, product buttons, cart interactions, or integrating with WooCommerce's Store API and Interactivity API patterns.

## When to Use This Skill

Invoke this skill when:

- Building add-to-cart buttons or product interaction components
- Integrating with WooCommerce's cart and Store API
- Creating custom WooCommerce product blocks
- Implementing AJAX cart functionality
- Working with WooCommerce's Interactivity API patterns

## Core Concepts

### 1. WooCommerce Block Architecture

WooCommerce blocks follow a specific architecture:

```
plugins/woocommerce/
├── client/blocks/
│   └── assets/js/
│       ├── atomic/blocks/product-elements/
│       │   └── button/
│       │       ├── block.tsx      # Editor component
│       │       ├── frontend.ts    # Interactivity store
│       │       ├── types.ts       # TypeScript types
│       │       └── style.scss     # Styles
│       └── blocks/
│           └── add-to-cart-with-options/
│               └── frontend.ts
└── src/Blocks/BlockTypes/
    └── ProductButton.php          # Server-side rendering
```

### 2. Product Button Implementation

WooCommerce's Product Button uses the Interactivity API for seamless AJAX cart operations:

**Key Features:**
- AJAX add-to-cart without page reload
- Animated button text transitions
- Cart quantity synchronization
- Mini Cart integration

**HTML Structure:**
```html
<div 
    data-wp-interactive="woocommerce/product-button"
    data-wp-init="actions.refreshCartItems"
    data-wp-context='{"quantityToAdd":1,"productId":123,"productType":"simple"}'
    class="wp-block-button wc-block-components-product-button"
>
    <button 
        class="wp-block-button__link add_to_cart_button ajax_add_to_cart"
        type="button"
        data-product_id="123"
        data-product_sku="product-sku"
        data-wp-on--click="actions.addCartItem"
    >
        <span 
            data-wp-text="state.addToCartText"
            data-wp-class--wc-block-slide-in="state.slideInAnimation"
            data-wp-class--wc-block-slide-out="state.slideOutAnimation"
            data-wp-on--animationend="actions.handleAnimationEnd"
        >Add to cart</span>
    </button>
    
    <span data-wp-bind--hidden="!state.displayViewCart">
        <a href="/cart/" class="added_to_cart wc_forward">View cart</a>
    </span>
</div>
```

### 3. Frontend Store (Interactivity API)

```javascript
// frontend.ts pattern from WooCommerce
import { store, getContext } from '@wordpress/interactivity';

interface Context {
    addToCartText: string;
    productId: number;
    productType: string;
    quantityToAdd: number;
    tempQuantity: number;
    animationStatus: 'IDLE' | 'SLIDE-OUT' | 'SLIDE-IN';
    displayViewCart: boolean;
}

const productButtonStore = {
    state: {
        get quantity() {
            const context = getContext<Context>();
            // Find product in cart
            return wooState.cart?.items.find(
                item => item.id === context.productId
            )?.quantity || 0;
        },
        
        get addToCartText() {
            const { tempQuantity, addToCartText } = getContext<Context>();
            return tempQuantity > 0 
                ? `${tempQuantity} in cart` 
                : addToCartText;
        }
    },
    
    actions: {
        *addCartItem() {
            const context = getContext<Context>();
            
            yield import('@woocommerce/stores/woocommerce/cart');
            const { actions } = store('woocommerce', {});
            
            yield actions.addCartItem({
                id: context.productId,
                quantity: context.quantityToAdd,
                type: context.productType,
            });
            
            context.displayViewCart = true;
        },
        
        *refreshCartItems() {
            yield import('@woocommerce/stores/woocommerce/cart');
            const { actions } = store('woocommerce', {});
            actions.refreshCartItems();
        }
    }
};

store('woocommerce/product-button', productButtonStore, { lock: true });
```

### 4. PHP Server-Side Rendering

```php
// ProductButton.php pattern
class ProductButton extends AbstractBlock {
    protected function render($attributes, $content, $block) {
        global $product;
        
        $context = [
            'quantityToAdd' => 1,
            'productId' => $product->get_id(),
            'productType' => $product->get_type(),
            'addToCartText' => $product->add_to_cart_text(),
            'tempQuantity' => $this->get_cart_quantity($product->get_id()),
            'animationStatus' => 'IDLE',
            'displayViewCart' => false,
        ];
        
        wp_interactivity_state('woocommerce/product-button', [
            'addToCartText' => function() {
                $ctx = wp_interactivity_get_context();
                $qty = $ctx['tempQuantity'];
                return $qty > 0 
                    ? sprintf(_n('%d in cart', '%d in cart', $qty), $qty)
                    : $ctx['addToCartText'];
            }
        ]);
        
        return sprintf(
            '<div %s data-wp-interactive="woocommerce/product-button" %s>
                <button type="button" data-wp-on--click="actions.addCartItem">
                    <span data-wp-text="state.addToCartText">%s</span>
                </button>
            </div>',
            get_block_wrapper_attributes(),
            wp_interactivity_data_wp_context($context),
            esc_html($product->add_to_cart_text())
        );
    }
}
```

### 5. WooCommerce Store API

For cart operations, WooCommerce exposes a Store API:

**Endpoints:**
```
GET  /wc/store/v1/cart           # Get cart contents
POST /wc/store/v1/cart/add-item  # Add item to cart
POST /wc/store/v1/cart/remove-item
POST /wc/store/v1/cart/update-item
```

**JavaScript Usage:**
```javascript
// Add to cart
const response = await fetch('/wp-json/wc/store/v1/cart/add-item', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Nonce': wcStoreApiNonce,
    },
    body: JSON.stringify({
        id: productId,
        quantity: 1,
    })
});
```

### 6. Key CSS Classes

```css
/* Button states */
.add_to_cart_button { }
.ajax_add_to_cart { }
.add_to_cart_button.loading { }
.add_to_cart_button.added { }

/* Product types */
.product_type_simple { }
.product_type_variable { }
.product_type_external { }

/* WooCommerce block components */
.wc-block-components-product-button { }
.wp-block-button__link { }

/* Animation */
.wc-block-slide-in { }
.wc-block-slide-out { }
```

### 7. Data Attributes

Standard WooCommerce data attributes for add-to-cart:

| Attribute | Purpose |
|-----------|---------|
| `data-product_id` | Product ID |
| `data-product_sku` | Product SKU |
| `data-quantity` | Quantity to add |
| `data-wp-interactive` | Interactivity namespace |
| `data-wp-context` | Instance context data |

## Integration Patterns

### React Component for Elementor

When building add-to-cart for non-block contexts (like Elementor):

```jsx
const AddToCartButton = ({ product, cartUrl = '/cart/' }) => {
    const context = {
        quantityToAdd: 1,
        productId: product.id,
        productType: product.type || 'simple',
        addToCartText: 'Add to cart',
        tempQuantity: 0,
        animationStatus: 'IDLE',
        inTheCartText: '### in cart',
        displayViewCart: false,
    };
    
    return (
        <div 
            className="wp-block-button wc-block-components-product-button"
            data-wp-interactive="woocommerce/product-button"
            data-wp-init="actions.refreshCartItems"
            data-wp-context={JSON.stringify(context)}
        >
            <button
                className="wp-block-button__link add_to_cart_button ajax_add_to_cart"
                type="button"
                data-product_id={product.id}
                data-product_sku={product.sku}
                data-wp-on--click="actions.addCartItem"
            >
                <span data-wp-text="state.addToCartText">
                    Add to cart
                </span>
            </button>
        </div>
    );
};
```

## References

See `references/` directory for:
- [Product Button Implementation](references/product-button.md)
- [Store API Reference](references/store-api.md)
- [Block Types Reference](references/block-types.md)
