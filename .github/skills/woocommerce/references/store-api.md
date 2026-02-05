# WooCommerce Store API Reference

## Overview

The WooCommerce Store API provides RESTful endpoints for cart operations, checkout, and product data. It's designed for frontend use and powers the WooCommerce blocks.

## Base URL

```
/wp-json/wc/store/v1/
```

---

## Cart Endpoints

### Get Cart

```
GET /wc/store/v1/cart
```

**Response:**
```json
{
    "items": [
        {
            "key": "abc123...",
            "id": 123,
            "quantity": 2,
            "name": "Product Name",
            "short_description": "...",
            "sku": "PROD-123",
            "prices": {
                "price": "1999",
                "regular_price": "2499",
                "sale_price": "1999",
                "currency_code": "USD"
            },
            "totals": {
                "line_subtotal": "3998",
                "line_total": "3998"
            },
            "images": [...],
            "variation": []
        }
    ],
    "totals": {
        "total_items": "3998",
        "total_items_tax": "0",
        "total_shipping": "500",
        "total_price": "4498"
    },
    "item_count": 2
}
```

### Add Item to Cart

```
POST /wc/store/v1/cart/add-item
```

**Request Body:**
```json
{
    "id": 123,
    "quantity": 1,
    "variation": [
        {
            "attribute": "pa_size",
            "value": "large"
        }
    ]
}
```

**Headers:**
```
Content-Type: application/json
Nonce: {wc_store_api_nonce}
```

### Update Cart Item

```
POST /wc/store/v1/cart/update-item
```

**Request Body:**
```json
{
    "key": "abc123...",
    "quantity": 3
}
```

### Remove Cart Item

```
POST /wc/store/v1/cart/remove-item
```

**Request Body:**
```json
{
    "key": "abc123..."
}
```

---

## JavaScript Usage

### Using Fetch

```javascript
const wcStoreApiNonce = window.wcBlocksMiddleware?.nonce || '';

async function addToCart(productId, quantity = 1) {
    const response = await fetch('/wp-json/wc/store/v1/cart/add-item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Nonce': wcStoreApiNonce,
        },
        body: JSON.stringify({
            id: productId,
            quantity: quantity,
        }),
        credentials: 'same-origin',
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
    }
    
    return response.json();
}
```

### Using WooCommerce Interactivity Store

```javascript
import { store } from '@wordpress/interactivity';

// Access WooCommerce's cart store
const { state: wooState, actions } = store('woocommerce', {});

// Add item
yield actions.addCartItem({
    id: productId,
    quantity: quantityToAdd,
    type: productType,
});

// Get cart items
const cartItems = wooState.cart?.items || [];

// Find specific product in cart
const productInCart = cartItems.find(item => item.id === productId);
const currentQuantity = productInCart?.quantity || 0;
```

---

## Product Endpoints

### Get Products

```
GET /wc/store/v1/products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `per_page` | int | Number of products (default: 10) |
| `page` | int | Page number |
| `search` | string | Search term |
| `category` | string | Category slug or ID |
| `orderby` | string | Sort by: date, price, popularity |
| `order` | string | asc or desc |

### Get Single Product

```
GET /wc/store/v1/products/{id}
```

**Response:**
```json
{
    "id": 123,
    "name": "Product Name",
    "slug": "product-name",
    "type": "simple",
    "permalink": "https://example.com/product/product-name/",
    "sku": "PROD-123",
    "prices": {
        "price": "1999",
        "regular_price": "2499",
        "sale_price": "1999",
        "currency_code": "USD",
        "currency_symbol": "$",
        "currency_minor_unit": 2,
        "currency_decimal_separator": ".",
        "currency_thousand_separator": ","
    },
    "is_purchasable": true,
    "is_in_stock": true,
    "add_to_cart": {
        "text": "Add to cart",
        "description": "Add "Product Name" to your cart",
        "url": "https://example.com/?add-to-cart=123",
        "minimum": 1,
        "maximum": 99
    },
    "images": [
        {
            "id": 456,
            "src": "https://example.com/wp-content/uploads/image.jpg",
            "alt": "Product image"
        }
    ]
}
```

---

## Error Handling

### Error Response Format

```json
{
    "code": "woocommerce_rest_cart_invalid_product",
    "message": "This product cannot be added to the cart.",
    "data": {
        "status": 400
    }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `woocommerce_rest_cart_invalid_product` | Product doesn't exist or can't be purchased |
| `woocommerce_rest_cart_product_is_not_purchasable` | Product is not purchasable |
| `woocommerce_rest_cart_product_no_stock` | Product is out of stock |
| `woocommerce_rest_cart_invalid_key` | Cart item key is invalid |

---

## Nonce Handling

WooCommerce requires a nonce for cart modifications:

```javascript
// Get nonce from WooCommerce blocks middleware
const nonce = window.wcBlocksMiddleware?.nonce;

// Or from settings
const nonce = wc_add_to_cart_params?.wc_ajax_url 
    ? new URL(wc_add_to_cart_params.wc_ajax_url).searchParams.get('_wpnonce')
    : '';
```

---

## Cart State in Interactivity API

WooCommerce's cart state structure:

```typescript
interface CartState {
    cart: {
        items: CartItem[];
        totals: CartTotals;
        coupons: Coupon[];
        shipping_rates: ShippingRate[];
        errors: CartError[];
        payment_methods: PaymentMethod[];
        item_count: number;
    };
}

interface CartItem {
    key: string;
    id: number;
    quantity: number;
    name: string;
    sku: string;
    prices: ItemPrices;
    totals: ItemTotals;
    images: Image[];
    variation: Variation[];
}
```

---

## Best Practices

1. **Always include nonce** for POST requests
2. **Handle errors gracefully** - check response status
3. **Use credentials: 'same-origin'** for authenticated requests
4. **Cache product data** when possible
5. **Debounce quantity updates** to prevent rapid API calls
6. **Show loading states** during cart operations
7. **Update UI optimistically** then sync with response
