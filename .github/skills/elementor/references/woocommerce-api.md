# WooCommerce API Reference

## Official Documentation

- **REST API Docs**: https://woocommerce.github.io/woocommerce-rest-api-docs/
- **WooCommerce Developer Resources**: https://developer.woocommerce.com/

## REST API Endpoints

### Products
```
GET /wp-json/wc/v3/products
GET /wp-json/wc/v3/products/{id}
GET /wp-json/wc/v3/products/categories
GET /wp-json/wc/v3/products/tags
```

### Orders
```
GET /wp-json/wc/v3/orders
GET /wp-json/wc/v3/orders/{id}
```

### Customers
```
GET /wp-json/wc/v3/customers
GET /wp-json/wc/v3/customers/{id}
```

## Common Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `per_page` | Results per page | `?per_page=12` |
| `page` | Page number | `?page=2` |
| `category` | Filter by category ID | `?category=15` |
| `tag` | Filter by tag ID | `?tag=20` |
| `status` | Product status | `?status=publish` |
| `featured` | Featured products only | `?featured=true` |
| `on_sale` | On sale products only | `?on_sale=true` |
| `orderby` | Sort field | `?orderby=popularity` |
| `order` | Sort direction | `?order=desc` |

### Orderby Options
- `date` - Sort by date
- `id` - Sort by ID
- `title` - Sort by title
- `slug` - Sort by slug
- `price` - Sort by price
- `popularity` - Sort by popularity (sales)
- `rating` - Sort by average rating

## Authentication

WooCommerce REST API requires authentication:

### Consumer Key & Secret
```javascript
const consumerKey = 'ck_xxxxxxxxxxxx';
const consumerSecret = 'cs_xxxxxxxxxxxx';
const credentials = btoa(`${consumerKey}:${consumerSecret}`);

fetch('/wp-json/wc/v3/products', {
    headers: { 'Authorization': `Basic ${credentials}` }
});
```

### For Frontend (Public Products)

Use the Store API (no auth needed for public data):
```
GET /wp-json/wc/store/v1/products
GET /wp-json/wc/store/v1/products/{id}
GET /wp-json/wc/store/v1/cart
```

## Example: Fetch Products in React

```javascript
const fetchProducts = async (options = {}) => {
    const params = new URLSearchParams({
        per_page: options.perPage || 12,
        category: options.category || '',
        orderby: options.orderby || 'date',
        order: options.order || 'desc',
    });
    
    // Remove empty params
    [...params.entries()].forEach(([key, value]) => {
        if (!value) params.delete(key);
    });
    
    const response = await fetch(`/wp-json/wc/store/v1/products?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};
```

## Product Object Structure

```javascript
{
    id: 123,
    name: "Product Name",
    slug: "product-name",
    permalink: "https://example.com/product/product-name",
    prices: {
        price: "1999",           // Price in cents
        regular_price: "2499",
        sale_price: "1999",
        currency_code: "USD"
    },
    images: [
        {
            id: 456,
            src: "https://example.com/image.jpg",
            alt: "Image alt text"
        }
    ],
    categories: [{ id: 15, name: "Category", slug: "category" }],
    tags: [{ id: 20, name: "Tag", slug: "tag" }],
    attributes: [...],
    variations: [...],
    stock_status: "instock",
    average_rating: "4.5",
    review_count: 12
}
```

## PHP Hooks for Custom Endpoints

```php
// Register custom REST endpoint
add_action('rest_api_init', function() {
    register_rest_route('myplugin/v1', '/featured-products', [
        'methods' => 'GET',
        'callback' => 'get_featured_products',
        'permission_callback' => '__return_true',
    ]);
});

function get_featured_products($request) {
    $args = [
        'post_type' => 'product',
        'posts_per_page' => 12,
        'tax_query' => [[
            'taxonomy' => 'product_visibility',
            'field' => 'name',
            'terms' => 'featured',
        ]],
    ];
    
    $products = wc_get_products($args);
    return rest_ensure_response($products);
}
```
