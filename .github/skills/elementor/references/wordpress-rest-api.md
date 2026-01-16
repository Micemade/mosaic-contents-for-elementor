# WordPress REST API Reference

## Official Documentation

- **REST API Handbook**: https://developer.wordpress.org/rest-api/
- **Reference Guide**: https://developer.wordpress.org/rest-api/reference/

## Common Endpoints

### Posts
```
GET /wp-json/wp/v2/posts
GET /wp-json/wp/v2/posts/{id}
```

### Pages
```
GET /wp-json/wp/v2/pages
GET /wp-json/wp/v2/pages/{id}
```

### Media
```
GET /wp-json/wp/v2/media
POST /wp-json/wp/v2/media
```

### Categories & Tags
```
GET /wp-json/wp/v2/categories
GET /wp-json/wp/v2/tags
```

## Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `per_page` | Results per page (max 100) | `?per_page=10` |
| `page` | Page number | `?page=2` |
| `_fields` | Limit response fields | `?_fields=id,title,excerpt` |
| `orderby` | Sort field | `?orderby=date` |
| `order` | Sort direction | `?order=desc` |
| `search` | Search term | `?search=keyword` |
| `categories` | Filter by category IDs | `?categories=1,2,3` |
| `tags` | Filter by tag IDs | `?tags=5,6` |

## Authentication

For public endpoints, no authentication needed. For protected endpoints:

### Application Passwords (WordPress 5.6+)
```javascript
const credentials = btoa('username:application_password');
fetch('/wp-json/wp/v2/posts', {
    headers: { 'Authorization': `Basic ${credentials}` }
});
```

### Nonce (for logged-in users)
```javascript
fetch('/wp-json/wp/v2/posts', {
    headers: { 'X-WP-Nonce': wpApiSettings.nonce }
});
```

## Example: Fetch Posts in React

```javascript
const fetchPosts = async () => {
    const response = await fetch(
        '/wp-json/wp/v2/posts?_fields=id,title,excerpt,featured_media&per_page=10'
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};
```
