# WordPress API Usage, Deprecated Functions & Formatting -- Detailed Examples

Extended code examples for Sections 6, 7, and 8 of the WordPress Coding Standards skill.

---

## 6. WordPress API Usage

### 6.1 Capabilities, Not Roles

Use specific capabilities in `current_user_can()`, not role names.

```php
// BAD
if ( current_user_can( 'administrator' ) ) {}
if ( current_user_can( 'editor' ) ) {}

// GOOD
if ( current_user_can( 'manage_options' ) ) {}
if ( current_user_can( 'edit_others_posts' ) ) {}
```

Common capabilities: `manage_options`, `edit_posts`, `edit_others_posts`, `publish_posts`, `delete_posts`, `upload_files`, `edit_theme_options`, `activate_plugins`.

### 6.2 Cron Intervals

Cron schedules must not be shorter than 15 minutes (900 seconds) per VIP/hosting guidelines.

```php
// BAD
add_filter( 'cron_schedules', function( $schedules ) {
    $schedules['every_minute'] = array(
        'interval' => 60,
        'display'  => 'Every Minute',
    );
    return $schedules;
} );

// GOOD
add_filter( 'cron_schedules', function( $schedules ) {
    $schedules['every_thirty_min'] = array(
        'interval' => 1800,
        'display'  => 'Every 30 Minutes',
    );
    return $schedules;
} );
```

### 6.3 Posts Per Page

Avoid excessively high `posts_per_page` values (default limit: 100). Use pagination instead of `-1`.

```php
// BAD
$query = new WP_Query( array( 'posts_per_page' => -1 ) );
$query = new WP_Query( array( 'posts_per_page' => 999 ) );

// GOOD
$query = new WP_Query( array( 'posts_per_page' => 50 ) );
```

### 6.4 Do Not Override WordPress Globals

Never overwrite WP native globals like `$post`, `$wp_query`, `$authordata`, `$currentday`, `$page`, etc. in the global scope.

```php
// BAD (in global scope or after global import)
global $post;
$post = get_post( 123 ); // overwrites the global

// GOOD
$my_post = get_post( 123 );
```

### 6.5 `get_post_meta()` -- Always Pass `$single`

When calling `get_post_meta()` (or any `get_*_meta()`) with a `$key`, always specify the `$single` parameter to make the return type explicit.

```php
// BAD - ambiguous return type (array vs string)
$value = get_post_meta( $post_id, 'acme_field' );

// GOOD
$value = get_post_meta( $post_id, 'acme_field', true );   // returns string
$values = get_post_meta( $post_id, 'acme_field', false );  // returns array
```

Applies to: `get_post_meta`, `get_user_meta`, `get_term_meta`, `get_comment_meta`, `get_site_meta`, `get_metadata`, `get_metadata_raw`, `get_metadata_default`.

### 6.6 `current_time()` Is NOT a Unix Timestamp

`current_time( 'timestamp' )` returns a "WordPress timestamp" (Unix time + timezone offset) -- NOT a real Unix timestamp. This causes bugs in date math.

```php
// BAD
$now = current_time( 'timestamp' );
$now = current_time( 'U' );

// GOOD - for UTC timestamp
$now = time();

// GOOD - for formatted local time
$now = current_time( 'mysql' );
$now = current_time( 'Y-m-d H:i:s' );

// GOOD - if you explicitly need UTC via current_time
$now = current_time( 'U', true );  // gmt=true, but time() is simpler
```

---

## 7. Deprecated Functions (Common Replacements)

| Deprecated | Since | Replacement |
|-----------|-------|-------------|
| `get_currentuserinfo()` | 4.5 | `wp_get_current_user()` |
| `get_page_by_title()` | 6.2 | `WP_Query` |
| `is_taxonomy()` | 3.0 | `taxonomy_exists()` |
| `is_term()` | 3.0 | `term_exists()` |
| `get_settings()` | 2.1 | `get_option()` |
| `get_usermeta()` | 3.0 | `get_user_meta()` |
| `update_usermeta()` | 3.0 | `update_user_meta()` |
| `delete_usermeta()` | 3.0 | `delete_user_meta()` |
| `wp_get_sites()` | 4.6 | `get_sites()` |
| `like_escape()` | 4.0 | `$wpdb->esc_like()` |
| `get_all_category_ids()` | 4.0 | `get_terms()` |
| `post_permalink()` | 4.4 | `get_permalink()` |
| `force_ssl_login()` | 4.4 | `force_ssl_admin()` |
| `wp_no_robots()` | 5.7 | `wp_robots_no_robots()` |
| `wp_make_content_images_responsive()` | 5.5 | `wp_filter_content_tags()` |
| `add_option_whitelist()` | 5.5 | `add_allowed_options()` |
| `remove_option_whitelist()` | 5.5 | `remove_allowed_options()` |
| `wp_get_loading_attr_default()` | 6.3 | `wp_get_loading_optimization_attributes()` |
| `the_meta()` | 6.0.2 | `get_post_meta()` |
| `readonly()` | 5.9 | `wp_readonly()` |
| `attribute_escape()` | 2.8 | `esc_attr()` |
| `wp_specialchars()` | 2.8 | `esc_html()` |
| `js_escape()` | 2.8 | `esc_js()` |
| `clean_url()` | 3.0 | `esc_url()` |
| `seems_utf8()` | 6.9 | `wp_is_valid_utf8()` |
| `current_user_can_for_blog()` | 6.7 | `current_user_can_for_site()` |

WPCS flags usage as an error if the function was deprecated before your configured minimum WP version, and a warning otherwise.

---

## 8. Formatting

### 8.1 Spacing

WordPress uses spaces inside parentheses, brackets, and around operators:

```php
// BAD
if($condition){
    $arr = array('a'=>1,'b'=>2);
    foreach($arr as $k=>$v){}
}

// GOOD
if ( $condition ) {
    $arr = array( 'a' => 1, 'b' => 2 );
    foreach ( $arr as $k => $v ) {}
}
```

**Control structures** always use spaces after keywords and inside parentheses:

```php
if ( $a ) {}
elseif ( $b ) {}
for ( $i = 0; $i < 10; $i++ ) {}
while ( $condition ) {}
switch ( $var ) {}
```

### 8.2 Indentation

- Use **tabs** for indentation, not spaces.
- Array items: one item per line for multi-line arrays, with trailing comma.

```php
$args = array(
    'post_type'      => 'acme_book',
    'posts_per_page' => 10,
    'orderby'        => 'date',
    'order'          => 'DESC',
);
```

### 8.3 Operator Spacing

```php
// BAD
$a=$b+$c;
$d = $e.$f;

// GOOD
$a = $b + $c;
$d = $e . $f;
```

### 8.4 Cast Spacing

A space after the cast, no space inside:

```php
// BAD
$id = (int)$_GET['id'];
$id = ( int ) $_GET['id'];

// GOOD
$id = (int) $_GET['id'];
```

### 8.5 Object Operator Spacing

No spaces around `->` or `?->`:

```php
// BAD
$post -> post_title;

// GOOD
$post->post_title;
```
