---
name: php-security
description: Use when handling user input, database queries, file operations, authentication, sessions, or any security-sensitive PHP code. Covers SQL injection prevention with prepared statements, PDO parameterized queries, XSS with htmlspecialchars, CSRF tokens, input validation (filter_var, FILTER_VALIDATE_*, FILTER_SANITIZE_*), output escaping by context, password_hash, password_verify, bcrypt, Argon2, file upload security, session management, SameSite cookies, Content-Security-Policy headers, serialization security, process execution security, error exposure, php.ini hardening (open_basedir, disable_functions, allow_url_include), OWASP Top 10 for PHP, rate limiting, brute force protection, directory traversal, path traversal, and common vulnerability patterns.
---

# PHP Security

## Core Principle

**Never trust user input.** Validate everything from `$_GET`, `$_POST`, `$_COOKIE`, `$_FILES`, `$_SERVER`, and `$_REQUEST`. Defense in depth — layer multiple protections.

## SQL Injection Prevention

Use prepared statements with bound parameters for all queries. Never interpolate user input into SQL strings.

| Rule | Detail |
|------|--------|
| Prepared statements only | `WHERE`, `VALUES`, `SET` — parameterize all data values |
| Table/column names | Validate against whitelist, never user input directly |
| Least-privilege DB accounts | Don't use root; separate read/write accounts |
| Use PDO with exceptions | `$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION)` |
| Disable emulated prepares | `$pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false)` |

See `resources/validation-patterns.md` for prepared statement and dynamic column name code examples.

## XSS Prevention

Escape all user data on output. Use `htmlspecialchars($val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` (or a short `e()` helper) for HTML contexts.

| Context | Escaping |
|---------|----------|
| HTML body | `htmlspecialchars()` with `ENT_QUOTES` |
| HTML attribute | `htmlspecialchars()` with `ENT_QUOTES` |
| JavaScript | `json_encode()` with `JSON_HEX_TAG` |
| URL parameter | `urlencode()` |
| CSS | Avoid user input in CSS; whitelist if needed |

Set CSP headers: `Content-Security-Policy: default-src 'self'; script-src 'self'`

See `resources/validation-patterns.md` for output escaping and CSP code examples.

## CSRF Protection

```php
// Generate token
session_start();
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// In form
<input type="hidden" name="csrf_token" value="<?= e($_SESSION['csrf_token']) ?>">

// Validate on submit
if (!hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'] ?? '')) {
    http_response_code(403);
    exit('Invalid CSRF token');
}
```

| Rule | Detail |
|------|--------|
| Token per session | Generate once, validate on every state-changing request |
| `hash_equals()` | Timing-safe comparison — prevents timing attacks |
| `SameSite=Lax` cookies | Additional protection layer |
| Not needed for GET | GET should never modify state |

## Password Security

```php
// Hash with bcrypt (default, recommended)
$hash = password_hash($password, PASSWORD_DEFAULT);

// Verify
if (password_verify($inputPassword, $storedHash)) {
    // Authenticated
}

// Check if rehash needed (algorithm/cost changes)
if (password_needs_rehash($storedHash, PASSWORD_DEFAULT)) {
    $newHash = password_hash($inputPassword, PASSWORD_DEFAULT);
    // Update stored hash
}
```

| Rule | Detail |
|------|--------|
| Never store plaintext | Always `password_hash()` |
| `PASSWORD_DEFAULT` | Auto-uses best available algorithm |
| `PASSWORD_ARGON2ID` | Stronger than bcrypt if available (PHP 7.3+) |
| Never use `md5()` / `sha1()` | Not designed for passwords — too fast |
| `password_verify()` only | Don't compare hashes manually |
| Rehash on login | `password_needs_rehash()` keeps hashes current |

## Input Validation & Sanitization

Use `filter_var()` / `filter_input()` for type validation. Key filters: `FILTER_VALIDATE_EMAIL`, `FILTER_VALIDATE_INT` (with `min_range`/`max_range`), `FILTER_VALIDATE_FLOAT`, `FILTER_VALIDATE_IP`, `FILTER_VALIDATE_URL`, `FILTER_VALIDATE_BOOL` (with `FILTER_NULL_ON_FAILURE`), `FILTER_VALIDATE_DOMAIN`, `FILTER_VALIDATE_REGEXP`.

### Sanitization Filters (FILTER_SANITIZE_*)

| Filter | Effect | Notes |
|--------|--------|-------|
| `FILTER_SANITIZE_FULL_SPECIAL_CHARS` | Encodes `<>"'&` (like `htmlspecialchars`) | Preferred over deprecated `FILTER_SANITIZE_STRING` |
| `FILTER_SANITIZE_EMAIL` | Removes all except `[a-zA-Z0-9!#$%&'*+-=?^_\`{\|}~@.\[\]]` | |
| `FILTER_SANITIZE_URL` | Removes chars not valid in URLs | |
| `FILTER_SANITIZE_NUMBER_INT` | Keeps only `[0-9+-]` | |
| `FILTER_SANITIZE_NUMBER_FLOAT` | Keeps only `[0-9+-]` + optional `.` `,` `eE` | Use `FILTER_FLAG_ALLOW_FRACTION` |
| `FILTER_SANITIZE_ADD_SLASHES` | Applies `addslashes()` (PHP 7.3+) | |
| `FILTER_SANITIZE_ENCODED` | URL-encodes string | |
| `FILTER_SANITIZE_STRING` | **DEPRECATED PHP 8.1** — use `htmlspecialchars()` | |

### Output Escaping by Context

| Context | Function | Example |
|---------|----------|---------|
| HTML body/attribute | `htmlspecialchars($s, ENT_QUOTES \| ENT_SUBSTITUTE, 'UTF-8')` | `<p><?= e($name) ?></p>` |
| JavaScript | `json_encode($s, JSON_HEX_TAG \| JSON_HEX_AMP)` | `var x = <?= json_encode($val) ?>` |
| URL parameter | `urlencode($s)` (space=`+`) or `rawurlencode($s)` (space=`%20`) | `?q=<?= urlencode($q) ?>` |
| Shell argument | `escapeshellarg($s)` | Single arg only |
| Shell command | `escapeshellcmd($s)` | Less safe — prefer `escapeshellarg` |
| CSS | Avoid user input; whitelist if needed | |

### Key Rules

| Rule | Detail |
|------|--------|
| Validate type, format, range, length | Before any processing |
| Whitelist over blacklist | Accept known-good, reject everything else |
| Don't use `$_REQUEST` | Ambiguous source — specify `$_GET`, `$_POST`, `$_COOKIE` |
| `$_SERVER` values can be spoofed | `HTTP_*` headers are user-controlled |
| `filter_input()` over `$_POST` | Reads from superglobal directly |
| `FILTER_NULL_ON_FAILURE` | Returns `null` instead of `false` — useful for booleans |
| `FILTER_VALIDATE_EMAIL` is basic | Only validates syntax, not existence |
| `FILTER_VALIDATE_URL` ASCII only | IDN domains always fail |
| Never `unserialize()` user data | Use JSON; verify HMAC for stored serialized data |
| Array format in `proc_open()` | Bypasses shell entirely — safest option |

See `resources/validation-patterns.md` for filter_var code examples, serialization security, and process execution patterns.

## File Upload Security

```php
$file = $_FILES['upload'];

// Validate
if ($file['error'] !== UPLOAD_ERR_OK) {
    throw new UploadException('Upload failed');
}

// Check MIME type (don't trust $_FILES['type'] — user-controlled)
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = ['image/jpeg', 'image/png', 'image/gif'];
if (!in_array($mime, $allowed, true)) {
    throw new ValidationException('Invalid file type');
}

// Check size
if ($file['size'] > 5 * 1024 * 1024) { // 5MB
    throw new ValidationException('File too large');
}

// Generate safe filename — never use original
$ext = match($mime) {
    'image/jpeg' => '.jpg',
    'image/png' => '.png',
    'image/gif' => '.gif',
};
$safeName = bin2hex(random_bytes(16)) . $ext;

// Move to non-web-accessible directory
move_uploaded_file($file['tmp_name'], '/var/uploads/' . $safeName);
```

| Rule | Detail |
|------|--------|
| Never trust `$_FILES['name']` | Generate random filename |
| Never trust `$_FILES['type']` | Check with `finfo` on actual file |
| Store outside web root | Serve through PHP controller |
| Validate file content | MIME check, size limits, dimension limits for images |
| No executable uploads | Block `.php`, `.phtml`, `.phar`, etc. |

## Session Security

```php
// Secure session configuration
ini_set('session.cookie_httponly', '1');     // No JavaScript access
ini_set('session.cookie_secure', '1');       // HTTPS only
ini_set('session.cookie_samesite', 'Lax');   // CSRF protection
ini_set('session.use_strict_mode', '1');     // Reject uninitialized IDs
ini_set('session.use_only_cookies', '1');    // No session ID in URL

session_start();

// Regenerate ID on privilege change (login)
session_regenerate_id(true);

// Destroy session properly
session_unset();
session_destroy();
setcookie(session_name(), '', time() - 3600, '/');
```

| Rule | Detail |
|------|--------|
| `httponly` cookies | Prevents XSS session hijacking |
| `secure` flag | Only send over HTTPS |
| Regenerate on login | Prevents session fixation |
| Regenerate on privilege change | Elevation of privilege attacks |
| Absolute timeout | Expire sessions after N hours regardless of activity |
| Idle timeout | Expire after N minutes of inactivity |

## Filesystem Security

```php
// BAD: Path traversal attack
$file = $_GET['file'];
include("/templates/$file");  // ../../etc/passwd

// GOOD: Validate and constrain
$allowed = ['header', 'footer', 'sidebar'];
$file = $_GET['file'];
if (!in_array($file, $allowed, true)) {
    throw new NotFoundException();
}
include("/templates/{$file}.php");

// GOOD: realpath validation
$basePath = realpath('/var/uploads');
$fullPath = realpath("/var/uploads/{$filename}");
if ($fullPath === false || !str_starts_with($fullPath, $basePath)) {
    throw new SecurityException('Path traversal detected');
}
```

| Rule | Detail |
|------|--------|
| Whitelist allowed paths | Never build paths from user input directly |
| `realpath()` + prefix check | Resolves symlinks, detects `..` traversal |
| `basename()` strips directories | But don't rely on it alone |
| Restrict PHP user permissions | Principle of least privilege |
| Log file operations | Audit trail for sensitive access |

## Cryptography

```php
// Random bytes for tokens, keys, nonces
$token = bin2hex(random_bytes(32));  // 64-char hex string
$apiKey = base64_encode(random_bytes(32));

// HMAC for data integrity
$signature = hash_hmac('sha256', $data, $secretKey);
if (!hash_equals($expected, $signature)) {
    throw new SecurityException('Invalid signature');
}

// Encryption with sodium (PHP 7.2+)
$key = sodium_crypto_secretbox_keygen();
$nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
$encrypted = sodium_crypto_secretbox($plaintext, $nonce, $key);
$decrypted = sodium_crypto_secretbox_open($encrypted, $nonce, $key);
```

| Rule | Detail |
|------|--------|
| `random_bytes()` / `random_int()` | For all security-sensitive random — never `rand()` or `mt_rand()` |
| `hash_equals()` | Timing-safe comparison for tokens, signatures |
| Sodium over OpenSSL | Simpler API, harder to misuse |
| Never roll your own crypto | Use well-tested libraries |
| Store keys outside code | Environment variables or secret management |

## HTTP Security Headers

```php
// Essential headers
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header("Content-Security-Policy: default-src 'self'");
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

// Hide PHP version
ini_set('expose_php', '0');
```

## php.ini Hardening (OWASP)

### Error and Information Disclosure

| Directive | Production Value | Purpose |
|-----------|-----------------|---------|
| `expose_php` | `Off` | Hide PHP version from headers |
| `display_errors` | `Off` | Never show errors to users |
| `display_startup_errors` | `Off` | Hide startup errors |
| `log_errors` | `On` | Log to file, not stdout |
| `error_reporting` | `E_ALL` | Report everything, log everything |
| `error_log` | `/var/log/php/error.log` | Secure log location |

### Filesystem and Includes

| Directive | Production Value | Purpose |
|-----------|-----------------|---------|
| `open_basedir` | `/var/www/app/` | Restrict file access to app directory |
| `allow_url_fopen` | `Off` | Prevent remote file inclusion |
| `allow_url_include` | `Off` | Blocks remote code inclusion |
| `doc_root` | Set appropriately | Limit accessible filesystem |

### Disable Unused Functions

Use `disable_functions` in php.ini to disable functions your application does not need. Audit which functions are actually used. Common candidates: `phpinfo`, `show_source`, `pcntl_fork`, `pcntl_exec`, and any shell-related functions not required by the app.

### File Uploads (php.ini)

| Directive | Value | Purpose |
|-----------|-------|---------|
| `file_uploads` | `Off` (if unused) | Disable entirely if not needed |
| `upload_max_filesize` | `2M` (or app minimum) | Limit upload size |
| `max_file_uploads` | `2` (or app minimum) | Limit concurrent uploads |
| `upload_tmp_dir` | Dedicated directory | Isolate temp uploads |

### Session Hardening (php.ini)

| Directive | Value | Purpose |
|-----------|-------|---------|
| `session.use_strict_mode` | `1` | Reject uninitialized session IDs |
| `session.use_only_cookies` | `1` | Never pass session ID in URL |
| `session.cookie_httponly` | `1` | Block JavaScript access to session cookie |
| `session.cookie_secure` | `1` | HTTPS-only session cookies |
| `session.cookie_samesite` | `Strict` | Strongest CSRF protection |
| `session.sid_length` | `128` | Longer session IDs harder to brute-force |
| `session.gc_maxlifetime` | `600` | Expire idle sessions (10 min) |
| `session.name` | Custom value | Avoid default `PHPSESSID` — reduces fingerprinting |

### Resource Limits

| Directive | Value | Purpose |
|-----------|-------|---------|
| `max_execution_time` | `30` | Prevent runaway scripts |
| `max_input_time` | `30` | Limit input parsing time |
| `memory_limit` | `128M` | Prevent memory exhaustion |
| `post_max_size` | `8M` | Limit POST body size |

## Error Exposure

| Rule | Detail |
|------|--------|
| `display_errors = Off` in production | Errors reveal paths, DB structure, code |
| `log_errors = On` | Log to file or syslog, not stdout |
| Custom error pages | Show generic message, log details |
| Never expose DB errors | Attackers use them for reconnaissance |
| Hide `X-Powered-By` | `expose_php = Off` in php.ini |

## Common Vulnerability Patterns

| Vulnerability | Prevention |
|--------------|------------|
| SQL injection | Prepared statements with bound parameters |
| XSS (stored/reflected) | `htmlspecialchars()` + CSP headers |
| CSRF | Token per session + `SameSite` cookies |
| Session fixation | `session_regenerate_id(true)` on login |
| Path traversal | `realpath()` + prefix validation |
| File upload attacks | MIME validation + random names + store outside webroot |
| Timing attacks | `hash_equals()` for all comparisons |
| Insecure deserialization | Never `unserialize()` user data; use JSON |
| PHP Object Injection | `unserialize()` triggers `__wakeup()`, `__destruct()` magic methods — attacker-crafted objects can delete files, inject SQL, run code |
| Remote File Inclusion | `allow_url_include = Off`, `allow_url_fopen = Off` in php.ini |
| Open redirect | Whitelist redirect targets |
| Mass assignment | Explicit field lists, never `extract()` on user data |
| Header injection | Validate/strip `\r\n` from header values |
| Command injection | `escapeshellarg()` + avoid shell functions when possible |
| Information disclosure | Disable `display_errors`, `expose_php`, `phpinfo()` |

## Automated Taint Analysis

Psalm can trace user input from source (e.g., `$_GET`) to dangerous sinks (e.g., SQL query, `echo`) and flag injection paths automatically:

```bash
vendor/bin/psalm --taint-analysis
```

Catches SQL injection, XSS, and other data-flow vulnerabilities that manual review misses. Use alongside manual code review, not as replacement.

## Security Checklist

- [ ] `declare(strict_types=1)` in every file
- [ ] `===` for all comparisons (especially auth checks)
- [ ] Prepared statements for all database queries
- [ ] `htmlspecialchars()` for all HTML output
- [ ] CSRF tokens on all state-changing forms
- [ ] `password_hash()` / `password_verify()` for passwords
- [ ] `random_bytes()` for tokens and keys
- [ ] Session cookies: `httponly`, `secure`, `samesite`
- [ ] File uploads validated by content, not name/extension
- [ ] `display_errors = Off` in production
- [ ] CSP and security headers set
- [ ] `expose_php = Off`
- [ ] `open_basedir` restricts file access
- [ ] `allow_url_include = Off` and `allow_url_fopen = Off`
- [ ] `disable_functions` configured for unused dangerous functions
- [ ] `session.sid_length >= 128`, custom `session.name`
- [ ] No `$_REQUEST` usage — specify input source
- [ ] No `unserialize()` on user data — use JSON
- [ ] `escapeshellarg()` or array format for process execution
- [ ] Regex patterns tested for catastrophic backtracking (ReDoS)
- [ ] cURL: `CURLOPT_SSL_VERIFYPEER` enabled in production
- [ ] `filter_var()` / `filter_input()` for input validation
- [ ] Psalm taint analysis in CI (`--taint-analysis`)

## Resources

- `resources/validation-patterns.md` — Detailed code examples for SQL injection prevention, XSS output escaping, input validation filters, serialization security, and process execution security
