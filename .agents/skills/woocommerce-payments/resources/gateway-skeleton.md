# Payment Gateway — Full Code Examples

Detailed code for the WooCommerce Payment Gateway API. See the main `SKILL.md`
for the Supported Features table and gateway registration pattern.

---

## Full MCE_Gateway Class Skeleton

```php
add_filter( 'woocommerce_payment_gateways', function ( array $gateways ): array {
    $gateways[] = 'MCE_Gateway';
    return $gateways;
} );

class MCE_Gateway extends WC_Payment_Gateway {

    public function __construct() {
        $this->id                 = 'mce_gateway';
        $this->icon               = '';                         // URL to icon.
        $this->has_fields         = false;                      // true if you render checkout fields.
        $this->method_title       = __( 'My Gateway', 'my-extension' );
        $this->method_description = __( 'Custom payment gateway.', 'my-extension' );

        $this->supports = array( 'products', 'refunds' );

        $this->init_form_fields();
        $this->init_settings();

        $this->title       = $this->get_option( 'title' );
        $this->description = $this->get_option( 'description' );
        $this->enabled     = $this->get_option( 'enabled' );

        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
    }

    public function init_form_fields(): void {
        $this->form_fields = array(
            'enabled' => array(
                'title'   => __( 'Enable/Disable', 'my-extension' ),
                'type'    => 'checkbox',
                'label'   => __( 'Enable My Gateway', 'my-extension' ),
                'default' => 'no',
            ),
            'title' => array(
                'title'       => __( 'Title', 'my-extension' ),
                'type'        => 'text',
                'description' => __( 'Payment title the customer sees.', 'my-extension' ),
                'default'     => __( 'My Gateway', 'my-extension' ),
            ),
            'description' => array(
                'title'       => __( 'Description', 'my-extension' ),
                'type'        => 'textarea',
                'default'     => __( 'Pay via My Gateway.', 'my-extension' ),
            ),
        );
    }

    public function process_payment( $order_id ): array {
        $order = wc_get_order( $order_id );

        // Call external API, validate, etc.
        $success = true;

        if ( ! $success ) {
            wc_add_notice( __( 'Payment failed.', 'my-extension' ), 'error' );
            return array( 'result' => 'failure' );
        }

        $order->payment_complete();
        WC()->cart->empty_cart();

        return array(
            'result'   => 'success',
            'redirect' => $this->get_return_url( $order ),
        );
    }

    public function process_refund( $order_id, $amount = null, $reason = '' ): bool|WP_Error {
        // Call refund API. Return true on success, WP_Error on failure.
        return true;
    }
}
```

---

## Full Block Checkout Server-Side Class

```php
use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

class MCE_Block_Gateway extends AbstractPaymentMethodType {
    protected $name = 'mce_gateway';

    public function initialize(): void {
        $this->settings = get_option( 'woocommerce_mce_gateway_settings', array() );
    }

    public function is_active(): bool {
        return ! empty( $this->settings['enabled'] ) && 'yes' === $this->settings['enabled'];
    }

    public function get_payment_method_script_handles(): array {
        wp_register_script(
            'mce-gateway-block',
            plugins_url( 'assets/js/block.js', MCE_PLUGIN_FILE ),
            array(),
            '1.0.0',
            true
        );
        return array( 'mce-gateway-block' );
    }

    public function get_payment_method_data(): array {
        return array(
            'title'       => $this->settings['title'] ?? '',
            'description' => $this->settings['description'] ?? '',
            'supports'    => array( 'products' ),
        );
    }
}

// Register with WooCommerce Blocks.
add_action( 'woocommerce_blocks_payment_method_type_registration', function ( $registry ): void {
    $registry->register( new MCE_Block_Gateway() );
} );
```

---

## Validate Fields

```php
public function validate_fields(): bool {
    if ( empty( $_POST['mce_card_number'] ) ) {
        wc_add_notice( __( 'Card number is required.', 'my-extension' ), 'error' );
        return false;
    }
    return true;
}
```
