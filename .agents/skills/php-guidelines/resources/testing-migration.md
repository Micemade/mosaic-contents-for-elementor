# Testing & Version Migration Reference

## Testing

```php
class UserTest extends TestCase {
    public function testCreateUser(): void {
        $user = new User('Alice', 30);
        $this->assertSame('Alice', $user->getName());
    }

    #[DataProvider('ageProvider')]
    public function testAgeValidation(int $age, bool $valid): void {
        if (!$valid) {
            $this->expectException(\InvalidArgumentException::class);
        }
        new User('Test', $age);
    }

    public static function ageProvider(): array {
        return [
            'valid' => [25, true],
            'zero' => [0, false],
            'negative' => [-1, false],
        ];
    }
}
```

| Rule | Detail |
|------|--------|
| `assertSame()` over `assertEquals()` | Strict comparison (type + value) |
| Data providers for table-driven tests | `#[DataProvider('method')]` attribute |
| `expectException()` before the call | Not after |
| Test naming | `*Test.php`, method `test*` |
| `t.Helper()` equivalent | N/A — PHP traces show full stack |

### Static Analysis

| Tool | Usage |
|------|-------|
| PHPStan | `composer require --dev phpstan/phpstan` — levels 0-9 strictness, start low and increase |
| Psalm | `composer require --dev vimeo/psalm` — similar to PHPStan, adds taint analysis for security |

```bash
# Run in CI and locally before commits
vendor/bin/phpstan analyse src/ --level=6
vendor/bin/psalm --show-info=false
```

| Rule | Detail |
|------|--------|
| Baseline file for legacy code | `phpstan.neon` with `ignoreErrors`, reduce over time |
| Level progression | Start level 0, increase one level per sprint/cycle |
| CI gate | Fail build on any new error — never ignore regressions |
| Psalm taint analysis | Detects SQL injection, XSS flows automatically — see `php-security` |

---

## PHP Version Migration Reference

### PHP 8.0

**Adopt:** named args, union types, match, constructor promotion, nullsafe `?->`, attributes, `throw` as expression, `static` return type, `str_contains()`, `str_starts_with()`, `str_ends_with()`

**Breaking:** `0 == "a"` now false; internal functions throw TypeError on wrong types; private methods not inherited; `\Stringable` interface auto-implemented

### PHP 8.1

**Adopt:** enums, readonly properties, fibers, intersection types, `never` type, first-class callables `fn(...)`, `new` in initializers, `array_is_list()`, `final` class constants

**Stop using:** passing `null` to non-nullable internals; implicit float-to-int; `Serializable` without `__serialize()`

### PHP 8.2

**Adopt:** readonly classes, DNF types `(A&B)|C`, `true`/`false`/`null` as standalone types, trait constants, `Random\Randomizer`

**Stop using:** dynamic properties; `${var}` interpolation; `utf8_encode()`/`utf8_decode()`

### PHP 8.3

**Adopt:** typed class constants, `#[Override]`, dynamic constant fetch `C::{$name}`, `json_validate()`, `str_increment()`/`str_decrement()`

**Stop using:** `get_class()` without arg (use `$obj::class`); string increment on non-alphanumeric

### PHP 8.4

**Adopt:** property hooks, asymmetric visibility `private(set)`, `#[Deprecated]` attribute, lazy objects, `new` without parens in chain, `mb_trim()`/`mb_ltrim()`/`mb_rtrim()`

**Stop using:** implicit nullable `f(Type $x = null)` (use `?Type`); `trigger_error(E_USER_ERROR)` (use exceptions)

### PHP 8.5

**Adopt:** pipe operator `|>`, `#[NoDiscard]`, `(void)` cast, closures in constants, attributes on constants, `#[Override]` on properties

**Stop using:** `(boolean)`/`(integer)`/`(double)` casts; backtick operator; `__sleep()`/`__wakeup()`
