---
name: php-guidelines
description: Use when writing, reviewing, refactoring, building, or deploying PHP code. Covers type system, declare(strict_types=1), union types, intersection types, nullable types, OOP (classes, interfaces, traits, enums, readonly class, constructor promotion), modern PHP 8.x features (match, named arguments, readonly, property hooks, pipe operator, null safe operator ?->, fiber, enum), JSON handling, DI and SOLID principles, PSR-4 autoloading, PSR-12 coding style, PSR standards, Composer, functions, generators, fibers, namespaces, error handling, attributes, arrays, strings, version migration (8.0-8.5), testing, PHPUnit, PHPStan, build/deploy, and anti-patterns. For security see php-security; for performance see php-performance; for networking/regex see php-networking; for internationalization see php-intl.
---

# PHP Guidelines

## Overview

Modern PHP guidelines based on the [PHP Manual](https://www.php.net/manual/en/) covering PHP 8.x idioms. PHP has evolved dramatically — write modern, type-safe PHP, not legacy PHP 5 patterns.

### Core Principles

- **Always use `declare(strict_types=1)`** — first line of every file
- **Type everything** — parameters, returns, properties, constants
- **Use `===` not `==`** — loose comparison causes security bugs
- **Errors are exceptions** — catch them, don't suppress with `@`
- **Composition over inheritance** — interfaces + traits over deep hierarchies

## Strict Types

```php
<?php
declare(strict_types=1);  // MUST be first statement

function add(int $a, int $b): int {
    return $a + $b;
}
add("1", "2"); // TypeError in strict mode, silently coerces without it
```

| Mode | Behavior |
|------|----------|
| Coercive (default) | `"123"` silently becomes `123`, truncates floats |
| Strict (`strict_types=1`) | TypeError on any mismatch (except `int` to `float`) |
| Scope | Per-file — each file must declare independently |

## Type System

### Scalar Types

| Type | Falsy values | Gotchas |
|------|-------------|---------|
| `bool` | `false` | `-1` is truthy; `"0"` is falsy but `"false"` is truthy |
| `int` | `0` | Overflow silently becomes `float`; use `PHP_INT_MAX` |
| `float` | `0.0`, `-0.0` | **Never compare for equality** — use epsilon; `NAN != NAN` |
| `string` | `""`, `"0"` | No native Unicode — use `mbstring`; `"0"` is falsy |
| `null` | `null` | `isset()` returns false for null; use `?Type` or `Type\|null` |

### Type Declarations

```php
// Union types (PHP 8.0+)
function handle(int|string $value): string|false { }

// Intersection types (PHP 8.1+)
function process(Countable&ArrayAccess $data): void { }

// DNF types (PHP 8.2+)
function route((Logger&Handler)|NullHandler $h): void { }

// Nullable shorthand
function get(?int $id): ?string { }  // same as int|null

// Special return types
function loop(): never { while(true) {} }   // never returns
function fire(): void { }                    // returns nothing
```

| Type | Use for |
|------|---------|
| `mixed` | Accepts anything (avoid — be specific) |
| `void` | Function returns nothing visible |
| `never` | Function never returns (exit, throw, infinite loop) |
| `iterable` | `array\|Traversable` |
| `callable` | Parameters/returns only — cannot type properties |
| `self`, `static`, `parent` | Class context references |

### Type Juggling Pitfalls

```php
// BAD: loose comparison — security holes
0 == "a"       // false in PHP 8 (was TRUE in PHP 7!)
"0" == false   // true — "0" is falsy
"" == null     // true
"0" == null    // false (inconsistent!)
"123" == "123.0" // true — numeric string comparison

// GOOD: always strict
0 === "a"      // false
"0" === false  // false

// Float precision trap
0.1 + 0.7 == 0.8   // FALSE — binary representation
floor((0.1 + 0.7) * 10) // 7, not 8!
// Use: abs($a - $b) < PHP_FLOAT_EPSILON
```

## OOP

### Rules Summary

| Rule | Detail |
|------|--------|
| Always declare property types | Untyped properties are error-prone |
| Use `readonly` for immutable data | Can only be set once (PHP 8.1+) |
| Constructor promotion | Reduces boilerplate — use for simple DTOs |
| `private(set)` | Read public, write private (PHP 8.4+) |
| Dynamic properties deprecated | PHP 8.2+ — declare all properties explicitly |
| Reading uninitialized typed property | Throws Error |
| Interface methods must be public | All of them |
| Small interfaces | 1-3 methods — compose larger ones |
| Abstract for shared behavior | Interfaces for contracts |
| `final` prevents extension | Use when inheritance isn't intended |
| `final` class constants (8.1+) | Prevent override in children |
| Use enums over class constants | Type-safe, exhaustive matching (PHP 8.1+) |
| `from()` throws on invalid | `tryFrom()` returns null |
| Enums can have methods and interfaces | But no state (properties) |

> Detailed OOP code examples (classes, interfaces, traits, enums, visibility, magic methods): see `resources/oop-patterns.md`

## Dependency Injection & SOLID

| Principle | Rule |
|-----------|------|
| **S** — Single Responsibility | One class = one reason to change |
| **O** — Open/Closed | Open for extension, closed for modification — use interfaces |
| **L** — Liskov Substitution | Subtypes must be substitutable for their base types |
| **I** — Interface Segregation | Many small interfaces > one large interface |
| **D** — Dependency Inversion | Depend on abstractions (interfaces), not concretions |

| Rule | Detail |
|------|--------|
| Constructor injection | Preferred — makes dependencies explicit |
| Type-hint interfaces | Not concrete classes — enables swapping |
| DI container ≠ DI | Containers are optional convenience; DI is the pattern |
| Avoid Service Locator | Hiding dependencies inside a container = anti-pattern |
| `final` by default | Mark classes `final` unless designed for extension |

> DI code examples and namespace patterns: see `resources/oop-patterns.md`

## PSR Standards & Composer

### PSR Standards

| Standard | Purpose |
|----------|---------|
| **PSR-1** | Basic coding standard — `<?php` tag, UTF-8, class naming |
| **PSR-4** | Autoloading — namespace maps to directory structure |
| **PSR-12** / **PER** | Extended coding style — indentation, braces, spacing |
| **PSR-3** | Logger interface (`Psr\Log\LoggerInterface`) |
| **PSR-7** | HTTP message interfaces (request/response) |
| **PSR-11** | Container interface (`Psr\Container\ContainerInterface`) |
| **PSR-15** | HTTP handlers and middleware |

### Composer

```bash
# Initialize project
composer init

# Add dependency
composer require monolog/monolog

# Install from lock file (deployment — deterministic)
composer install --no-dev --optimize-autoloader

# Update to latest compatible versions (development)
composer update

# Autoload — include once at entry point
require 'vendor/autoload.php';
```

| Rule | Detail |
|------|--------|
| Commit `composer.lock` | Ensures identical versions across team/environments |
| `composer install` in production | Never `composer update` — use lock file |
| `--no-dev` in production | Exclude dev dependencies |
| `--optimize-autoloader` / `-o` | Converts PSR-4/PSR-0 to classmap for speed |
| PSR-4 autoloading | Namespace `App\` -> directory `src/` |
| `composer dump-autoload -o` | Regenerate optimized autoload after changes |
| Security auditing | `composer audit` checks for known vulnerabilities |

## Modern PHP 8.x Patterns

Key features by version:

| Version | Key Features |
|---------|-------------|
| 8.0 | Match, named args, union types, constructor promotion, nullsafe `?->`, attributes |
| 8.1 | Enums, readonly, fibers, intersection types, `never`, first-class callables |
| 8.2 | Readonly classes, DNF types, `true`/`false`/`null` types, trait constants |
| 8.3 | Typed class constants, `#[Override]`, `json_validate()` |
| 8.4 | Property hooks, asymmetric visibility, `#[Deprecated]`, lazy objects |
| 8.5 | Pipe operator `\|>`, `#[NoDiscard]`, `(void)` cast |

> Detailed code examples for all features, functions, generators, fibers, and attributes: see `resources/modern-php.md`

## Error Handling

```php
try {
    $result = riskyOperation();
} catch (NotFoundException $e) {
    return defaultValue();
} catch (ValidationException | AuthException $e) {
    log($e->getMessage());
    throw $e;
} finally {
    cleanup();  // always runs
}
```

| Rule | Detail |
|------|--------|
| Catch `\Throwable` for everything | `Exception` + `Error` |
| Use union catches | `catch (TypeA \| TypeB $e)` (PHP 8.0+) |
| Catch without variable | `catch (SpecificException)` (PHP 8.0+) |
| Call `parent::__construct()` | In custom exception classes |
| Log exceptions, don't display | Never show stack traces to users |
| `throw` is an expression (8.0+) | `$x ?? throw new Exception()` |
| Never use `@` suppression | Hides real problems; custom handlers still fire |
| PHP 7+ throws `Error` | Not `Exception` — use `\Throwable` |

### Error Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| `error_reporting` | `E_ALL` | `E_ALL` |
| `display_errors` | `On` | `Off` |
| `log_errors` | `On` | `On` |
| `error_log` | stderr | syslog or file |

## Arrays & Strings

### Arrays

```php
$map = ['key' => 'value', 'other' => 42];
$list = [1, 2, 3];

// Destructuring
['name' => $name, 'age' => $age] = $userData;
[$first, , $third] = $list;  // skip second

// Spread (PHP 7.4+ for numeric, 8.1+ for string keys)
$merged = [...$array1, ...$array2];
```

| Rule | Detail |
|------|--------|
| Null coalescing | `$map['key'] ?? $default` |
| Keys are `int\|string` only | Objects/arrays cannot be keys |
| Iteration order preserved | Arrays are ordered maps |
| Empty array is falsy | `if ($arr)` checks non-empty |

### Strings

```php
// Interpolation — use braces for clarity
$msg = "Hello {$user->name}, you have {$count} items";

// Heredoc (indented, PHP 7.3+)
$html = <<<HTML
    <div class="card">
        <h1>{$title}</h1>
    </div>
    HTML;

// Nowdoc — no interpolation
$sql = <<<'SQL'
    SELECT * FROM users WHERE id = :id
    SQL;
```

| Rule | Detail |
|------|--------|
| Use `{$var}` in double-quoted | Not `${var}` (deprecated PHP 8.2) |
| Single-byte encoding | Use `mb_strlen()`, `mb_substr()` for Unicode |
| `===` for string comparison | `==` does numeric coercion on numeric strings |
| Negative offset (7.1+) | `$str[-1]` for last character |

## JSON

```php
// Encode — always use JSON_THROW_ON_ERROR (PHP 7.3+)
$json = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Decode — assoc arrays are faster than objects for data access
$data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

// Validate without decoding (PHP 8.3+)
if (json_validate($json)) { /* valid */ }

// Large integers — prevent precision loss
$data = json_decode($json, true, 512, JSON_BIGINT_AS_STRING);
```

| Flag | Effect |
|------|--------|
| `JSON_THROW_ON_ERROR` | Throw `JsonException` instead of returning `false`/`null` |
| `JSON_UNESCAPED_UNICODE` | Don't escape UTF-8 chars — smaller output |
| `JSON_UNESCAPED_SLASHES` | Don't escape `/` — cleaner URLs |
| `JSON_PRESERVE_ZERO_FRACTION` | Keep `10.0` instead of `10` |
| `JSON_BIGINT_AS_STRING` | Decode large ints as strings (prevent precision loss) |
| `JSON_NUMERIC_CHECK` | Convert numeric strings to numbers — **use cautiously** (phone numbers!) |
| `JSON_INVALID_UTF8_SUBSTITUTE` | Replace broken UTF-8 with `U+FFFD` (PHP 7.2+) |
| `JSON_PRETTY_PRINT` | Human-readable output — dev/debug only |

| Rule | Detail |
|------|--------|
| Always `JSON_THROW_ON_ERROR` | Never check `json_last_error()` manually |
| Input must be UTF-8 | `mb_convert_encoding()` first if unsure |
| `json_validate()` (8.3+) | Faster than decode when you just need validity |
| Assoc arrays over objects | `json_decode($json, true)` — faster property access |

## Testing

| Rule | Detail |
|------|--------|
| `assertSame()` over `assertEquals()` | Strict comparison (type + value) |
| Data providers for table-driven tests | `#[DataProvider('method')]` attribute |
| `expectException()` before the call | Not after |
| Test naming | `*Test.php`, method `test*` |
| PHPStan | Levels 0-9 strictness; start low, increase per sprint |
| Psalm | Adds taint analysis for security |
| CI gate | Fail build on any new error — never ignore regressions |

> Full testing examples, static analysis setup, and version migration reference: see `resources/testing-migration.md`

---

## Build & Deploy

### Always Use Makefile

Before running `composer install` or any build command, check if a `Makefile` exists. If it does, **use it**.

| Situation | Action |
|-----------|--------|
| Makefile exists with relevant target | `make deploy`, `make build`, `make test` |
| Makefile exists, no matching target | List targets, pick closest |
| No Makefile | `composer install`, `php artisan`, etc. |

### Permissions & Ownership

```bash
stat -c '%U:%G' * | sort | uniq -c | sort -rn | head -5
chown -R <user>:<group> .
```

### Temporary Files

| File type | Location |
|-----------|----------|
| Build intermediates | `/tmp` — never the project directory |
| Dependencies | `vendor/` (Composer standard) |

### Test File Placement

| Test type | Location |
|-----------|----------|
| Temporary | `/tmp` |
| Permanent, dir exists | `tests/` (follow existing structure) |
| Permanent, no dir | Create `tests/` at project root |

---

## Anti-Pattern Quick Reference

| Anti-Pattern | Better Alternative |
|--------------|--------------------|
| No `strict_types` | `declare(strict_types=1)` in every file |
| `==` comparison | `===` everywhere |
| `@` error suppression | Try-catch or proper validation |
| No type declarations | Type params, returns, properties, constants |
| `catch (Exception)` only | `catch (\Throwable)` for `Error` too |
| Dynamic properties | Declare explicitly (`#[AllowDynamicProperties]` if must) |
| Class constants for finite sets | `enum` (PHP 8.1+) |
| Deep inheritance | Interfaces + traits composition |
| `__sleep()` / `__wakeup()` | `__serialize()` / `__unserialize()` |
| `${var}` interpolation | `{$var}` |
| `get_class()` no arg | `$obj::class` |
| `switch` fall-through | `match` expression |
| Manual null chain | Nullsafe `?->` |
| `array_key_exists` + access | `??` null coalescing |
| String constants | Backed enums |
| Float `==` | Epsilon: `abs($a - $b) < PHP_FLOAT_EPSILON` |
| `global $var` | Dependency injection |
| `extract()` | Explicit assignment |
| Implicit nullable param | Explicit `?Type` |
| `(boolean)` cast | `(bool)` |
| `json_last_error()` checking | `JSON_THROW_ON_ERROR` flag |

---

## Resources

Detailed code examples and extended references are organized in resource files:

- **`resources/oop-patterns.md`** — OOP detailed code (classes, interfaces, traits, enums, visibility, magic methods), dependency injection examples, and namespace patterns
- **`resources/modern-php.md`** — Modern PHP 8.x feature code (match, named args, readonly, pipe operator, deprecated/nodiscard), functions (arrow functions, closures, variadic, generators, fibers), and attributes
- **`resources/testing-migration.md`** — Testing examples with PHPUnit and data providers, static analysis setup (PHPStan, Psalm), and PHP version migration reference (8.0-8.5)
