---
name: woocommerce-data
description: Use when working with WooCommerce orders, products, or customers. Covers HPOS (High-Performance Order Storage, OrdersTableDataStore, custom_order_tables), wc_get_order, wc_get_orders, WC_Order CRUD methods (get_total, get_status, get_meta, set_status, update_meta_data, save), wc_get_product, WC_Product types (simple, variable, variation, grouped, external), WC_Customer, WC_Data, meta_query, Store API (/wc/store/v1/, ExtendSchema, CartItemSchema), WooCommerce REST API (/wc/v3/, consumer key authentication), and wc_get_container DI container.
---

# WooCommerce Data — Orders, Products & APIs

Reference for HPOS-compatible data access, product/customer CRUD, Store API,
and REST API integration.

---

## 1. HPOS (High-Performance Order Storage)

Since WooCommerce 8.2, HPOS is the default order storage for new installs.
Orders are stored in custom tables, not `wp_postmeta`.

### Accessing Order Data (HPOS-Compatible)

```php
// Always use CRUD methods — never direct SQL or get_post_meta().
$order = wc_get_order( $order_id );

// Read.
$total    = $order->get_total();
$status   = $order->get_status();
$billing  = $order->get_billing_email();
$meta     = $order->get_meta( '_mce_transaction_id' );

// Write.
$order->set_status( 'completed' );
$order->update_meta_data( '_mce_transaction_id', 'txn_123' );
$order->save();
```

### Querying Orders

```php
// Use wc_get_orders() — works with both HPOS and legacy storage.
$orders = wc_get_orders( array(
    'status'     => 'processing',
    'limit'      => 50,
    'orderby'    => 'date',
    'order'      => 'DESC',
    'meta_query' => array(
        array(
            'key'   => '_mce_synced',
            'value' => 'no',
        ),
    ),
) );
```

### Declare HPOS Compatibility

```php
add_action( 'before_woocommerce_init', function (): void {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables', __FILE__, true
        );
    }
} );
```

### What NOT to Do

| Deprecated Pattern                           | HPOS-Compatible Alternative                   |
|----------------------------------------------|-----------------------------------------------|
| `get_post_meta( $order_id, '_key', true )`   | `$order->get_meta( '_key' )`                  |
| `update_post_meta( $order_id, '_key', $v )`  | `$order->update_meta_data( '_key', $v ); $order->save();` |
| `new WP_Query( ['post_type'=>'shop_order'] )`| `wc_get_orders( [...] )`                      |
| Direct SQL on `wp_posts`/`wp_postmeta`       | Use `OrdersTableDataStore` or CRUD methods    |
| `get_post( $order_id )`                      | `wc_get_order( $order_id )`                   |

---

## 2. Product CRUD

```php
// Read.
$product = wc_get_product( $product_id );
$name    = $product->get_name();
$price   = $product->get_price();
$sku     = $product->get_sku();
$stock   = $product->get_stock_quantity();
$type    = $product->get_type();            // simple, variable, grouped, external.
$meta    = $product->get_meta( '_mce_custom' );

// Write.
$product->set_regular_price( '29.99' );
$product->update_meta_data( '_mce_custom', 'value' );
$product->save();
```

### Product Types

| Class                    | Type       | Use Case                        |
|--------------------------|------------|---------------------------------|
| `WC_Product_Simple`      | `simple`   | Standard product                |
| `WC_Product_Variable`    | `variable` | Product with variations         |
| `WC_Product_Variation`   | `variation`| Single variation of a variable  |
| `WC_Product_Grouped`     | `grouped`  | Collection of simple products   |
| `WC_Product_External`    | `external` | Affiliate / external product    |

---

## 3. Customer CRUD

```php
$customer = new WC_Customer( $user_id );
$email    = $customer->get_email();
$orders   = $customer->get_order_count();
$spent    = $customer->get_total_spent();

$customer->update_meta_data( '_mce_loyalty', 'gold' );
$customer->save();
```

---

## 4. Data Integrity

Always verify entity state before deletion or modification:

```php
// Verify order status before deletion.
$order = wc_get_order( $order_id );
if ( ! $order || ! in_array( $order->get_status(), array( 'draft', 'checkout-draft' ), true ) ) {
    return false;  // Don't delete non-draft orders.
}
$order->delete( true );

// Verify ownership in batch operations.
foreach ( $order_ids as $id ) {
    $order = wc_get_order( $id );
    if ( $order && (int) $order->get_customer_id() === get_current_user_id() ) {
        $order->delete( true );
    }
}
```

**Checklist:** entity exists → correct state → correct owner → race-condition safe
→ check return value of delete/save.

---

## 5. DI Container

WooCommerce `src/` classes use dependency injection:

```php
$instance = wc_get_container()->get( \Automattic\WooCommerce\Internal\SomeClass::class );
```

Internal classes (`src/Internal/`) are private API — only rely on documented APIs.

---

## 6. Store API (Cart & Checkout)

The Store API is an **unauthenticated** public REST API for customer-facing
cart, checkout, and product functionality.

### Key Endpoints

| Method   | Endpoint                     | Purpose                   |
|----------|------------------------------|---------------------------|
| `GET`    | `/wc/store/v1/products`      | List products             |
| `GET`    | `/wc/store/v1/cart`          | Get current cart           |
| `POST`   | `/wc/store/v1/cart/add-item` | Add item to cart          |
| `POST`   | `/wc/store/v1/checkout`      | Place order               |
| `PUT`    | `/wc/store/v1/checkout`      | Update order (9.8+)       |

### Extending Store API

Use `ExtendSchema` to add custom data to Store API responses:

```php
use Automattic\WooCommerce\StoreApi\StoreApi;
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartItemSchema;

add_action( 'woocommerce_blocks_loaded', function (): void {
    $extend = StoreApi::container()->get(
        \Automattic\WooCommerce\StoreApi\Schemas\ExtendSchema::class
    );
    $extend->register_endpoint_data( array(
        'endpoint'        => CartItemSchema::IDENTIFIER,
        'namespace'       => 'my-extension',
        'data_callback'   => function ( array $cart_item ): array {
            return array(
                'custom_label' => get_post_meta( $cart_item['product_id'], '_mce_label', true ),
            );
        },
        'schema_callback' => function (): array {
            return array(
                'custom_label' => array(
                    'type'        => 'string',
                    'description' => 'Custom product label',
                    'readonly'    => true,
                ),
            );
        },
    ) );
} );
```

---

## 7. WooCommerce REST API

The REST API is **authenticated** (consumer key + secret) for admin/back-office operations.

```bash
# Generate keys at WooCommerce > Settings > Advanced > REST API.
curl https://example.com/wp-json/wc/v3/products -u ck_xxx:cs_xxx
```

### Namespaces

| Namespace       | Purpose                                |
|-----------------|----------------------------------------|
| `wc/v3`         | Core CRUD (products, orders, customers)|
| `wc/store/v1`   | Store API (unauthenticated, cart/checkout) |
| `wc-admin`      | Admin analytics and reports            |
| `wc-analytics`  | Analytics data                         |

### Common Endpoints

| Endpoint            | Methods          | Description          |
|---------------------|------------------|----------------------|
| `/wc/v3/products`   | GET, POST        | Products CRUD        |
| `/wc/v3/orders`     | GET, POST        | Orders CRUD          |
| `/wc/v3/customers`  | GET, POST        | Customers CRUD       |
| `/wc/v3/coupons`    | GET, POST        | Coupons CRUD         |
| `/wc/v3/reports`    | GET              | Sales reports        |
| `/wc/v3/webhooks`   | GET, POST        | Webhook management   |

---

## 8. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `get_post_meta()` for order data | Use `$order->get_meta()` — required for HPOS |
| `new WP_Query(['post_type'=>'shop_order'])` | Use `wc_get_orders()` — works with HPOS and legacy |
| Not declaring HPOS compatibility | Add `FeaturesUtil::declare_compatibility('custom_order_tables', ...)` |
| Calling `$order->set_status()` without `save()` | CRUD changes are only persisted after `save()` |
| Direct SQL queries on order tables | Use WC CRUD or `wc_get_orders()` |
| Using `$woocommerce` global instead of `WC()` | Use the `WC()` function — it's the singleton accessor |
| Deleting orders without verifying status | Check `$order->get_status()` before `$order->delete()` |
| Batch operations without per-item validation | Verify each item exists, has correct state and correct owner |

---

## Related Skills

- **woocommerce-setup** — Extension architecture, plugin headers, FeaturesUtil
- **woocommerce-payments** — Payment gateways, block checkout integration
- **woocommerce-hooks** — Order lifecycle hooks, cart hooks, product hooks
