# Validation Patterns — Detailed Code Examples

## SQL Injection Prevention Code

### Prepared Statements

```php
// GOOD: Parameterized query — safe
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? AND status = ?');
$stmt->execute([$email, $status]);
$user = $stmt->fetch();

// GOOD: Named parameters
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
$stmt->execute(['id' => $id]);

// BAD: String interpolation — SQL injection!
$pdo->query("SELECT * FROM users WHERE id = $id");
$pdo->query("SELECT * FROM users WHERE name = '$name'");
```

### Dynamic Table/Column Names

```php
// GOOD: Whitelist validation
$allowed = ['name', 'email', 'created_at'];
$column = in_array($column, $allowed, true) ? $column : 'name';
$stmt = $pdo->prepare("SELECT * FROM users ORDER BY {$column}");
```

## XSS Prevention Code

### Output Escaping

```php
// GOOD: Always escape user data in HTML
echo htmlspecialchars($userInput, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

// Helper function
function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// In templates
<p>Hello, <?= e($user->name) ?></p>
<input value="<?= e($searchQuery) ?>">
```

### Content Security Policy

```php
header("Content-Security-Policy: default-src 'self'; script-src 'self'");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 0"); // Disable legacy XSS filter — CSP is better
```

## Input Validation Code

### Validation Filters (FILTER_VALIDATE_*)

```php
// Email — RFC 822 syntax only (doesn't confirm existence)
$email = filter_var($input, FILTER_VALIDATE_EMAIL);

// Integer with range
$age = filter_var($input, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 0, 'max_range' => 150]
]);

// Float with range (PHP 7.4+)
$price = filter_var($input, FILTER_VALIDATE_FLOAT, [
    'options' => ['min_range' => 0.01, 'max_range' => 99999.99]
]);

// IP address — exclude private/reserved ranges
$ip = filter_var($input, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);

// URL — ASCII only (IDN domains always rejected)
$url = filter_var($input, FILTER_VALIDATE_URL);

// Boolean — "1","true","on","yes" -> true; "0","false","off","no" -> false
$flag = filter_var($input, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

// Domain (RFC 952/1034)
$domain = filter_var($input, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME);

// Custom regex
$code = filter_var($input, FILTER_VALIDATE_REGEXP, ['options' => ['regexp' => '/^[A-Z]{3}-\d{4}$/']]);

// filter_input reads from superglobal directly (safer than $_POST)
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
```

### Serialization Security

```php
// NEVER unserialize user input — remote code execution risk!
// __unserialize()/__wakeup() magic methods execute on deserialization
// Autoloading can trigger arbitrary code

// BAD
$data = unserialize($_COOKIE['prefs']);

// GOOD — use JSON for untrusted data
$data = json_decode($_COOKIE['prefs'], true, 512, JSON_THROW_ON_ERROR);

// If you must use serialized data from storage, verify integrity
$expected = hash_hmac('sha256', $serialized, $secretKey);
if (!hash_equals($expected, $providedHmac)) {
    throw new SecurityException('Tampered data');
}
```

### Process Execution Security

```php
// BEST: Array command format bypasses shell entirely (PHP 7.4+)
$proc = proc_open(['convert', $inputFile, '-resize', '800x600', $outputFile], $spec, $pipes);

// If shell is needed, escape every argument
$safe = escapeshellarg($userInput);  // wraps in single quotes

// NEVER pass user input directly to shell functions
// BAD:  system("convert $file");
// GOOD: system("convert " . escapeshellarg($file));
```
