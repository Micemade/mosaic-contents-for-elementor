# Static Analysis (PHPStan), Coding Standards (PHPCS) & Testing

## PHPStan

### Configuration: phpstan.neon

```neon
includes:
    - phpstan-baseline.neon

parameters:
    level: 5
    paths:
        - includes/
    excludePaths:
        - vendor/
        - vendor-prefixed/
        - node_modules/
        - tests/
    ignoreErrors:
        # Narrow, documented exceptions only.
```

### WordPress Stubs

```bash
# Required for most WordPress plugin/theme repos.
composer require --dev szepeviktor/phpstan-wordpress

# Additional stubs as needed.
composer require --dev php-stubs/wordpress-stubs
composer require --dev php-stubs/woocommerce-stubs
composer require --dev php-stubs/acf-pro-stubs
```

Ensure stubs are loaded in `phpstan.neon`:

```neon
parameters:
    scanFiles:
        - %rootDir%/../../php-stubs/wordpress-stubs/wordpress-stubs.php
    bootstrapFiles:
        - %rootDir%/../../php-stubs/woocommerce-stubs/woocommerce-stubs.php
```

### Baseline for Legacy Code

```bash
# Generate baseline.
vendor/bin/phpstan analyse --generate-baseline phpstan-baseline.neon

# Ongoing: never baseline new errors. Fix them. Chip away at baseline over time.
```

### Level Progression

Start at level 0, increase gradually: 0=basic, 1=undefined vars, 2=unknown
methods, 3=return types, 4=dead code, 5=argument types, 6=missing typehints,
7=union types, 8=nullability, 9=mixed restrictions.

### WordPress-Specific Annotations

```php
// REST request typing.
/** @phpstan-param WP_REST_Request<array{post?: int, per_page?: int}> $request */
public function get_items( WP_REST_Request $request ): WP_REST_Response { ... }

// Hook callbacks — add accurate @param types.
/** @param string $new @param string $old @param WP_Post $post */
function handle_transition( string $new, string $old, WP_Post $post ): void { ... }
add_action( 'transition_post_status', 'handle_transition', 10, 3 );

// Database results — use object shapes.
/** @return array<object{id: int, name: string}> */
function get_user_data(): array { ... }
```

### Third-Party Class Handling

Prefer stubs over ignoreErrors. If stubs unavailable, use targeted patterns:

```neon
parameters:
    ignoreErrors:
        - '#.*(unknown class|call to method .* on an unknown class) WC_.*#'   # WooCommerce
        - '#.*(unknown class|call to method .* on an unknown class) ACF.*#'   # ACF Pro
```

---

## Coding Standards (PHPCS)

```bash
composer require --dev wp-coding-standards/wpcs dealerdirect/phpcodesniffer-composer-installer
```

### phpcs.xml

```xml
<?xml version="1.0"?>
<ruleset name="My Awesome Plugin">
    <file>./includes</file>
    <file>./my-awesome-plugin.php</file>
    <exclude-pattern>./vendor/*</exclude-pattern>
    <exclude-pattern>./node_modules/*</exclude-pattern>
    <arg name="extensions" value="php"/>
    <rule ref="WordPress">
        <exclude name="WordPress.Files.FileName.InvalidClassFileName"/>
    </rule>
    <rule ref="WordPress.WP.I18n">
        <properties>
            <property name="text_domain" type="array">
                <element value="my-awesome-plugin"/>
            </property>
        </properties>
    </rule>
    <config name="minimum_supported_wp_version" value="6.2"/>
</ruleset>
```

Run: `vendor/bin/phpcs` (check) and `vendor/bin/phpcbf` (auto-fix).

---

## Testing

### PHPUnit with wp-phpunit

```json
{
    "require-dev": {
        "yoast/phpunit-polyfills": "^2.0",
        "wp-phpunit/wp-phpunit": "^6.5"
    }
}
```

### Test Class Example

```php
namespace MyAwesomePlugin\Tests;

use WP_UnitTestCase;

class Test_Plugin extends WP_UnitTestCase {

    public function test_activation_creates_table(): void {
        global $wpdb;
        \MyAwesomePlugin\Activator::activate();
        $table = $wpdb->prefix . 'map_logs';
        $this->assertSame( $table, $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) );
    }

    public function test_settings_sanitize(): void {
        $page  = new \MyAwesomePlugin\Admin\Settings_Page();
        $clean = $page->sanitize( [
            'api_key' => '<script>alert(1)</script>', 'max_results' => '-5',
        ] );
        $this->assertSame( '', $clean['api_key'] );
        $this->assertSame( 0, $clean['max_results'] );
    }

    public function test_factory_helpers(): void {
        $id = self::factory()->post->create( [ 'post_title' => 'Test' ] );
        $this->assertSame( 'Test', get_post( $id )->post_title );
    }
}
```

JavaScript tests: `npx wp-scripts test-unit-js`.
