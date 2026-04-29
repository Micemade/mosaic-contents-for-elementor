# SQL Injection Prevention — Detailed Examples

## Basic `prepare()` Usage

```php
// BAD: interpolated variable
$results = $wpdb->get_results( "SELECT * FROM $wpdb->posts WHERE post_author = $user_id" );

// BAD: quoted placeholder
$wpdb->prepare( "SELECT * FROM $wpdb->posts WHERE ID = '%d'", $id );

// GOOD: prepare with unquoted placeholder
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM %i WHERE post_author = %d AND post_status = %s",
        $wpdb->posts,
        $user_id,
        'publish'
    )
);

// GOOD: LIKE query with esc_like
$like = '%' . $wpdb->esc_like( $search_term ) . '%';
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM $wpdb->posts WHERE post_title LIKE %s",
        $like
    )
);
```

## Common `prepare()` Mistakes

```php
// ❌ Table name in placeholder — adds quotes around table name, breaks query.
$wpdb->prepare( "SELECT * FROM %s WHERE id = %d", $wpdb->prefix . 'my_table', $id );
// Result: SELECT * FROM 'wp_my_table' WHERE id = 1  ← quoted table name fails

// ✅ Interpolate table name directly, prepare only values.
$table = $wpdb->prefix . 'my_table';
$wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ) );
// Or use %i (WP 6.2+): $wpdb->prepare( "SELECT * FROM %i WHERE id = %d", $table, $id );

// ❌ prepare() with no placeholders — triggers error.
$wpdb->prepare( "SELECT * FROM {$wpdb->posts}" );

// ✅ Don't use prepare() if there's no dynamic data.
$wpdb->get_results( "SELECT * FROM {$wpdb->posts}" );

// ❌ Mixing individual args and array.
$wpdb->prepare( "WHERE id = %d AND name = %s", $id, array( $name ) );

// ✅ Pick one format.
$wpdb->prepare( "WHERE id = %d AND name = %s", $id, $name );
```
