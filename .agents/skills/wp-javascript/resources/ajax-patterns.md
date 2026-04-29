# AJAX Patterns — Full Code Examples

Complete PHP handler and jQuery client examples for WordPress AJAX via `admin-ajax.php`.

## PHP Handler (Server Side)

```php
// Logged-in users.
add_action( 'wp_ajax_map_load_posts', 'map_ajax_load_posts' );
// Non-logged-in users (public endpoints).
add_action( 'wp_ajax_nopriv_map_load_posts', 'map_ajax_load_posts' );

function map_ajax_load_posts(): void {
    // 1. Verify nonce.
    check_ajax_referer( 'map_ajax_nonce', 'nonce' );

    // 2. Check capability (if needed).
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Unauthorized.' ), 403 );
    }

    // 3. Sanitize input.
    $page     = absint( $_POST['page'] ?? 1 );
    $category = sanitize_text_field( wp_unslash( $_POST['category'] ?? '' ) );

    // 4. Query data.
    $query = new WP_Query( array(
        'post_type'      => 'post',
        'posts_per_page' => 10,
        'paged'          => $page,
        'category_name'  => $category,
    ) );

    $posts = array();
    while ( $query->have_posts() ) {
        $query->the_post();
        $posts[] = array(
            'id'    => get_the_ID(),
            'title' => get_the_title(),
            'url'   => get_permalink(),
        );
    }
    wp_reset_postdata();

    // 5. Send JSON response.
    wp_send_json_success( array(
        'posts'    => $posts,
        'hasMore'  => $page < $query->max_num_pages,
    ) );
}
```

## JavaScript (Client Side)

```js
( function( $ ) {
    var page = 1;

    $( '#map-load-more' ).on( 'click', function() {
        var $btn = $( this );
        $btn.prop( 'disabled', true ).text( mapAjax.i18n.loading );

        $.post( mapAjax.ajaxUrl, {
            action:   'map_load_posts',
            nonce:    mapAjax.nonce,
            page:     ++page,
            category: $( '#map-category' ).val()
        } )
        .done( function( response ) {
            if ( response.success ) {
                $.each( response.data.posts, function( i, post ) {
                    $( '#map-posts' ).append(
                        '<li><a href="' + post.url + '">' + post.title + '</a></li>'
                    );
                } );
                if ( ! response.data.hasMore ) {
                    $btn.remove();
                }
            }
        } )
        .fail( function() {
            alert( mapAjax.i18n.error );
        } )
        .always( function() {
            $btn.prop( 'disabled', false ).text( 'Load More' );
        } );
    } );
} )( jQuery );
```
