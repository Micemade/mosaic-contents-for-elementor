# OOP Patterns, DI & SOLID, and Namespaces

## Classes & Properties

```php
class User {
    // Constructor promotion (PHP 8.0+)
    public function __construct(
        private readonly string $name,       // readonly (PHP 8.1+)
        public int $age = 0,
        public private(set) string $role = 'user', // asymmetric visibility (PHP 8.4+)
    ) {}
}

$user = new User(name: 'Alice', age: 30); // named arguments
```

### Property Hooks (PHP 8.4+)

```php
class Temperature {
    public float $celsius {
        get => ($this->fahrenheit - 32) / 1.8;
        set => $this->fahrenheit = ($value * 1.8) + 32;
    }
    public function __construct(private float $fahrenheit) {}
}
```

## Interfaces & Abstract Classes

```php
interface Renderable {
    public function render(): string;
}

abstract class Widget {
    abstract protected function draw(): void;
    public function display(): void { $this->draw(); }
}

class Button extends Widget implements Renderable, Clickable { }
```

## Traits

```php
trait Timestampable {
    public DateTime $createdAt;
    public DateTime $updatedAt;
    public function touch(): void { $this->updatedAt = new DateTime(); }
}

class Post {
    use Timestampable;
    use TraitA, TraitB {
        TraitA::method insteadof TraitB;   // resolve conflict
        TraitB::method as protected aliased; // alias + change visibility
    }
}
```

| Rule | Detail |
|------|--------|
| Horizontal code reuse | Not a substitute for inheritance |
| Precedence | Class > Trait > Parent |
| Each class gets own static copies | Static properties not shared across classes |
| Traits can have constants (8.2+) | Access via using class, not trait name |
| Can require abstract methods | Force using class to implement |

## Enumerations (PHP 8.1+)

```php
// Pure enum
enum Status {
    case Pending;
    case Active;
    case Inactive;
}

// Backed enum — stored as int or string
enum Color: string {
    case Red = '#FF0000';
    case Green = '#00FF00';
    case Blue = '#0000FF';
}

$color = Color::from('#FF0000');      // Color::Red or ValueError
$color = Color::tryFrom('#FFFFFF');   // null (safe)
echo $color->value;                   // '#FF0000'
echo $color->name;                    // 'Red'

// Methods and interfaces on enums
enum Suit: string implements HasLabel {
    case Hearts = 'H';
    case Spades = 'S';

    public function label(): string {
        return match($this) {
            self::Hearts => 'Hearts',
            self::Spades => 'Spades',
        };
    }
}
```

| Rule | Detail |
|------|--------|
| Use enums over class constants | Type-safe, exhaustive matching |
| Back with `int` or `string` only | All cases must have explicit unique values |
| `from()` throws on invalid | `tryFrom()` returns null |
| Can have methods and implement interfaces | But no state (properties) |
| Cases are singletons | Same instance every time |
| Can use traits | But not traits with properties |

## Visibility & Late Static Binding

| Modifier | Access |
|----------|--------|
| `public` | Everywhere (default for interface methods) |
| `protected` | Class + children |
| `private` | Declaring class only — not inherited |
| `public protected(set)` | Read public, write protected (PHP 8.4+) |
| `public private(set)` | Read public, write only in class (PHP 8.4+) |

```php
// static:: resolves at runtime, self:: at compile time
class ParentClass {
    public static function create(): static { return new static(); }
}
class ChildClass extends ParentClass {}
ChildClass::create(); // Returns ChildClass, not ParentClass
```

## Covariance & Contravariance (PHP 7.4+)

| Direction | Rule | Example |
|-----------|------|---------|
| Covariant return | Child can return MORE specific | `Parent: Animal` -> `Child: Dog` |
| Contravariant param | Child can accept LESS specific | `Parent: Dog` -> `Child: Animal` |

## Magic Methods

| Method | Triggered by |
|--------|-------------|
| `__construct()` / `__destruct()` | Object creation / destruction |
| `__get($name)` / `__set($name, $val)` | Accessing undefined property |
| `__call($name, $args)` / `__callStatic()` | Calling undefined method |
| `__toString()` | String conversion |
| `__invoke()` | Using object as function |
| `__serialize()` / `__unserialize()` | Serialization (preferred over `__sleep`/`__wakeup`) |
| `__clone()` | `clone $obj` (shallow copy by default) |
| `__debugInfo()` | `var_dump()` output |

| Rule | Detail |
|------|--------|
| `__construct` / `__destruct` / `__clone` | Can be any visibility; all others must be public |
| Call `parent::__construct()` explicitly | Not called implicitly by PHP |
| `__clone()` runs AFTER shallow copy | Use to deep-copy nested objects |
| Exceptions in `__destruct` during shutdown | Cause fatal error |

## Dependency Injection

```php
// BAD: Hard-coded dependency — untestable
class UserService {
    private Database $db;
    public function __construct() {
        $this->db = new MySqlDatabase();  // tight coupling
    }
}

// GOOD: Inject dependency via constructor
class UserService {
    public function __construct(private DatabaseInterface $db) {}
}

// Usage — easy to swap implementations and mock in tests
$service = new UserService(new MySqlDatabase());
$service = new UserService(new SqliteDatabase());  // same interface
$service = new UserService($mockDb);               // testing
```

| Rule | Detail |
|------|--------|
| Constructor injection | Preferred — makes dependencies explicit |
| Type-hint interfaces | Not concrete classes — enables swapping |
| DI container ≠ DI | Containers are optional convenience; DI is the pattern |
| Avoid Service Locator | Hiding dependencies inside a container = anti-pattern |
| `final` by default | Mark classes `final` unless designed for extension |

## Namespaces

```php
namespace App\Models;

use App\Contracts\Renderable;
use App\Services\{UserService, AuthService};  // group imports (PHP 7.0+)
use function App\Helpers\format_date;
use const App\Config\MAX_RETRIES;
```

| Rule | Detail |
|------|--------|
| First statement (except `declare`) | Must come before any code |
| Per-file scope | Imports don't transfer to included files |
| Functions/constants fall back to global | If not found in namespace |
| Dynamic names bypass imports | `new $className()` ignores `use` statements |
| No whitespace before `namespace` | After `<?php` tag |

### Name Resolution

| Form | Resolution |
|------|-----------|
| `\Full\Path` | Fully qualified — resolves as-is |
| `Imported\Rest` | First segment checked against imports |
| `Unqualified` | Checked against import table, then current namespace |
| `namespace\Foo` | Current namespace prepended |
