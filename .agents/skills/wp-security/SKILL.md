---
name: wp-security
description: Use when handling user input, database queries, file operations, authentication, or output in WordPress. Covers XSS prevention, CSRF protection, SQL injection prevention, prepared statements with $wpdb->prepare, nonces (wp_nonce_field, check_ajax_referer, wp_verify_nonce), authorization with current_user_can, input sanitization (sanitize_text_field, wp_unslash), output escaping (esc_html, esc_attr, esc_url, esc_js), wp_kses_post, wp_kses, DISALLOW_FILE_EDIT, file upload validation, safe redirects, AJAX security, and REST API permission_callback patterns.
---

# WordPress Security

Golden rule: **sanitize and validate on input, escape on output.**

Every piece of data that originates outside your code -- superglobals, database results, remote API responses, user meta -- is untrusted.

---

## 1. Output Escaping (XSS Prevention)

Every `echo`, `print`, `<?=`, and printing function MUST pass through an escaping function. Escape **late** -- at the point of output, not when storing data.

### Escaping Functions by Context

| Context | Function | Notes |
|---|---|---|
| HTML body | `esc_html()` | Encodes `<`, `>`, `&`, `"`, `'` |
| HTML attribute | `esc_attr()` | Safe inside quoted attribute values |
| URL / `href` | `esc_url()` | Rejects `javascript:` and invalid schemes |
| JavaScript string | `esc_js()` | For inline `<script>` or `onclick` values |
| `<textarea>` content | `esc_textarea()` | Like `esc_html()` with double-encode off |
| Filtered HTML | `wp_kses( $str, $allowed )` | Strips all tags not in allowlist |
| Post content HTML | `wp_kses_post()` | Uses the post-allowed tag set |
| Custom tag set | `wp_kses_allowed_html( $context )` | Returns allowed tags array for a context |
| Raw URL (db storage) | `esc_url_raw()` | Like `esc_url()` but no entity encoding |
| XML output | `esc_xml()` | For RSS/Atom/sitemap contexts |

### Translated String Escaping

| Instead of | Use |
|---|---|
| `_e( $text, $domain )` | `esc_html_e()` or `esc_attr_e()` |
| `echo __( $text, $domain )` | `echo esc_html__()` or `echo esc_attr__()` |
| `echo _x( $text, $ctx, $domain )` | `echo esc_html_x()` or `echo esc_attr_x()` |

### Auto-Escaped Functions (safe to echo directly)

These WordPress functions return pre-escaped output. You do NOT need to wrap them in an additional escaping call:

`allowed_tags`, `bloginfo`, `body_class`, `checked`, `comment_class`, `count`, `disabled`, `do_shortcode`, `get_archives_link`, `get_avatar`, `get_calendar`, `get_current_blog_id`, `get_delete_post_link`, `get_search_form`, `get_search_query`, `get_the_author`, `get_the_date`, `get_the_ID`, `get_the_post_thumbnail`, `get_the_term_list`, `post_type_archive_title`, `readonly`, `selected`, `single_cat_title`, `single_month_title`, `single_post_title`, `single_tag_title`, `single_term_title`, `tag_description`, `term_description`, `the_author`, `the_date`, `the_title_attribute`, `walk_nav_menu_tree`, `wp_dropdown_categories`, `wp_dropdown_users`, `wp_generate_tag_cloud`, `wp_get_archives`, `wp_get_attachment_image`, `wp_link_pages`, `wp_list_authors`, `wp_list_bookmarks`, `wp_list_categories`, `wp_list_comments`, `wp_login_form`, `wp_loginout`, `wp_nav_menu`, `wp_register`, `wp_tag_cloud`, `wp_title`

### BAD / GOOD Examples

```php
// BAD: raw variable in HTML
echo '<div class="name">' . $user_name . '</div>';

// GOOD: escaped at output
echo '<div class="name">' . esc_html( $user_name ) . '</div>';

// BAD: raw variable in attribute
echo '<input value="' . $value . '">';

// GOOD: attribute-escaped
echo '<input value="' . esc_attr( $value ) . '">';

// BAD: raw URL
echo '<a href="' . $url . '">Link</a>';

// GOOD: URL-escaped
echo '<a href="' . esc_url( $url ) . '">Link</a>';

// BAD: unescaped translation
_e( $dynamic_string, 'my-plugin' );

// GOOD: escaped translation with known string
esc_html_e( 'Settings saved.', 'my-plugin' );

// GOOD: wp_kses for controlled HTML
echo wp_kses( $user_bio, array(
    'a'      => array( 'href' => array(), 'title' => array() ),
    'strong' => array(),
    'em'     => array(),
) );
```

**Integer casting** (`(int)`, `(bool)`, `(float)`) is also considered safe for output.

---

## 2. Nonce Verification (CSRF Protection)

Nonces prevent cross-site request forgery. They do NOT replace authorization checks.

### Creating Nonces

| Method | Usage |
|---|---|
| `wp_nonce_field( $action, $name )` | Hidden field in forms |
| `wp_nonce_url( $url, $action, $name )` | Append nonce to URL |
| `wp_create_nonce( $action )` | Generate nonce value manually |

### Verifying Nonces

| Method | Usage |
|---|---|
| `wp_verify_nonce( $nonce, $action )` | General verification |
| `check_admin_referer( $action, $name )` | Admin form submissions (`wp_nonce_field`) |
| `check_ajax_referer( $action, $name )` | AJAX requests |

### Rules

- Every access to `$_POST`, `$_GET`, `$_REQUEST`, or `$_FILES` MUST have a nonce check nearby in the same scope.
- `$_POST` and `$_FILES` without nonce verification trigger errors. `$_GET` and `$_REQUEST` trigger warnings.
- Nonce field names should be unique per action (e.g., `my_plugin_save_nonce`).
- Always pair with `current_user_can()`.

### Edge Cases

- **Return values**: `wp_verify_nonce()` returns `1` (generated 0–12 hours ago), `2` (12–24 hours ago), or `false` (invalid/expired). Both `1` and `2` are truthy.
- **Reusable**: WordPress nonces are NOT true one-time tokens — the same nonce can be used multiple times within its 12–24 hour window.
- **Session-tied**: Nonces are tied to the user session. If a user logs out, all their nonces become invalid — forms left open in another tab will fail.
- **Caching conflicts**: Full-page caching can serve stale nonces to users. Use AJAX nonce refresh or fragment caching for forms on cached pages.
- **NOT authorization**: A valid nonce proves the request came from your site, not that the user is allowed to perform the action. Always combine with `current_user_can()`.

```php
// BAD: processing form without nonce
if ( isset( $_POST['title'] ) ) {
    update_post_meta( $id, '_title', sanitize_text_field( wp_unslash( $_POST['title'] ) ) );
}

// GOOD: nonce + capability + sanitization
if ( isset( $_POST['my_plugin_nonce'] )
    && wp_verify_nonce( sanitize_key( $_POST['my_plugin_nonce'] ), 'my_plugin_save' )
    && current_user_can( 'edit_post', $post_id )
) {
    $title = sanitize_text_field( wp_unslash( $_POST['title'] ) );
    update_post_meta( $post_id, '_title', $title );
}
```

---

## 3. Input Validation and Sanitization

Every superglobal access (`$_GET`, `$_POST`, `$_REQUEST`, `$_FILES`, `$_SERVER`, `$_COOKIE`) MUST be validated for existence and sanitized before use.

### Sanitization Functions

| Function | Purpose |
|---|---|
| `sanitize_text_field()` | General single-line text |
| `sanitize_textarea_field()` | Multi-line text |
| `sanitize_email()` | Email addresses |
| `sanitize_file_name()` | File names |
| `sanitize_title()` | Slugs / URL-safe titles |
| `sanitize_key()` | Lowercase alphanumeric with dashes/underscores |
| `sanitize_html_class()` | CSS class names |
| `sanitize_hex_color()` | Hex color values |
| `sanitize_mime_type()` | MIME types |
| `sanitize_url()` | URLs (alias: `esc_url_raw()`) |
| `absint()` | Absolute integer (non-negative) |
| `intval()` | Integer casting |
| `floatval()` | Float casting |
| `wp_unslash()` | Remove WP-added slashes before sanitizing |
| `wp_kses()` | Strip disallowed HTML |
| `filter_input()` | PHP native type-safe input filter |
| `filter_var()` | PHP native variable filter |

### Critical Rules

1. **`wp_unslash()` before sanitizing.** WordPress adds magic quotes to `$_GET`, `$_POST`, `$_COOKIE`, `$_REQUEST`, and `$_SERVER`. Always unslash first.
2. **Never trust `$_REQUEST`** -- specify `$_GET` or `$_POST` explicitly so you know the source.
3. **Validate existence** before reading: use `isset()`, null coalescing (`??`), or `empty()`.
4. **Type-validate** with `filter_var()`, `is_numeric()`, `in_array()` against a whitelist, etc.

```php
// BAD: raw superglobal, no validation, no unslash
$name = sanitize_text_field( $_POST['name'] );

// GOOD: validate existence, unslash, then sanitize
if ( isset( $_POST['name'] ) ) {
    $name = sanitize_text_field( wp_unslash( $_POST['name'] ) );
}

// BAD: trusting $_REQUEST
$action = $_REQUEST['action'];

// GOOD: explicit source with type validation
$action = isset( $_POST['action'] ) ? sanitize_key( wp_unslash( $_POST['action'] ) ) : '';

// GOOD: integer validation
$page = isset( $_GET['paged'] ) ? absint( $_GET['paged'] ) : 1;

// GOOD: whitelist validation
$status = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : 'draft';
if ( ! in_array( $status, array( 'draft', 'publish', 'pending' ), true ) ) {
    $status = 'draft';
}
```

---

## 4. SQL Injection Prevention

### ALWAYS Use `$wpdb->prepare()`

Never interpolate variables into SQL strings. Use `$wpdb->prepare()` with placeholders.

### Placeholder Types

| Placeholder | Type | Notes |
|---|---|---|
| `%s` | String | Quoted automatically |
| `%d` | Integer | |
| `%f` | Float | |
| `%i` | Identifier | WP 6.2+. For table/column names. Backtick-quoted automatically. |

### Rules from WPCS Sniffs

- Simple placeholders (`%s`, `%d`, `%f`, `%i`) must NOT be quoted in the query string -- `prepare()` handles quoting.
- Never interpolate PHP variables into SQL; the `PreparedSQL` sniff flags any variable found inside `$wpdb->get_results()`, `$wpdb->query()`, etc. that is not wrapped in `prepare()` or an escaping function (`absint`, `esc_sql`, `intval`, `floatval`).
- Literal `%` in LIKE queries must be escaped as `%%`. Pass SQL wildcards via replacement parameters and use `$wpdb->esc_like()`.
- Direct database calls should be accompanied by `wp_cache_get()` / `wp_cache_set()` for cacheable queries.

<!-- Full examples: resources/sql-injection-prevention.md -->
### Convenience Methods (auto-escape values)

Use these instead of raw SQL when possible:

| Method | Purpose |
|---|---|
| `$wpdb->insert( $table, $data, $format )` | INSERT row |
| `$wpdb->update( $table, $data, $where, $format, $where_format )` | UPDATE rows |
| `$wpdb->delete( $table, $where, $where_format )` | DELETE rows |
| `$wpdb->replace( $table, $data, $format )` | REPLACE row |

These methods handle escaping internally. The `$format` array specifies `%s`, `%d`, or `%f` per column.

### Prefer WordPress Query APIs

When possible, avoid `$wpdb` entirely:

| API | Use case |
|---|---|
| `WP_Query` / `get_posts()` | Post queries |
| `get_post_meta()` / `update_post_meta()` | Post meta |
| `get_option()` / `update_option()` | Options |
| `get_users()` / `WP_User_Query` | User queries |
| `get_terms()` / `WP_Term_Query` | Taxonomy queries |
| `get_comments()` / `WP_Comment_Query` | Comment queries |

---

## 5. Capabilities and Authorization

### Rules

- ALWAYS check `current_user_can()` before any privileged operation.
- Check **capabilities**, not roles: use `edit_posts` not `is_admin`.
- Use granular capabilities: `edit_post` (singular, with object ID) over `edit_posts` (plural) when checking a specific object.

```php
// BAD: checking role
if ( current_user_can( 'administrator' ) ) { /* ... */ }

// GOOD: checking capability
if ( current_user_can( 'manage_options' ) ) { /* ... */ }

// GOOD: object-level capability
if ( current_user_can( 'edit_post', $post_id ) ) {
    wp_update_post( array( 'ID' => $post_id, 'post_title' => $title ) );
}
```

### Custom Capabilities

```php
// Register custom capability on activation
function myplugin_add_caps() {
    $role = get_role( 'editor' );
    $role->add_cap( 'myplugin_manage_settings' );
}
register_activation_hook( __FILE__, 'myplugin_add_caps' );

// Check custom capability
if ( current_user_can( 'myplugin_manage_settings' ) ) { /* ... */ }
```

### `map_meta_cap` for Object-Level Permissions

```php
add_filter( 'map_meta_cap', function( $caps, $cap, $user_id, $args ) {
    if ( 'myplugin_edit_item' === $cap ) {
        $item = get_post( $args[0] );
        if ( (int) $item->post_author === $user_id ) {
            return array( 'edit_posts' );
        }
        return array( 'do_not_allow' );
    }
    return $caps;
}, 10, 4 );
```

---

## 6. File Security

### File Upload Validation

```php
// BAD: trusting file extension
$ext = pathinfo( $_FILES['upload']['name'], PATHINFO_EXTENSION );
if ( $ext === 'jpg' ) { move_uploaded_file( ... ); }

// GOOD: use WordPress upload handler
$upload_overrides = array( 'test_form' => false );
$uploaded = wp_handle_upload( $_FILES['upload'], $upload_overrides );
if ( isset( $uploaded['error'] ) ) {
    wp_die( esc_html( $uploaded['error'] ) );
}
```

| Function | Purpose |
|---|---|
| `wp_handle_upload()` | Full upload handling with MIME check |
| `wp_check_filetype()` | Validate MIME by extension |
| `wp_check_filetype_and_ext()` | Validate MIME by content + extension |
| `wp_upload_dir()` | Get safe upload directory path |

### Direct File Access Prevention

Every PHP file that is not an entry point MUST block direct access:

```php
// At the top of every plugin/theme PHP file
defined( 'ABSPATH' ) || exit;
```

---

## 7. Safe Redirects

Use `wp_safe_redirect()` instead of `wp_redirect()` for any user-influenced URL. Always call `exit` after redirecting.

```php
// BAD: open redirect vulnerability
wp_redirect( $_GET['redirect_to'] );

// GOOD: safe redirect with validation + exit
$redirect = isset( $_GET['redirect_to'] )
    ? wp_validate_redirect( esc_url_raw( wp_unslash( $_GET['redirect_to'] ) ), admin_url() )
    : admin_url();
wp_safe_redirect( $redirect );
exit;
```

To allow additional redirect hosts:

```php
add_filter( 'allowed_redirect_hosts', function( $hosts ) {
    $hosts[] = 'trusted.example.com';
    return $hosts;
} );
```

---

## 8. AJAX Security

Every AJAX handler MUST verify a nonce and check capabilities.

<!-- Full AJAX handler example: resources/ajax-rest-security.md -->

- Use `wp_send_json_success()` / `wp_send_json_error()` for responses (they call `wp_die()` internally).
- Register `wp_ajax_nopriv_` hooks only when unauthenticated users genuinely need access.
- For `wp_ajax_nopriv_` handlers, nonce verification still applies (use a page-level nonce).

---

## 9. REST API Security

### `permission_callback` Is REQUIRED

Every `register_rest_route()` call MUST include a `permission_callback`. Never use `__return_true` for write operations.

<!-- Full REST route examples: resources/ajax-rest-security.md -->

### Schema Validation

Use `validate_callback` and `sanitize_callback` on every arg:

| Callback | Purpose |
|---|---|
| `validate_callback` | Return `true` or `WP_Error` -- rejects bad input before handler runs |
| `sanitize_callback` | Clean the value -- runs after validation passes |

### Authentication Methods

| Method | When to use |
|---|---|
| Cookie + nonce (`X-WP-Nonce` header) | Browser-based JS requests |
| Application passwords | External / server-to-server integrations |
| Custom auth via `determine_current_user` filter | Token-based / OAuth flows |

---

## 10. Common Vulnerability Patterns

| Vulnerability | Bad Pattern | Fix |
|---|---|---|
| Reflected XSS | `echo $_GET['q'];` | `echo esc_html( sanitize_text_field( wp_unslash( $_GET['q'] ) ) );` |
| Stored XSS | `echo get_post_meta( $id, 'bio', true );` | `echo esc_html( get_post_meta( $id, 'bio', true ) );` |
| SQL injection | `$wpdb->query( "DELETE FROM $t WHERE id=$id" );` | `$wpdb->query( $wpdb->prepare( "DELETE FROM %i WHERE id = %d", $t, $id ) );` |
| CSRF | Processing `$_POST` without nonce | Add `wp_nonce_field()` + `wp_verify_nonce()` |
| Privilege escalation | No `current_user_can()` before action | Add capability check before every privileged operation |
| Open redirect | `wp_redirect( $_GET['url'] );` | `wp_safe_redirect( wp_validate_redirect( ... ) ); exit;` |
| Path traversal | `include( $_GET['template'] );` | Whitelist templates: `in_array( $tpl, $allowed, true )` |
| File upload bypass | Check extension only | Use `wp_handle_upload()` or `wp_check_filetype_and_ext()` |
| Insecure deserialization | `unserialize( $user_input )` | Use `maybe_unserialize()` or `json_decode()` |
| Info disclosure | `__FILE__` as menu slug | Use a static string slug |

---

## 11. Plugin Menu Slug Security

Never use `__FILE__` as a menu slug -- it exposes your server filesystem path to anyone who can view the page source.

```php
// BAD: exposes filesystem
add_menu_page( 'My Plugin', 'My Plugin', 'manage_options', __FILE__, 'render_page' );

// GOOD: static string slug
add_menu_page( 'My Plugin', 'My Plugin', 'manage_options', 'my-plugin', 'render_page' );
```

---

## Security Checklist

Run through this checklist before submitting any WordPress code:

### Output

- [ ] Every `echo` / `print` / `<?=` uses an appropriate escaping function
- [ ] Escaping matches the context (HTML, attribute, URL, JS)
- [ ] Escaping happens at the point of output, not at storage time
- [ ] Translation functions use escaped variants (`esc_html__`, `esc_attr_e`, etc.)
- [ ] `wp_kses()` or `wp_kses_post()` used for any controlled-HTML output

### Input

- [ ] All superglobal access checks `isset()` or null coalescing first
- [ ] `wp_unslash()` is called before sanitization on slashed superglobals
- [ ] Appropriate sanitization function used for the data type
- [ ] Whitelisting used for enumerated values (`in_array` with strict)
- [ ] Never processing entire `$_POST` / `$_GET` arrays -- explicit keys only

### CSRF

- [ ] Every form has `wp_nonce_field()`
- [ ] Every form handler calls `wp_verify_nonce()` or `check_admin_referer()`
- [ ] Every AJAX handler calls `check_ajax_referer()`
- [ ] Nonce actions are specific and unique per operation

### Authorization

- [ ] `current_user_can()` checked before every privileged operation
- [ ] Capabilities used, not role names
- [ ] Object-level checks use meta capabilities with object ID

### Database

- [ ] All `$wpdb` queries use `$wpdb->prepare()` with placeholders
- [ ] No PHP variables interpolated into SQL strings
- [ ] Simple placeholders are unquoted in query strings
- [ ] LIKE wildcards passed via replacement parameters with `$wpdb->esc_like()`
- [ ] WordPress query APIs used when possible (`WP_Query`, `get_option`, etc.)
- [ ] Direct DB queries use caching (`wp_cache_get` / `wp_cache_set`)

### Files

- [ ] `defined( 'ABSPATH' ) || exit;` at top of every PHP file
- [ ] File uploads handled with `wp_handle_upload()`
- [ ] File type validated by content, not just extension
- [ ] Upload paths use `wp_upload_dir()`

### Redirects

- [ ] `wp_safe_redirect()` used for user-influenced redirect targets
- [ ] `exit` called immediately after redirect
- [ ] Redirect URLs validated with `wp_validate_redirect()`

### REST API

- [ ] Every route has a `permission_callback`
- [ ] Write endpoints never use `__return_true` as permission callback
- [ ] All args have `validate_callback` and `sanitize_callback`

### AJAX

- [ ] `check_ajax_referer()` in every handler
- [ ] Capability check in every handler
- [ ] `wp_ajax_nopriv_` used only when unauthenticated access is intentional
- [ ] Responses use `wp_send_json_success()` / `wp_send_json_error()`
