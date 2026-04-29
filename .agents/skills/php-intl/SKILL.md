---
name: php-intl
description: Use when working with multibyte strings, UTF-8 encoding, character encoding conversion, locale-aware formatting (dates, numbers, currencies), transliteration, pluralization, or internationalization. Covers mb_strlen, mb_substr, mb_strtolower, mb_strtoupper, mb_detect_encoding, mb_convert_encoding, iconv, grapheme functions, emoji handling, unicode processing, locale-aware sorting, ICU library, intl extension (Collator, NumberFormatter, IntlDateFormatter, MessageFormatter, Transliterator, Normalizer), currency formatting, date formatting, transliteration, string normalization (NFC, NFD, NFKC, NFKD), and the UTF-8 input-to-output pipeline.
---

# PHP Internationalization & Encoding

## UTF-8 Everywhere

```php
// Set early — affects all mb_* functions
mb_internal_encoding('UTF-8');
header('Content-Type: text/html; charset=UTF-8');

// Use mb_* for all string operations on user text
$len   = mb_strlen($str);        // NOT strlen() — counts bytes, not chars
$upper = mb_strtoupper($str);    // NOT strtoupper()
$sub   = mb_substr($str, 0, 10); // NOT substr()
$pos   = mb_strpos($str, $needle);

// PHP 8.4+ multibyte trim
$clean = mb_trim($str);
$clean = mb_ltrim($str);
$clean = mb_rtrim($str);
```

| Rule | Detail |
|------|--------|
| `strlen()` counts bytes | `"\xF0\x9F\x9A\x80"` = 4 bytes, 1 character — use `mb_strlen()` |
| `substr()` corrupts multibyte | Use `mb_substr()` for slicing |
| `strtoupper()` / `strtolower()` | Only handles ASCII — use `mb_strtoupper()` |
| Set `default_charset = UTF-8` | In php.ini — replaces deprecated `mbstring.internal_encoding` |
| MySQL needs `utf8mb4` | `utf8` is only 3 bytes, can't store emoji |

## Encoding Detection & Conversion

```php
// Convert from unknown encoding to UTF-8
$utf8 = mb_convert_encoding($str, 'UTF-8', 'ISO-8859-1');

// Detect encoding (unreliable — prefers explicit metadata)
$enc = mb_detect_encoding($str, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);

// Validate UTF-8 (strict mode returns false for invalid)
if (mb_detect_encoding($str, 'UTF-8', true) === false) {
    $str = mb_convert_encoding($str, 'UTF-8', 'Windows-1252');
}
```

| Gotcha | Detail |
|--------|--------|
| `mb_detect_encoding()` guesses | Same bytes can be valid in multiple encodings |
| Always declare encoding | HTTP headers, HTML meta, DB connection charset |
| `iconv()` varies by system | GNU libiconv is more reliable than glibc |
| Regex needs `/u` modifier | Without it, PCRE treats input as single-byte |

## Database & JSON Encoding

```php
// MySQL: always use utf8mb4
$pdo = new PDO('mysql:host=localhost;dbname=app;charset=utf8mb4', $user, $pass);

// PostgreSQL
$pdo = new PDO("pgsql:host=localhost;dbname=app;options='-c client_encoding=UTF8'");

// JSON: all strings must be UTF-8
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

// Handle broken UTF-8 in JSON (PHP 7.2+)
$json = json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE); // replaces with U+FFFD
```

## intl Extension (ICU)

```php
// Locale-aware string comparison
$coll = Collator::create('de_DE');
$coll->compare('a with umlaut', 'z');  // locale-correct ordering
$coll->sort($array);

// Number formatting
$fmt = NumberFormatter::create('de_DE', NumberFormatter::DECIMAL);
echo $fmt->format(1234.56);  // "1.234,56"
$fmt->formatCurrency(99.99, 'EUR');  // "99,99 EUR"

// Date formatting
$fmt = IntlDateFormatter::create('fr_FR', IntlDateFormatter::LONG, IntlDateFormatter::SHORT);
echo $fmt->format(time());  // "1 fevrier 2026 a 14:30"

// Pluralization
$msg = '{count, plural, =0{no items} one{# item} other{# items}}';
echo MessageFormatter::formatMessage('en_US', $msg, ['count' => 5]); // "5 items"

// Transliteration
$t = Transliterator::create('Any-Latin; Latin-ASCII');
echo $t->transliterate('Privet mir');  // transliterated output
```

| Class | Use for |
|-------|---------|
| `Collator` | Locale-aware sorting and comparison |
| `NumberFormatter` | Numbers, currencies, percentages |
| `IntlDateFormatter` | Dates/times per locale |
| `MessageFormatter` | ICU messages with plurals/gender |
| `Transliterator` | Script conversion (Cyrillic to Latin, etc.) |
| `Normalizer` | Unicode normalization (NFC, NFD, NFKC, NFKD) |

## HTTP Charset Pipeline

```
Input -> Convert to UTF-8 -> Process with mb_* -> Output with charset header -> Store as utf8mb4
```

| Stage | Action |
|-------|--------|
| **Input** | Detect/convert: `mb_convert_encoding($input, 'UTF-8', $detected)` |
| **Processing** | Use `mb_*` functions; regex with `/u` modifier |
| **HTML output** | `header('Content-Type: text/html; charset=UTF-8')` |
| **JSON output** | `json_encode($data, JSON_UNESCAPED_UNICODE)` |
| **Database** | `charset=utf8mb4` in DSN; `SET NAMES utf8mb4` |
| **Files** | Verify encoding on read; BOM handling if needed |
