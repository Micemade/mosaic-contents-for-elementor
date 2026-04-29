---
name: wp-performance
description: Use when optimizing WordPress performance, debugging slow queries, configuring caching, reviewing database code, or preparing for high traffic. Covers WP_Query optimization (get_posts, meta_query, tax_query, no_found_rows, update_post_meta_cache, fields), object cache (wp_cache_get, wp_cache_set, Redis, Memcached), transients (set_transient, get_transient), autoload options, Query Monitor, Debug Bar, slow query profiling, anti-patterns (posts_per_page -1, query_posts, N+1), WP-CLI profiling, asset loading strategies, and platform-specific guidance.
---

# WordPress Performance Optimization

Comprehensive guide for optimizing WordPress performance: database queries, caching layers, hooks, AJAX, assets, profiling, and anti-pattern detection.

## When to Use

- Reviewing code for performance issues in themes or plugins
- Debugging slow page loads, timeouts, or 500 errors
- Optimizing WP_Query or database operations
- Implementing or auditing caching strategy
- Preparing for high-traffic events (launch, sale, viral moment)
- Investigating memory exhaustion or database locks
- Profiling backend performance without a browser

---

## 1. Database & WP_Query Optimization

> Full code examples: [resources/database-queries.md](resources/database-queries.md)

### WP_Query Review Checklist

- [ ] `posts_per_page` is set (never -1)
- [ ] `no_found_rows => true` when not paginating
- [ ] `fields => 'ids'` when only IDs needed
- [ ] `update_post_meta_cache => false` if meta not used
- [ ] `update_post_term_cache => false` if terms not used
- [ ] Date limits on archive queries
- [ ] `include_children => false` if child terms not needed
- [ ] No `post__not_in` with large arrays
- [ ] No `meta_query` on `meta_value` (use taxonomy or key presence)
- [ ] Results cached with `wp_cache_set` if repeated

### EXPLAIN Indicators

| Column  | Good Value                          | Bad Value                               |
|---------|-------------------------------------|-----------------------------------------|
| `type`  | `const`, `eq_ref`, `ref`, `range`   | `ALL` (full table scan)                 |
| `key`   | Named index                         | `NULL` (no index used)                  |
| `rows`  | Small number                        | Large number                            |
| `Extra` | `Using index`                       | `Using filesort`, `Using temporary`     |

---

## 2. Caching Layers

> Full code examples: [resources/caching-patterns.md](resources/caching-patterns.md)

### Caching Architecture

```
User Request
    |
[ CDN / Edge Cache ]       -- Full page HTML, static assets
    |
[ Page Cache (Varnish) ]   -- Bypassed by: cookies, POST, query params
    |
[ Object Cache (Redis) ]   -- DB query results, transients, computed data
    |
[ Database (MySQL) ]       -- InnoDB buffer pool
```

### TTL Strategy

| Content Type   | Recommended TTL |
|----------------|-----------------|
| Homepage       | 5-15 minutes    |
| Archive pages  | 15-60 minutes   |
| Single posts   | 1-24 hours      |
| Static pages   | 24+ hours       |
| Media files    | 1 year (versioned) |

**Page Cache Bypass Triggers (Avoid):** `session_start()`, `setcookie()` on public pages, POST for read ops, unique query params (UTM/fbclid).

### Memcached vs Redis

| Feature            | Memcached        | Redis                          |
|--------------------|------------------|--------------------------------|
| Speed              | Slightly faster  | Fast                           |
| Data types         | String only      | Strings, lists, sets, hashes   |
| Persistence        | No               | Optional                       |
| Memory efficiency  | Higher           | Lower                          |
| Cache groups       | Limited          | Full support (`flush_group`)   |

**Recommendation:** Use what your host provides. Redis if you need advanced features (groups, persistence).

---

## 3. Hooks & Actions Anti-Patterns

> Full code examples: [resources/hooks-ajax-assets.md](resources/hooks-ajax-assets.md)

- **Expensive code on `init` / `wp_loaded`** (WARNING): HTTP calls or heavy computation on every request. Cache results or move to a later, scoped hook.
- **Database writes on frontend page loads** (CRITICAL): DB writes on every page view. Buffer in object cache, flush via cron.
- **Missing conditional loading** (WARNING): Code runs on admin and frontend when only one is needed. Use `template_redirect` or guard with `is_admin()`.

---

## 4. AJAX & External Requests

> Full code examples: [resources/hooks-ajax-assets.md](resources/hooks-ajax-assets.md)

- **`admin-ajax.php` for public endpoints** (WARNING): Loads full WP admin bootstrap. Use REST API instead.
- **AJAX polling with `setInterval`** (CRITICAL): Self-DDoS. Use WebSockets, SSE, or exponential backoff.
- **Uncached `wp_remote_get`** (WARNING): Blocks render, no timeout. Cache response and set timeout.
- **Synchronous external API calls on page load**: Move heavy remote work to cron/queue.

---

## 5. Asset Loading

> Full code examples: [resources/hooks-ajax-assets.md](resources/hooks-ajax-assets.md)

- **Assets loaded globally** (WARNING): Enqueue conditionally with `is_page()` / `is_singular()`.
- **Render-blocking scripts** (INFO): Use `'strategy' => 'defer'` (WordPress 6.3+).
- **Full library imports** (WARNING): Import only needed modules (e.g., `lodash/map` instead of `lodash`).
- **Missing version strings** (INFO): Use a `THEME_VERSION` constant for cache busting.

---

## 6. Transients & Options

### Large Autoloaded Options (WARNING)

All autoloaded options load on every request into `alloptions` cache. Disable autoload for large or infrequently accessed data using `add_option( ..., '', 'no' )` or `update_option( ..., false )`.

**WP-CLI diagnostic:**
```bash
wp option list --autoload=on --fields=option_name,size_bytes --format=table | sort -k2 -n | tail -20
```

---

## 7. WP-Cron

> Full code examples: [resources/hooks-ajax-assets.md](resources/hooks-ajax-assets.md)

- **Default WP-Cron fires on page requests**, adding latency to real users. Disable with `DISABLE_WP_CRON` and use a server crontab.
- **Long-running cron callbacks** (CRITICAL): Process in batches with reschedule, never all records at once.
- **Always check `wp_next_scheduled()` before `wp_schedule_event()`** to avoid duplicate schedules.

---

## 8. Uncached Function Calls

> Caching wrapper code: [resources/hooks-ajax-assets.md](resources/hooks-ajax-assets.md)

These WordPress functions query the database on every call without internal caching:

| Function                      | Issue                        | Fix                        |
|-------------------------------|------------------------------|----------------------------|
| `url_to_postid()`            | Full posts table scan        | Wrap with `wp_cache`       |
| `attachment_url_to_postid()` | Expensive meta lookup        | Wrap with `wp_cache`       |
| `count_user_posts()`         | COUNT query per call         | Cache per user             |
| `get_adjacent_post()`        | Complex query                | Cache or avoid in loops    |
| `wp_oembed_get()`            | External HTTP + parsing      | Cache with transient       |
| `wp_old_slug_redirect()`     | Meta table lookup            | Cache result               |

---

## 9. Profiling & Measurement

### WP-CLI Profiling Commands

```bash
# Install if missing:
wp package install wp-cli/profile-command

# Stage overview:
wp profile stage --fields=stage,time,cache_ratio --url=https://example.com/

# Find slow hooks:
wp profile hook --spotlight --url=https://example.com/

# Drill into a specific hook:
wp profile hook init --spotlight
```

### WP-CLI Doctor (Quick Diagnostics)

```bash
wp package install wp-cli/doctor-command
wp doctor check
# Checks: autoload-options-size, SAVEQUERIES, WP_DEBUG, cron duplicates, etc.
```

### Server-Timing Headers

With Performance Lab plugin enabled:
```bash
curl -sS -D - https://example.com/ -o /dev/null | grep -i "server-timing:"
```

### Query Monitor (Headless via REST)

Authenticate with Application Password, then inspect `x-qm-*` response headers or use `?_envelope` to get `qm` property with DB queries, cache stats, HTTP API timing.

### Performance Targets

| Metric              | Target    | Investigate |
|---------------------|-----------|-------------|
| Page generation     | < 200ms   | > 500ms     |
| TTFB                | < 200ms   | > 500ms     |
| Database queries    | < 50      | > 100       |
| Duplicate queries   | 0         | > 5         |
| Slowest query       | < 50ms    | > 100ms     |
| Object cache hits   | > 90%     | < 80%       |
| Total query time    | < 100ms   | > 500ms     |

---

## 10. Platform-Specific Guidance

| Platform                | Object Cache | Key Notes                                                       |
|-------------------------|--------------|-----------------------------------------------------------------|
| **WordPress VIP**       | Built-in     | Use `wpcom_vip_*` helpers; page cache at edge; strict code review |
| **WP Engine**           | Built-in     | EverCache page cache; Redis object cache; purge API available    |
| **Pantheon**            | Built-in     | Redis object cache; Varnish page cache; Fastly CDN               |
| **Self-hosted + Redis** | Manual setup | Install `wp-redis` or `object-cache-pro`; configure TTLs         |
| **Shared hosting**      | Usually none | Transients fall back to DB; be extra cautious with unbounded queries |

---

## 11. Anti-Pattern Quick Reference

| # | Pattern | Severity | Fix |
|---|---------|----------|-----|
| 1 | `posts_per_page => -1` | CRITICAL | Set limit, paginate |
| 2 | `query_posts()` | CRITICAL | Use `WP_Query` or `pre_get_posts` |
| 3 | `session_start()` on frontend | CRITICAL | Remove or restrict to logged-in users |
| 4 | `setInterval` + fetch/ajax | CRITICAL | WebSockets, SSE, or backoff polling |
| 5 | DB writes on every page load | CRITICAL | Buffer in cache, flush via cron |
| 6 | `intval($falsy)` in query args | CRITICAL | Validate before querying |
| 7 | N+1 queries in loops | CRITICAL | `update_postmeta_cache()` / batch |
| 8 | Long-running cron callbacks | CRITICAL | Batch processing with reschedule |
| 9 | Redirect loops | CRITICAL | Debug with `x-redirect-by` header |
| 10 | `cache_results => false` | WARNING | Remove (let WP cache results) |
| 11 | `LIKE '%term%'` (leading wildcard) | WARNING | Trailing wildcard or search engine |
| 12 | `post__not_in` large arrays | WARNING | Fetch extra, filter in PHP |
| 13 | `meta_query` on `meta_value` | WARNING | Use taxonomy or key EXISTS |
| 14 | Uncached `wp_remote_get` | WARNING | Cache response, set timeout |
| 15 | `$.post()` for read operations | WARNING | Use GET (cacheable) |
| 16 | `add_option` without `autoload=no` | WARNING | Set autoload to `'no'` for large data |
| 17 | `setcookie()` on public pages | WARNING | JS cookies or restrict scope |
| 18 | `url_to_postid()` uncached | WARNING | Wrap with `wp_cache` |
| 19 | `admin-ajax.php` for public use | WARNING | Use REST API |
| 20 | Dynamic transient keys without obj cache | WARNING | Use `wp_cache_set` directly |
| 21 | `in_array()` without strict, large array | WARNING | `isset()` on associative array |
| 22 | Expensive code on `init` hook | WARNING | Use `template_redirect` or guard |
| 23 | Assets loaded globally | WARNING | Conditional `wp_enqueue_script` |
| 24 | `get_template_part` in large loops | WARNING | Cache rendered output |
| 25 | `wp_schedule_event` without `wp_next_scheduled` | WARNING | Check before scheduling |
| 26 | POST infinite scroll | WARNING | Use GET requests (cacheable) |
| 27 | Full lodash import | WARNING | Import specific modules |
| 28 | Missing `no_found_rows` (non-paginated) | INFO | Add `'no_found_rows' => true` |
| 29 | Missing script version string | INFO | Use `THEME_VERSION` constant |
| 30 | Missing `defer`/`async` strategy | INFO | Use `'strategy' => 'defer'` (WP 6.3+) |

---

## 12. Search Patterns for Quick Detection

```bash
# Critical issues
grep -rn "posts_per_page.*-1\|numberposts.*-1" .
grep -rn "query_posts\s*(" .
grep -rn "session_start\s*(" .
grep -rn "setInterval.*fetch\|setInterval.*ajax" .

# DB writes on frontend
grep -rn "update_option\|add_option" . | grep -v "admin\|activate\|install"

# Uncached expensive functions
grep -rn "url_to_postid\|attachment_url_to_postid\|count_user_posts" .

# External HTTP without caching
grep -rn "wp_remote_get\|wp_remote_post" .

# Asset loading issues
grep -rn "wp_enqueue_script\|wp_enqueue_style" . | grep -v "is_page\|is_singular\|is_admin"

# Transient misuse
grep -rn "set_transient.*\\\$" .

# WP-Cron issues
grep -rn "wp_schedule_event" . | grep -v "wp_next_scheduled"
```

---

## Severity Definitions

| Severity     | Description                                           |
|--------------|-------------------------------------------------------|
| **Critical** | Will cause failures at scale (OOM, 500s, DB locks)    |
| **Warning**  | Degrades performance under load                       |
| **Info**     | Optimization opportunity                              |

## Output Format

When reporting findings, structure as:

```
## Performance Review: [filename/component]

### Critical Issues
- **Line X**: [Issue] - [Explanation] - [Fix]

### Warnings
- **Line X**: [Issue] - [Explanation] - [Fix]

### Recommendations
- [Optimization opportunities]

### Summary
- Total issues: X Critical, Y Warnings, Z Info
- Estimated impact: [High/Medium/Low]
```
