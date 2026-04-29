# Modern PHP 8.x Patterns, Functions & Attributes

## Match Expression (PHP 8.0+)

```php
$label = match($status) {
    Status::Active => 'Active',
    Status::Pending, Status::Inactive => 'Not active',
    default => throw new UnexpectedValueException(),
};
// Uses ===, returns value, no fall-through, throws UnhandledMatchError if no match
```

## Named Arguments & Nullsafe (PHP 8.0+)

```php
// Named arguments — any order, skip defaults
array_slice(array: $arr, offset: 2, length: 5, preserve_keys: true);

// Nullsafe — short-circuits to null
$city = $user?->getAddress()?->getCity()?->getName();
```

## Readonly (PHP 8.1+ properties, 8.2+ classes)

```php
// Readonly property
class User {
    public function __construct(public readonly string $name) {}
}

// Readonly class — ALL properties are readonly
readonly class Point {
    public function __construct(public float $x, public float $y) {}
}
```

## Override Attribute (PHP 8.3+)

```php
class Child extends ParentClass {
    #[Override]
    public function process(): void { }  // Error if parent doesn't have process()
}
```

## Pipe Operator (PHP 8.5+)

```php
$result = $input |> trim(...) |> strtolower(...) |> ucfirst(...);
```

## Deprecated & NoDiscard Attributes (PHP 8.4+/8.5+)

```php
#[Deprecated('Use newMethod() instead', since: '2.0')]
public function oldMethod(): void { }

#[NoDiscard]
function validate(string $data): bool { }
(void) validate($data); // explicitly discard
```

## Arrow Functions & Closures

```php
// Arrow function — single expression, auto-captures by value
$doubled = array_map(fn($n) => $n * 2, $numbers);

// Traditional closure — captures explicitly
$tax = 0.1;
$withTax = array_map(function($price) use ($tax) {
    return $price * (1 + $tax);
}, $prices);

// First-class callable syntax (PHP 8.1+)
$fn = strlen(...);
$method = $obj->method(...);
$static = MyClass::method(...);
```

## Variadic & Spread

```php
function sum(int ...$nums): int { return array_sum($nums); }
sum(1, 2, 3);
sum(...[1, 2, 3]);  // spread
```

## Generators

```php
function readLines(string $file): Generator {
    $f = fopen($file, 'r');
    try {
        while ($line = fgets($f)) { yield trim($line); }
    } finally {
        fclose($f);
    }
}

// Delegation
function combined(): Generator {
    yield from range(1, 5);
    yield from ['a', 'b', 'c'];
}

// Associative yields
function metadata(): Generator {
    yield 'name' => 'Alice';
    yield 'age' => 30;
}
```

| Rule | Detail |
|------|--------|
| Memory-efficient | Process large datasets without loading into memory |
| State preserved between yields | Execution pauses and resumes |
| `yield from` delegates | Preserves keys — watch for overwrites |
| Return value via `getReturn()` | Available after generator completes |

## Fibers (PHP 8.1+)

```php
$fiber = new Fiber(function(): string {
    $value = Fiber::suspend('paused');
    return "got: $value";
});
$result = $fiber->start();      // 'paused'
$fiber->resume('hello');
$fiber->getReturn();            // 'got: hello'
```

| Fibers vs Generators | Detail |
|---------------------|--------|
| Generators | Stackless, yield only in generator function |
| Fibers | Full-stack suspension, suspend from anywhere in call chain |

## Attributes (PHP 8.0+)

```php
#[Attribute(Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
class Route {
    public function __construct(
        public string $path,
        public string $method = 'GET',
    ) {}
}

#[Route('/api/users', method: 'POST')]
public function createUser(): Response { }

// Read via Reflection
$attrs = (new ReflectionMethod($class, $method))->getAttributes(Route::class);
$route = $attrs[0]->newInstance();
```
