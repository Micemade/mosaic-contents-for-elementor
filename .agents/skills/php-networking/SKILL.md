---
name: php-networking
description: Use when making HTTP requests with cURL, parallel requests with multi-curl, writing regex patterns (PCRE), or doing parallel/async execution (pcntl_fork, stream_select, parallel extension, fibers). Covers cURL options (CURLOPT_TIMEOUT, CURLOPT_CONNECTTIMEOUT, CURLOPT_SSL_VERIFYPEER), HTTP client, Guzzle, file_get_contents, stream_context, socket programming, WebSocket, DNS resolution, proxy configuration, SSL/TLS certificate verification, multi-curl patterns, regex modifiers, named groups, lookahead, lookbehind, ReDoS prevention, named captures, process control, non-blocking I/O, and stream multiplexing.
---

# PHP Networking, Regex & Parallel Execution

## cURL & HTTP Requests

### Basic Request

```php
$ch = curl_init('https://api.example.com/data');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Authorization: Bearer ' . $token],
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,   // NEVER disable in production
    CURLOPT_SSL_VERIFYHOST => 2,
]);
$response = curl_exec($ch);
if ($response === false) {
    throw new RuntimeException(curl_error($ch), curl_errno($ch));
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
// curl_close() optional in PHP 8+ (garbage collected)
```

### POST / PUT / JSON

```php
curl_setopt_array($ch, [
    CURLOPT_POST       => true,
    CURLOPT_POSTFIELDS => json_encode($data),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
]);

// Custom method (PUT, PATCH, DELETE)
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
```

### Multi-cURL (Parallel Requests)

```php
$mh = curl_multi_init();
$handles = [];

foreach ($urls as $key => $url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    curl_multi_add_handle($mh, $ch);
    $handles[$key] = $ch;
}

// Run all in parallel
do {
    $status = curl_multi_exec($mh, $running);
    if ($running) { curl_multi_select($mh); } // block until I/O ready
} while ($running > 0);

// Collect results
$results = [];
foreach ($handles as $key => $ch) {
    $results[$key] = curl_multi_getcontent($ch);
    curl_multi_remove_handle($mh, $ch);
}
curl_multi_close($mh);
```

### cURL Reference

| Option | Purpose |
|--------|---------|
| `CURLOPT_RETURNTRANSFER` | Return body as string (not print) |
| `CURLOPT_TIMEOUT` | Total operation timeout (seconds) |
| `CURLOPT_CONNECTTIMEOUT` | Connection phase timeout |
| `CURLOPT_FOLLOWLOCATION` | Auto-follow redirects |
| `CURLOPT_MAXREDIRS` | Max redirects to follow |
| `CURLOPT_USERPWD` | Basic auth `"user:pass"` |
| `CURLOPT_ACCEPT_ENCODING` | Enable gzip/deflate (auto-decompressed) |
| `CURLOPT_SSL_VERIFYPEER` | Verify server certificate (default `true`) |
| `CURLOPT_SSL_VERIFYHOST` | Verify hostname in cert (use `2`) |
| `CURLOPT_HTTPHEADER` | Custom request headers array |
| `CURLOPT_POSTFIELDS` | POST data (string or array) |
| `CurlHandle` (PHP 8.0+) | Opaque final class, replaces resource type |

| Rule | Detail |
|------|--------|
| Always set timeouts | Prevent hanging on slow servers |
| Never disable SSL verification | Except in dev/test |
| Use `===` for `curl_exec()` check | Returns `false` on failure, not falsy |
| HTTP 4xx/5xx is not curl failure | Check `CURLINFO_HTTP_CODE` separately |
| Multi-curl for parallel | Much faster than sequential for multiple URLs |

## Regular Expressions (PCRE)

### Key Functions

```php
// Match — returns 1 (match), 0 (no match), false (error)
preg_match('/^[a-z]+$/i', $input, $matches);

// Match all — returns count of matches
preg_match_all('/\d+/', $text, $matches);

// Replace — string or callback
$clean = preg_replace('/\s+/', ' ', $text);
$result = preg_replace_callback('/\{(\w+)\}/', fn($m) => $vars[$m[1]] ?? '', $template);

// Split
$parts = preg_split('/[\s,]+/', $csv);

// Always check for errors
if (preg_last_error() !== PREG_NO_ERROR) {
    throw new RuntimeException(preg_last_error_msg());
}
```

### Modifiers

| Modifier | Effect |
|----------|--------|
| `i` | Case-insensitive |
| `m` | `^`/`$` match line boundaries (not just string start/end) |
| `s` | `.` matches newlines |
| `x` | Ignore whitespace + `#` comments in pattern |
| `u` | UTF-8 mode — **required for multibyte strings** |
| `U` | Invert greediness (all quantifiers ungreedy by default) |
| `n` | Only named groups `(?<name>)` capture (PHP 8.2+) |
| `D` | `$` matches only absolute end, not before final `\n` |
| `A` | Anchor to string start |

### Named Captures & Assertions

```php
// Named captures — cleaner than $matches[1]
preg_match('/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/', $date, $m);
echo $m['year']; // "2024"

// Lookahead/lookbehind (zero-width assertions)
'/(?<=\$)\d+/'      // Positive lookbehind: digits after $
'/\d+(?= USD)/'     // Positive lookahead: digits before " USD"
'/foo(?!bar)/'      // Negative lookahead: "foo" not followed by "bar"
```

### ReDoS Prevention & Performance

| Rule | Detail |
|------|--------|
| Avoid nested quantifiers | `(a+)*`, `(a*)+` cause exponential backtracking |
| Use atomic groups `(?>...)` | Prevent backtracking into group |
| Character classes over alternation | `[aeiou]` faster than `(a\|e\|i\|o\|u)` |
| Anchor patterns | `^pattern` / `\Apattern` fastest |
| Check `preg_last_error()` | Detect `PREG_BACKTRACK_LIMIT_ERROR` |
| `pcre.backtrack_limit` | Default 1M — may hit on large subjects |
| Lookbehind must be fixed-length | Variable-length lookbehind not supported |

## Parallel & Async Patterns

### Process Control (pcntl)

```php
$pid = pcntl_fork();
if ($pid === -1) {
    throw new RuntimeException('Fork failed');
} elseif ($pid > 0) {
    // Parent — wait for child to prevent zombies
    pcntl_wait($status);
} else {
    // Child (pid === 0)
    doWork();
    exit(0);
}
```

### Non-Blocking I/O with stream_select

```php
stream_set_blocking($stream, false);
$read = [$stream1, $stream2, $stream3];
$write = $except = [];
// Block up to 200ms waiting for any stream to be ready
if (stream_select($read, $write, $except, 0, 200000) > 0) {
    foreach ($read as $ready) {
        $data = fread($ready, 8192);
    }
}
```

### parallel Extension (Modern Async)

```php
$runtime = new parallel\Runtime();
$futures = [];
foreach ($tasks as $i => $task) {
    $futures[$i] = $runtime->run(fn() => processTask($task), [$task]);
}
// Collect results (blocks if not ready)
foreach ($futures as $i => $future) {
    $results[$i] = $future->value();
}
$runtime->close();
```

### Comparison

| Approach | Best for | Notes |
|----------|----------|-------|
| `curl_multi_*` | Parallel HTTP requests | Built-in, no extensions needed |
| `pcntl_fork()` | CPU-bound parallel work | Unix only, not thread-safe |
| `stream_select()` | High-concurrency I/O | Event loop pattern, thousands of connections |
| `parallel` extension | General async tasks | Requires ZTS PHP, message-passing model |
| Fibers (8.1+) | Cooperative concurrency | Single-thread, no true parallelism |

| Rule | Detail |
|------|--------|
| `pcntl_fork()` workers | Match CPU count (2-4) |
| `stream_select()` timeout | Min 200ms to avoid CPU spin |
