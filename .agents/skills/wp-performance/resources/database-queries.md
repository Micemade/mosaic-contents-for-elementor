# Database & WP_Query Code Examples

Detailed code examples for Section 1 of the [wp-performance skill](../SKILL.md).

---

## Unbounded Queries (CRITICAL)

```php
// BAD: Returns ALL posts. OOM on large sites.
$query = new WP_Query( array(
    'post_type'      => 'post',
    'posts_per_page' => -1,
) );

// GOOD: Always set limits.
$query = new WP_Query( array(
    'post_type'      => 'post',
    'posts_per_page' => 100,
    'no_found_rows'  => true,
) );
```

---

## Never Use query_posts() (CRITICAL)

```php
// BAD: Replaces main query, breaks pagination and conditionals.
query_posts( 'cat=1&posts_per_page=5' );

// GOOD: Modify main query with pre_get_posts.
add_action( 'pre_get_posts', function( $query ) {
    if ( ! is_admin() && $query->is_main_query() && $query->is_home() ) {
        $query->set( 'posts_per_page', 5 );
        $query->set( 'cat', 1 );
    }
} );

// GOOD: Use WP_Query for secondary queries.
$custom = new WP_Query( array( 'cat' => 1, 'posts_per_page' => 5 ) );
```

---

## Validate IDs Before Querying (CRITICAL)

```php
// BAD: If $post_id is false/null, intval() returns 0, removing WHERE clause.
$query = new WP_Query( array( 'p' => intval( $maybe_false_id ) ) );

// GOOD: Validate first.
if ( ! empty( $maybe_false_id ) ) {
    $query = new WP_Query( array( 'p' => intval( $maybe_false_id ) ) );
}
```

---

## LIKE with Leading Wildcards (WARNING)

```php
// BAD: Full table scan, indexes cannot help.
$wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM {$wpdb->posts} WHERE post_title LIKE %s", '%search%'
) );

// GOOD: Trailing wildcard only.
$wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM {$wpdb->posts} WHERE post_title LIKE %s",
    $wpdb->esc_like( $term ) . '%'
) );
```

---

## NOT IN Subqueries (WARNING)

```php
// BAD: Slow with large exclusion lists.
'post__not_in' => $hundreds_of_ids

// GOOD: Fetch extra, filter in PHP.
$query = new WP_Query( array(
    'posts_per_page' => 10 + count( $excluded ),
    'no_found_rows'  => true,
) );
$count = 0;
while ( $query->have_posts() && $count < 10 ) {
    $query->the_post();
    if ( in_array( get_the_ID(), $excluded, true ) ) { continue; }
    // Process post.
    $count++;
}
wp_reset_postdata();
```

---

## Meta Query Optimization (WARNING)

```php
// BAD: meta_value is not indexed; full table scan.
'meta_query' => array( array( 'key' => 'color', 'value' => 'red' ) )

// GOOD: Use taxonomy for filterable attributes.
'tax_query' => array( array(
    'taxonomy' => 'color', 'field' => 'slug', 'terms' => 'red'
) )

// GOOD: For boolean flags, use key EXISTS (indexed on meta_key).
'meta_key' => 'is_featured', 'meta_compare' => 'EXISTS'
```

---

## N+1 Query Problem (CRITICAL)

```php
// BAD: 1 query per post in the loop.
while ( have_posts() ) {
    the_post();
    $meta = get_post_meta( get_the_ID(), 'views', true ); // Query each time!
}

// GOOD: Prime caches before the loop.
$post_ids = wp_list_pluck( $query->posts, 'ID' );
update_postmeta_cache( $post_ids );        // Single query for all meta.
update_object_term_cache( $post_ids, 'post' ); // Single query for all terms.
cache_users( wp_list_pluck( $query->posts, 'post_author' ) );

while ( have_posts() ) {
    the_post();
    $meta = get_post_meta( get_the_ID(), 'views', true ); // Served from cache.
}
```

---

## Date-Limiting Queries

```php
// GOOD: Limit to recent content on mature sites.
$query = new WP_Query( array(
    'category_name'  => 'news',
    'posts_per_page' => 10,
    'date_query'     => array( array( 'after' => '3 months ago' ) ),
) );
```

---

## Optimized Query Patterns

```php
// Check if posts exist (minimal work).
$query = new WP_Query( array(
    'post_type'              => 'product',
    'posts_per_page'         => 1,
    'fields'                 => 'ids',
    'no_found_rows'          => true,
    'update_post_meta_cache' => false,
    'update_post_term_cache' => false,
) );
$has_products = $query->have_posts();
```
