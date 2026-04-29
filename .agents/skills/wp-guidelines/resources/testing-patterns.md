# Testing Patterns -- Detailed Examples

Extended code examples for Section 9 of the WordPress Coding Standards skill.

---

## 9. Testing

### 9.1 PHP Testing

- Use **PHPUnit** with the WordPress test framework (`WP_UnitTestCase`).
- Install via `composer require --dev phpunit/phpunit` or use `wp scaffold plugin-tests`.
- Test files go in `tests/` directory.
- Class test files: `test-class-{name}.php` or `class-test-{name}.php`.

```php
class Test_Acme_Feature extends WP_UnitTestCase {
    public function test_something_returns_expected() {
        $result = acme_do_something();
        $this->assertEquals( 'expected', $result );
    }
}
```

### 9.2 JavaScript Testing

- Use `@wordpress/scripts` which bundles Jest: `npx wp-scripts test-unit-js`.
- Tests in `__tests__/` or `*.test.js` files.
- For E2E: `@wordpress/e2e-test-utils` with Puppeteer/Playwright.

### 9.3 Linting

```bash
# PHP coding standards
composer require --dev wp-coding-standards/wpcs dealerdirect/phpcodesniffer-composer-installer
vendor/bin/phpcs --standard=WordPress src/

# JS/CSS lint
npx wp-scripts lint-js
npx wp-scripts lint-style
```
