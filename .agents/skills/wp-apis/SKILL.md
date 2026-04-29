---
name: wp-apis
description: Use when working with WordPress core APIs in plugins or themes. Covers add_menu_page, add_submenu_page, add_options_page, add_shortcode, add_meta_box, register_post_type, register_taxonomy, HTTP API (wp_remote_request, wp_remote_get, wp_remote_post), wp_schedule_event (WP-Cron), wp_add_dashboard_widget, users and roles (add_role, current_user_can), privacy tools (wp_register_personal_data_exporter), theme mods, site health API, global variables ($wpdb, $post, $wp_query), add_image_size, responsive images, and advanced hooks (do_action, apply_filters, remove_action).
---

# WordPress Core APIs

---

## 1. Administration Menus

```php
add_menu_page( $page_title, $menu_title, $capability, $menu_slug, $callback, $icon_url, $position )
add_submenu_page( $parent_slug, $page_title, $menu_title, $capability, $menu_slug, $callback )
```

| Helper Function             | Parent Page              |
|-----------------------------|--------------------------|
| `add_dashboard_page()`      | Dashboard                |
| `add_posts_page()`          | Posts                    |
| `add_media_page()`          | Media                    |
| `add_pages_page()`          | Pages                    |
| `add_comments_page()`       | Comments                 |
| `add_theme_page()`          | Appearance               |
| `add_plugins_page()`        | Plugins                  |
| `add_users_page()`          | Users                    |
| `add_management_page()`     | Tools                    |
| `add_options_page()`        | Settings                 |

- Hook: `admin_menu`
- Use `load-{$hook_suffix}` to process form submissions before output.
- `remove_menu_page( $slug )` / `remove_submenu_page( $parent, $slug )` to hide entries.

---

## 2. Shortcodes

```php
add_shortcode( $tag, $callback )
// Callback signature: ( $atts, $content = null, $tag = '' ): string
shortcode_atts( $defaults, $atts, $tag )
do_shortcode( $content )  // Process nested shortcodes in enclosing content.
```

**Rules:**
- **Return, don't echo** -- shortcodes must return HTML; `echo` corrupts layout.
- **Prefix names** -- use a unique prefix to avoid collisions.
- **Escape output** -- all attribute values through `esc_attr()` / `esc_html()`.
- Pass `$tag` to `shortcode_atts()` to enable the `shortcode_atts_{$tag}` filter.

---

## 3. Custom Meta Boxes

```php
add_meta_box( $id, $title, $callback, $screen, $context, $priority )
// Contexts: normal | side | advanced
// Priorities: high | core | default | low
remove_meta_box( $id, $screen, $context )
```

**Save handler checklist** (hook: `save_post`):
1. Verify nonce with `wp_verify_nonce()`
2. Check `DOING_AUTOSAVE`
3. Check `current_user_can( 'edit_post', $post_id )`
4. Sanitize input before `update_post_meta()`

---

## 4. Custom Post Types & Taxonomies

```php
register_post_type( $post_type, $args )
register_taxonomy( $taxonomy, $object_type, $args )
```

**Key CPT args:** `public`, `has_archive`, `show_in_rest` (required for Block Editor), `supports`, `rewrite`, `menu_icon`, `capability_type`.

| `supports` Value   | Feature Enabled              |
|--------------------|------------------------------|
| `title`            | Title field                  |
| `editor`           | Content editor               |
| `thumbnail`        | Featured image               |
| `excerpt`          | Excerpt field                |
| `revisions`        | Revision history             |
| `page-attributes`  | Template + menu order        |
| `custom-fields`    | Custom fields meta box       |
| `comments`         | Comments                     |

**Key taxonomy args:** `hierarchical` (true = categories, false = tags), `show_in_rest`, `rewrite`, `show_admin_column`.

| Template File                      | When                        |
|------------------------------------|-----------------------------|
| `single-{$post_type}.php`         | Single CPT post             |
| `archive-{$post_type}.php`        | CPT archive                 |
| `taxonomy-{$taxonomy}.php`        | Custom taxonomy archive     |
| `taxonomy-{$taxonomy}-{slug}.php` | Specific term archive       |

- Hook on `init`. Flush rewrite rules on activation only -- never on every request.

---

## 5. HTTP API

```php
wp_remote_get( $url, $args )
wp_remote_post( $url, $args )
wp_remote_retrieve_response_code( $response )
wp_remote_retrieve_body( $response )
is_wp_error( $response )
```

| Argument      | Default | Notes                                  |
|---------------|---------|----------------------------------------|
| `method`      | `GET`   | Or `POST`, `PUT`, `DELETE`, etc.       |
| `timeout`     | `5`     | Seconds. Increase for slow APIs.       |
| `redirection` | `5`     | Max redirects to follow.               |
| `httpversion` | `1.0`   | Use `1.1` for keep-alive.             |
| `sslverify`   | `true`  | **Never disable in production.**       |
| `blocking`    | `true`  | `false` = fire-and-forget.             |

- Cache external responses with `set_transient()` / `get_transient()`.

---

## 6. WP-Cron

```php
wp_schedule_event( $timestamp, $recurrence, $hook, $args )
wp_schedule_single_event( $timestamp, $hook, $args )
wp_next_scheduled( $hook, $args )
wp_unschedule_event( $timestamp, $hook, $args )
```

**Custom intervals:** filter `cron_schedules` to add entries like `array( 'interval' => 300, 'display' => 'Every 5 Minutes' )`.

**Rules:**
- Always guard with `wp_next_scheduled()` before scheduling.
- Clean up with `wp_unschedule_event()` in `register_deactivation_hook`.
- For production: `define( 'DISABLE_WP_CRON', true )` + system crontab running `wp cron event run --due-now`.

---

## 7. Dashboard Widgets

```php
wp_add_dashboard_widget( $widget_id, $widget_name, $callback )
// Hook: wp_dashboard_setup
```

- For side column: use `add_meta_box()` with `'dashboard'` screen and `'side'` context.
- Remove defaults: `remove_meta_box( $id, 'dashboard', $context )`.

---

## 8. Users & Roles

```php
add_role( $role, $display_name, $capabilities )
remove_role( $role )
$role->add_cap( $cap )  // via get_role()
$role->remove_cap( $cap )
current_user_can( $capability )
```

**User Meta:**
```php
update_user_meta( $user_id, $key, $value )
get_user_meta( $user_id, $key, $single )
delete_user_meta( $user_id, $key )
```

**WP_User_Query:** accepts `role`, `orderby`, `order`, `number`, `meta_query`.

- Roles persist in DB -- add on activation, remove on uninstall.

---

## 9. Privacy API

WordPress 4.9.6+ GDPR/privacy tools. Plugins storing personal data should register exporters and erasers.

**Filters:**
- `wp_privacy_personal_data_exporters` -- register exporter callback returning `array( 'data' => [...], 'done' => bool )`.
- `wp_privacy_personal_data_erasers` -- register eraser callback returning `array( 'items_removed' => int, 'items_retained' => int, 'messages' => [], 'done' => bool )`.

**Privacy policy:** `wp_add_privacy_policy_content( $plugin_name, $policy_text )` on `admin_init`.

- Use `$page` parameter and `'done' => false` for large datasets.

---

## 10. Theme Modification API

```php
set_theme_mod( $name, $value )
get_theme_mod( $name, $default )
remove_theme_mod( $name )
get_theme_mods()
```

| Feature             | `theme_mod`                      | `option`                   |
|---------------------|----------------------------------|----------------------------|
| Scope               | Per-theme                        | Global (all themes)        |
| Switching themes    | Reverts to new theme's values    | Persists                   |
| Storage             | Single `theme_mods_{$theme}` row | Individual option rows     |
| Customizer default  | Yes (`type => 'theme_mod'`)      | Must set `type => 'option'`|
| Filter              | `theme_mod_{$name}`              | `option_{$name}`           |

Use `theme_mod` for visual/display settings. Use `option` for functional plugin settings.

---

## 11. Site Health API

**Custom tab:** filter `site_health_navigation_tabs`, action `site_health_tab_content`.

**Custom status test:** filter `site_status_tests` with `$tests['direct']['key'] = array( 'label' => ..., 'test' => $callback )`.

Test callback returns: `label`, `status` (good | recommended | critical), `badge` (label + color), `description`, `actions`, `test`.

**Debug info:** filter `debug_information` to add fields under `$info['plugin-slug']['fields']`.

---

## 12. Global Variables

### Inside the Loop

| Variable        | Type       | Description                              |
|-----------------|------------|------------------------------------------|
| `$post`         | `WP_Post`  | Current post being processed             |
| `$authordata`   | `WP_User`  | Current post's author                    |
| `$page`         | `int`      | Current page of a paginated post         |
| `$multipage`    | `bool`     | Whether post has `<!--nextpage-->` splits|
| `$numpages`     | `int`      | Total pages in paginated post            |
| `$more`         | `bool`     | Whether to show content past `<!--more-->`|

### Core Objects

| Variable          | Type          | Preferred API                          |
|-------------------|---------------|----------------------------------------|
| `$wpdb`           | `wpdb`        | No alternative -- use directly         |
| `$wp_query`       | `WP_Query`    | Template tags: `have_posts()`, `the_post()` |
| `$wp_rewrite`     | `WP_Rewrite`  | `get_option('permalink_structure')`    |
| `$wp_roles`       | `WP_Roles`    | `wp_roles()`, `current_user_can()`     |
| `$wp_admin_bar`   | `WP_Admin_Bar`| `add_action('admin_bar_menu', ...)`    |
| `$wp_locale`      | `WP_Locale`   | `wp_date()`, `date_i18n()`            |

### Admin & Version

| Variable          | Type     | Description                            |
|-------------------|----------|----------------------------------------|
| `$pagenow`        | `string` | Current admin page filename            |
| `$post_type`      | `string` | Current post type in admin screens     |
| `$wp_version`     | `string` | WordPress version number               |
| `$wp_db_version`  | `int`    | Database schema version                |

### Server Detection

| Variable      | Type   | True when...        |
|---------------|--------|---------------------|
| `$is_apache`  | `bool` | Running on Apache   |
| `$is_nginx`   | `bool` | Running on Nginx    |
| `$is_IIS`     | `bool` | Running on IIS      |

### Best Practices

- **Use API functions first** -- `get_queried_object()` instead of `global $wp_query; $wp_query->get_queried_object()`.
- **Always declare `global`** before use: `global $wpdb;`
- **Never modify** `$post` without `wp_reset_postdata()` afterward.
- **`$wpdb` is the exception** -- it has no wrapper and must be used directly for custom queries.

---

## 13. Responsive Images

```php
wp_get_attachment_image( $attachment_id, $size )           // Full <img> with srcset/sizes.
wp_get_attachment_image_srcset( $attachment_id, $size )    // Just srcset string.
wp_get_attachment_image_sizes( $attachment_id, $size )     // Just sizes string.
add_image_size( $name, $width, $height, $crop )            // Register custom size.
```

**Filters:**
- `wp_calculate_image_sizes` -- override `sizes` attribute for your layout.
- `wp_calculate_image_srcset` -- modify source list (e.g., remove oversized sources).
- `max_srcset_image_width` -- cap max width in srcset (default 2048px).

WordPress 5.5+ adds `loading="lazy"` automatically. Pass `'loading' => 'eager'` for above-the-fold images.

---

## 14. Advanced Hooks

```php
remove_action( $hook, $callback, $priority )
remove_filter( $hook, $callback, $priority )
do_action( $hook, ...$args )       // Fire a custom action.
apply_filters( $hook, $value, ...$args )  // Fire a custom filter.
```

| Function             | Returns                                          |
|----------------------|--------------------------------------------------|
| `did_action()`       | Number of times an action has fired (int).       |
| `doing_action()`     | Whether a specific action is currently running.  |
| `doing_filter()`     | Whether a specific filter is currently running.  |
| `current_action()`   | Name of the action currently being executed.     |
| `current_filter()`   | Name of the current filter (works for actions).  |
| `has_action()`       | Whether a callback is registered for an action.  |
| `has_filter()`       | Whether a callback is registered for a filter.   |

**Rules:**
- Removal must happen after the original `add_action()` and at the same priority.
- Use `did_action() > 1` guard to prevent recursive triggers in `save_post`.
- Prefix all custom hook names. Document with `@since`/`@param`. Never change signatures after release.

---

## 15. Common Mistakes

| Mistake | Fix |
|---------|-----|
| Flushing rewrite rules on every request | Only flush on activation: `register_activation_hook` + `flush_rewrite_rules()` |
| Registering CPTs/taxonomies in `admin_init` | Use `init` -- they must be available on the frontend too |
| `echo` inside a shortcode handler | Always `return` the HTML string |
| Saving meta without nonce/capability check | Verify nonce, check `DOING_AUTOSAVE`, check `current_user_can()` |
| Scheduling cron without `wp_next_scheduled()` guard | Always check first or you create duplicate events |
| Not cleaning up cron on deactivation | `wp_unschedule_event()` in `register_deactivation_hook` |
| Using `$wpdb->query()` for HTTP API work | Use `wp_remote_get()` / `wp_remote_post()` |
| Disabling `sslverify` in production | Only disable for local development; never in production |
| Adding roles/caps on every page load | Roles persist in DB -- add on activation, remove on uninstall |
| Forgetting `show_in_rest => true` on CPTs | Required for Block Editor and REST API access |
| Not paginating privacy exporters/erasers | Set `done => false` and use `$page` parameter |
| Calling `remove_action()` too early | Must run after the original `add_action()` and match priority |
| Using `get_option()` for theme-specific settings | Use `get_theme_mod()` -- values travel with the theme |
| Modifying `$post` global without reset | Always call `wp_reset_postdata()` after custom loops |
| Hardcoding image sizes in `srcset` | Use `wp_calculate_image_srcset` filter instead |
| CPT slug matches a page slug | Individual CPT posts 404 -- use a different rewrite slug or rename the page |
| `add_action('save_post', $fn)` but handler expects 3 args | Default is 1 arg -- pass `10, 3` to receive `($post_id, $post, $update)` |
| Filters that `echo` instead of `return` | Filter callbacks MUST return the modified value; echoing corrupts output |

---

## Resources

- [resources/menus-shortcodes-metaboxes.md](resources/menus-shortcodes-metaboxes.md) -- Full code examples for admin menus, shortcodes, and meta boxes
- [resources/cpt-http-cron.md](resources/cpt-http-cron.md) -- Full code examples for custom post types, HTTP API, and WP-Cron
- [resources/widgets-users-privacy.md](resources/widgets-users-privacy.md) -- Full code examples for dashboard widgets, users/roles, and privacy API
- [resources/theme-health-images-hooks.md](resources/theme-health-images-hooks.md) -- Full code examples for theme mods, Site Health, responsive images, and advanced hooks
