---
name: woocommerce-payments
description: Use when building WooCommerce payment gateways, checkout integrations, or payment processing. Covers WC_Payment_Gateway, WC_Payment_Gateway_CC, process_payment, process_refund, tokenization, saved payment methods, init_form_fields, validate_fields, wc_add_notice, Block Checkout (AbstractPaymentMethodType, wc.wcBlocksRegistry, registerPaymentMethod), cart_checkout_blocks compatibility, and classic-to-block checkout migration.
---

# WooCommerce Payment Gateway Development

Reference for building payment gateways with classic and block checkout support.

---

## 1. Gateway Registration

```php
add_filter( 'woocommerce_payment_gateways', function ( array $gateways ): array {
    $gateways[] = 'MCE_Gateway';
    return $gateways;
} );
```

Extend `WC_Payment_Gateway` and implement `process_payment()` and optionally
`process_refund()`.

---

## 2. Supported Features

| Feature            | Description                              |
|--------------------|------------------------------------------|
| `products`         | Standard product payments                |
| `refunds`          | Admin refund processing                  |
| `subscriptions`    | WooCommerce Subscriptions support        |
| `tokenization`     | Saved payment methods                    |
| `pre-orders`       | Pre-order charge scheduling              |

---

## 3. Gateway Class Structure

Key methods to implement:

| Method | Purpose |
|--------|---------|
| `__construct()` | Set `$this->id`, `$this->supports`, call `init_form_fields()` and `init_settings()` |
| `init_form_fields()` | Define admin settings (enabled, title, description, API keys) |
| `process_payment( $order_id )` | Process payment — return `['result' => 'success', 'redirect' => $url]` or `['result' => 'failure']` |
| `process_refund( $order_id, $amount, $reason )` | Process refund — return `true` or `WP_Error` |
| `validate_fields()` | Validate checkout fields — call `wc_add_notice()` on errors, return `bool` |

### Payment Flow

```
Customer clicks "Place Order"
    → validate_fields()
    → process_payment( $order_id )
        → Call external API
        → $order->payment_complete()
        → WC()->cart->empty_cart()
        → Return redirect to thank-you page
```

### Tokenization (Saved Cards)

Extend `WC_Payment_Gateway_CC` (credit cards) or `WC_Payment_Gateway_eCheck` for
built-in tokenization UI. Add `'tokenization'` to `$this->supports` and implement
`add_payment_method()`.

<!-- Full gateway class skeleton: resources/gateway-skeleton.md -->

---

## 4. Block Checkout Integration

The Block Checkout (default since WooCommerce 8.3) requires **separate registration**
from the classic `WC_Payment_Gateway`.

### Architecture

```
Classic Checkout          Block Checkout
─────────────────         ─────────────────
WC_Payment_Gateway   +    AbstractPaymentMethodType (server)
                          registerPaymentMethod()   (client JS)
```

### Server-Side: AbstractPaymentMethodType

| Method | Purpose |
|--------|---------|
| `initialize()` | Load settings from `get_option()` |
| `is_active()` | Return whether gateway is enabled |
| `get_payment_method_script_handles()` | Register and return JS handles |
| `get_payment_method_data()` | Return title, description, supports array for JS |

Register with:
```php
add_action( 'woocommerce_blocks_payment_method_type_registration', function ( $registry ): void {
    $registry->register( new MCE_Block_Gateway() );
} );
```

### Client-Side: registerPaymentMethod

```js
const { registerPaymentMethod } = wc.wcBlocksRegistry;

registerPaymentMethod( {
    name: 'mce_gateway',
    label: 'My Gateway',
    content: React.createElement( 'div', null, 'Pay with My Gateway.' ),
    edit: React.createElement( 'div', null, '[My Gateway]' ),
    canMakePayment: () => true,
    ariaLabel: 'My Gateway',
    supports: { features: [ 'products' ] },
} );
```

### Declare Compatibility

```php
add_action( 'before_woocommerce_init', function (): void {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'cart_checkout_blocks', __FILE__, true
        );
    }
} );
```

<!-- Full server-side class: resources/gateway-skeleton.md -->

---

## 5. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Only implementing classic checkout | Register `AbstractPaymentMethodType` for block checkout too |
| Not declaring block checkout compatibility | Add `FeaturesUtil::declare_compatibility('cart_checkout_blocks', ...)` |
| Missing `validate_fields()` | Always validate before `process_payment()` |
| Not calling `$order->payment_complete()` | Required to trigger order status change and emails |
| Forgetting `WC()->cart->empty_cart()` | Cart persists after payment without this |
| Hard-coding currency/amount format | Use `$order->get_total()` and WC formatting functions |

---

## Related Skills

- **woocommerce-setup** — Extension architecture, plugin headers, FeaturesUtil
- **woocommerce-data** — Order/product CRUD, HPOS, Store API, REST API
- **woocommerce-hooks** — Order lifecycle hooks, checkout hooks, email hooks
