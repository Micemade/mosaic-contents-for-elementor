---
name: woocommerce-setup
description: Use when starting a new WooCommerce extension, setting up plugin headers, checking WooCommerce availability, declaring HPOS and block checkout compatibility with FeaturesUtil, or understanding WooCommerce extension architecture. Covers Requires Plugins header, WC requires at least, WC tested up to, before_woocommerce_init, declare_compatibility for custom_order_tables and cart_checkout_blocks, plugins_loaded initialization, class_exists WooCommerce check, and Interactivity API store privacy (lock true).
---

# WooCommerce Extension Architecture

Reference for WooCommerce extension setup, plugin headers, compatibility
declarations, and architecture fundamentals.

For specific topics see the related skills:
- **woocommerce-payments** — Payment gateways, block checkout integration
- **woocommerce-data** — Order/product/customer CRUD, HPOS, Store API, REST API
- **woocommerce-hooks** — Hooks, settings pages, custom emails, WP-CLI, testing

---

## 1. Check WooCommerce Is Active

Always gate your plugin on WooCommerce availability:

```php
add_action( 'plugins_loaded', 'mce_init' );

function mce_init(): void {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', function (): void {
            echo '<div class="error"><p>' .
                esc_html__( 'My Extension requires WooCommerce.', 'my-extension' ) .
                '</p></div>';
        } );
        return;
    }
    // Safe to use WooCommerce APIs from here.
}
```

---

## 2. Plugin Header

```php
/**
 * Plugin Name: My WooCommerce Extension
 * Plugin URI:  https://example.com/my-extension
 * Description: Extends WooCommerce with custom features.
 * Version:     1.0.0
 * Author:      Your Name
 * Requires Plugins: woocommerce
 * WC requires at least: 8.0
 * WC tested up to: 10.4
 * Requires PHP: 7.4
 */
```

| Header | Purpose |
|--------|---------|
| `Requires Plugins: woocommerce` | WordPress 6.5+ enforces the dependency automatically |
| `WC requires at least` | Minimum WooCommerce version |
| `WC tested up to` | Latest tested WooCommerce version (shows in admin) |

---

## 3. Declaring Feature Compatibility

```php
add_action( 'before_woocommerce_init', function (): void {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        // Declare HPOS compatibility.
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
        // Declare Block Checkout compatibility.
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'cart_checkout_blocks',
            __FILE__,
            true
        );
    }
} );
```

| Feature key | What it declares |
|-------------|-----------------|
| `custom_order_tables` | HPOS (High-Performance Order Storage) compatibility |
| `cart_checkout_blocks` | Block Checkout compatibility |

---

## 4. Interactivity API Stores Are Private

All WooCommerce Interactivity API stores use `lock: true` — they are **not
extensible**. Removing or changing store state/selectors is not a breaking
change. Do not depend on WC store internals in your extension.

---

## 5. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not checking if WooCommerce is active | Wrap init in `class_exists('WooCommerce')` check |
| Not declaring HPOS compatibility | Add `FeaturesUtil::declare_compatibility('custom_order_tables', ...)` |
| Not declaring Block Checkout compatibility | Add `FeaturesUtil::declare_compatibility('cart_checkout_blocks', ...)` |
| Using `new` for DI-managed WC classes | Use `wc_get_container()->get( ClassName::class )` for `src/` singletons |
| Depending on WC Interactivity API stores | All WC stores are `lock: true` (private) — can change without notice |
| Missing `Requires Plugins: woocommerce` header | Add it — WordPress 6.5+ enforces the dependency |

---

## Related Skills

- **woocommerce-payments** — Payment gateways, block checkout integration, tokenization
- **woocommerce-data** — HPOS, order/product/customer CRUD, Store API, REST API
- **woocommerce-hooks** — Hooks, settings pages, custom emails, WP-CLI, testing
