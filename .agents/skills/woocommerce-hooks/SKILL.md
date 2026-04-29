---
name: woocommerce-hooks
description: Use when hooking into WooCommerce events, adding custom checkout fields, modifying cart behavior, or extending WooCommerce admin. Covers woocommerce_new_order, woocommerce_checkout_order_processed, woocommerce_payment_complete, woocommerce_order_status_changed, woocommerce_order_status_{status}, woocommerce_add_to_cart, woocommerce_cart_calculate_fees, woocommerce_before_calculate_totals, woocommerce_checkout_fields, woocommerce_checkout_process, woocommerce_product_options_general_product_data, woocommerce_process_product_meta, woocommerce_email_classes, woocommerce_settings_tabs_array, settings pages, custom WC_Email classes, WP-CLI wc commands, and WC_Unit_Test_Case testing patterns.
---

# WooCommerce Hooks, Settings, Emails & Testing

Reference for WooCommerce action/filter hooks, settings pages, custom emails,
WP-CLI integration, and testing patterns.

---

## 1. Order Lifecycle Hooks

| Hook (Action)                            | When                                     |
|------------------------------------------|------------------------------------------|
| `woocommerce_new_order`                  | Order first created                      |
| `woocommerce_checkout_order_processed`   | After checkout places order              |
| `woocommerce_payment_complete`           | Payment marked complete                  |
| `woocommerce_order_status_changed`       | Any status transition ($old, $new, $order)|
| `woocommerce_order_status_{status}`      | Transitioned to specific status          |
| `woocommerce_order_refunded`             | Refund processed                         |

### Example: React to Status Change

```php
add_action( 'woocommerce_order_status_changed', function ( int $order_id, string $old, string $new, WC_Order $order ): void {
    if ( 'completed' === $new ) {
        // Trigger sync, send notification, etc.
    }
}, 10, 4 );
```

---

## 2. Cart & Checkout Hooks

| Hook                                      | Type   | Purpose                              |
|-------------------------------------------|--------|--------------------------------------|
| `woocommerce_add_to_cart`                 | Action | Item added to cart                   |
| `woocommerce_cart_calculate_fees`         | Action | Add custom fees                      |
| `woocommerce_before_calculate_totals`     | Action | Modify cart items before totals      |
| `woocommerce_cart_item_price`             | Filter | Modify displayed cart item price     |
| `woocommerce_checkout_fields`             | Filter | Add/modify checkout fields           |
| `woocommerce_checkout_process`            | Action | Validate checkout before processing  |

### Example: Add Custom Fee

```php
add_action( 'woocommerce_cart_calculate_fees', function ( WC_Cart $cart ): void {
    if ( $cart->get_subtotal() > 100 ) {
        $cart->add_fee( __( 'Handling fee', 'my-extension' ), 5.00 );
    }
} );
```

### Example: Add Custom Checkout Field

```php
add_filter( 'woocommerce_checkout_fields', function ( array $fields ): array {
    $fields['billing']['billing_custom'] = array(
        'type'     => 'text',
        'label'    => __( 'Custom Field', 'my-extension' ),
        'required' => false,
        'priority' => 120,
    );
    return $fields;
} );

// Save the field value to order meta.
add_action( 'woocommerce_checkout_update_order_meta', function ( int $order_id ): void {
    if ( ! empty( $_POST['billing_custom'] ) ) {
        $order = wc_get_order( $order_id );
        $order->update_meta_data( '_billing_custom', sanitize_text_field( wp_unslash( $_POST['billing_custom'] ) ) );
        $order->save();
    }
} );
```

---

## 3. Product Hooks

| Hook                                      | Type   | Purpose                              |
|-------------------------------------------|--------|--------------------------------------|
| `woocommerce_product_options_general_product_data` | Action | Add fields to General tab    |
| `woocommerce_process_product_meta`        | Action | Save custom product fields           |
| `woocommerce_single_product_summary`      | Action | Output on single product page        |
| `woocommerce_product_get_price`           | Filter | Modify product price dynamically     |
| `woocommerce_is_purchasable`              | Filter | Control whether product can be bought|

### Example: Custom Product Field

```php
add_action( 'woocommerce_product_options_general_product_data', function (): void {
    woocommerce_wp_text_input( array(
        'id'          => '_mce_custom_field',
        'label'       => __( 'Custom Field', 'my-extension' ),
        'description' => __( 'Enter a custom value.', 'my-extension' ),
        'desc_tip'    => true,
    ) );
} );

add_action( 'woocommerce_process_product_meta', function ( int $post_id ): void {
    $product = wc_get_product( $post_id );
    $value   = isset( $_POST['_mce_custom_field'] ) ? sanitize_text_field( wp_unslash( $_POST['_mce_custom_field'] ) ) : '';
    $product->update_meta_data( '_mce_custom_field', $value );
    $product->save();
} );
```

---

## 4. Email Hooks

| Hook                                      | Purpose                                  |
|-------------------------------------------|------------------------------------------|
| `woocommerce_email_classes`               | Register custom email classes            |
| `woocommerce_email_order_details`         | Add content to order emails              |
| `woocommerce_email_before_order_table`    | Content before order table in emails     |
| `woocommerce_email_after_order_table`     | Content after order table in emails      |

### Custom Email Class

Register via the `woocommerce_email_classes` filter. Extend `WC_Email`, set
`$this->template_html` and `$this->template_base`, wire a trigger action.

```php
add_filter( 'woocommerce_email_classes', function ( array $emails ): array {
    $emails['MCE_Custom_Email'] = new MCE_Custom_Email();
    return $emails;
} );
```

Key `WC_Email` properties: `id`, `title`, `description`, `heading`, `subject`,
`template_html`, `template_plain`, `template_base`, `recipient`.

---

## 5. Admin Hooks

| Hook                                      | Purpose                                  |
|-------------------------------------------|------------------------------------------|
| `woocommerce_admin_order_data_after_billing_address` | Add fields after billing    |
| `woocommerce_admin_order_data_after_shipping_address`| Add fields after shipping   |
| `manage_edit-shop_order_columns`          | Add columns to orders list               |
| `woocommerce_product_data_tabs`           | Add product data tabs                    |
| `woocommerce_product_data_panels`         | Render product data tab panels           |

---

## 6. Settings Page

Add a WooCommerce settings tab:

```php
// Register tab.
add_filter( 'woocommerce_settings_tabs_array', function ( array $tabs ): array {
    $tabs['mce_settings'] = __( 'My Extension', 'my-extension' );
    return $tabs;
}, 50 );

// Render fields.
add_action( 'woocommerce_settings_tabs_mce_settings', function (): void {
    woocommerce_admin_fields( mce_get_settings() );
} );

// Save fields.
add_action( 'woocommerce_update_options_mce_settings', function (): void {
    woocommerce_update_options( mce_get_settings() );
} );
```

### Settings Field Types

| Type         | Description                          |
|--------------|--------------------------------------|
| `text`       | Text input                           |
| `textarea`   | Multi-line text                      |
| `checkbox`   | Enable/disable toggle                |
| `select`     | Dropdown with `options` array        |
| `multiselect`| Multiple selection                   |
| `radio`      | Radio buttons                        |
| `number`     | Numeric input                        |
| `password`   | Password field                       |
| `color`      | Color picker                         |
| `title`      | Section heading (no input)           |
| `sectionend` | Closes a section                     |

---

## 7. Hook Callback Naming Convention

Name hook callbacks `handle_{hook_name}` with `@internal` annotation:

```php
/**
 * Handle the woocommerce_order_status_changed hook.
 *
 * @internal
 */
public function handle_woocommerce_order_status_changed( int $order_id, string $old, string $new ): void {
    // ...
}
```

---

## 8. WP-CLI for WooCommerce

```bash
# Products.
wp wc product list --user=1
wp wc product create --name="Test" --regular_price="9.99" --user=1

# Orders.
wp wc order list --status=processing --user=1
wp wc order update <id> --status=completed --user=1

# Customers.
wp wc customer list --user=1

# Tools.
wp wc tool run clear_transients --user=1
wp wc tool run clear_template_cache --user=1
```

### Custom WP-CLI Command

```php
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    WP_CLI::add_command( 'mce sync', function ( $args, $assoc_args ): void {
        $orders = wc_get_orders( array( 'status' => 'processing', 'limit' => -1 ) );
        $progress = \WP_CLI\Utils\make_progress_bar( 'Syncing orders', count( $orders ) );
        foreach ( $orders as $order ) {
            // Sync logic.
            $progress->tick();
        }
        $progress->finish();
        WP_CLI::success( sprintf( 'Synced %d orders.', count( $orders ) ) );
    } );
}
```

---

## 9. Testing

Extend `WC_Unit_Test_Case`. Name the variable under test `$sut` ("System Under
Test"). Use `@testdox` in every test docblock:

```php
class MCE_Order_Sync_Test extends WC_Unit_Test_Case {
    private $sut;

    public function setUp(): void {
        parent::setUp();
        $this->sut = new \MyExtension\MCE_Order_Sync();
    }

    /** @testdox Should sync order when status is processing. */
    public function test_syncs_processing_order(): void {
        $order = wc_create_order();
        $order->set_status( 'processing' );
        $order->save();
        $result = $this->sut->sync( $order->get_id() );
        $this->assertTrue( $result );
    }
}
```

---

## 10. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Modifying cart totals with direct property access | Use `woocommerce_before_calculate_totals` hook |
| Standalone functions outside classes | Use class methods — standalone functions are hard to mock |
| `call_user_func_array` with associative keys | Use positional arrays — keys are silently ignored |
| Depending on WC Interactivity API stores | All WC stores are `lock: true` (private) — can change without notice |

---

## Related Skills

- **woocommerce-setup** — Extension architecture, plugin headers, FeaturesUtil
- **woocommerce-payments** — Payment gateways, block checkout integration
- **woocommerce-data** — Order/product CRUD, HPOS, Store API, REST API
