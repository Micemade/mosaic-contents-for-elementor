# Mosaic Product Layouts Reference

## Overview

The `mosaic-product-layouts` plugin (Gutenberg blocks version) provides reference patterns for:
- WooCommerce Store API fetching
- Custom REST API endpoints for editor controls
- React hooks for async product selection

## WC Store API Pattern

### Fetching Products (Public, No Auth)

```javascript
// Path: /wc/store/v1/products
const fetchProducts = async (querySettings) => {
    const { per_page, orderby, order, category, on_sale, featured } = querySettings;
    
    const params = new URLSearchParams();
    if (per_page) params.append('per_page', per_page);
    if (orderby) params.append('orderby', orderby);
    if (order) params.append('order', order);
    if (category) params.append('category', category);
    if (on_sale) params.append('on_sale', 'true');
    if (featured) params.append('featured', 'true');
    
    // Optimize response size with _fields
    params.append('_fields', 'id,name,short_description,price_html,images,permalink,add_to_cart,type,average_rating,review_count,on_sale');
    
    const response = await fetch(`/wp-json/wc/store/v1/products?${params}`);
    return response.json();
};
```

### Key File: `src/shared/utils/apiFetchQuery.js`

Full implementation with:
- Category/brand filtering
- Ordering (date, price, popularity, rating)
- Single product vs. multiple products
- camelCase key conversion

## Custom REST Endpoints

### File: `includes/RestAPI.php`

Lightweight endpoints for editor controls (requires `edit_posts` capability):

| Endpoint | Purpose |
|----------|---------|
| `/mosaic-layouts/v1/products` | Product selection (id, title, mediaId) |
| `/mosaic-layouts/v1/categories` | Category selection |
| `/mosaic-layouts/v1/brands` | Brand selection (if taxonomy exists) |

### Query Parameters

- `search` - Search term filter
- `per_page` - Results limit (default: 50)

## React Hooks

### `useAsyncSelect` (src/shared/hooks/useAsyncSelect.js)

Async select with debouncing for large catalogs:
- Initial load: 50 recent items
- Search: Triggers after 2+ chars, 300ms debounce
- Integrates with react-select AsyncSelect component

### `useProductsData` (src/shared/hooks/useProductsData.js)

Combines async select with media fetching for thumbnails.

## Add to Cart Pattern

### File: `src/shared/utils/AddToCartPost.js`

```javascript
import apiFetch from '@wordpress/api-fetch';

const addToCartPost = (event, productId) => {
    apiFetch({
        path: '/wc/store/v1/cart/add-item',
        method: 'POST',
        data: { id: productId, quantity: 1 },
        headers: {
            'Nonce': window.mosaicProductLayouts?.nonce
        }
    });
};
```

**Note:** Nonce is created via PHP `wp_create_nonce('wc_store_api')` and localized.

## Block Attributes Pattern

### File: `src/micemade-products-grid/block.json`

```json
{
    "querySettings": {
        "type": "object",
        "default": {
            "handPicked": false,
            "ordering": "date/desc",
            "per_page": "10",
            "category": [],
            "brand": []
        }
    },
    "handpickedWcItems": {
        "type": "array",
        "default": []
    }
}
```

## Elementor Adaptation

When adapting these patterns for Elementor:

1. **Controls** → Use Elementor Controls_Manager (SELECT, NUMBER, SWITCHER)
2. **Data Flow** → Pass settings via `content_template()` hidden input
3. **Fetching** → Use native `fetch()` instead of `@wordpress/api-fetch`
4. **No nonce needed** → WC Store API product endpoints are public

## GridLayout Component (react-grid-layout)

### Key Files

- **Source**: `src/shared/GridLayout.js` (mosaic-product-layouts)
- **Elementor version**: `src/components/GridLayout.jsx` (this plugin)

### Dependencies

```bash
npm install react-grid-layout react-sizeme
```

### Breakpoints

| Version | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Gutenberg | 920px+ | 780-920px | <400px |
| Elementor | 1025px+ | 768-1024px | <768px |

### Elementor-adapted GridLayout

```jsx
import { Responsive as RGL } from 'react-grid-layout';
import { withSize } from 'react-sizeme';

const ELEMENTOR_BREAKPOINTS = {
    desktop: 1025,
    tablet: 768,
    mobile: 0,
};

function GridLayout(props) {
    const { layouts, columns, itemsMargin, rowHeight, children } = props;
    
    return (
        <RGL
            breakpoints={ELEMENTOR_BREAKPOINTS}
            cols={{ desktop: 12, tablet: 8, mobile: 4 }}
            layouts={layouts}
            margin={[itemsMargin, itemsMargin]}
            rowHeight={rowHeight}
            isDraggable={false}  // Frontend only
            isResizable={false}
        >
            {children}
        </RGL>
    );
}

export default withSize()(GridLayout);
```

### Layout Generation

Generate layouts dynamically based on product count:

```jsx
function generateLayouts(productCount, gridSettings) {
    const layouts = { desktop: [], tablet: [], mobile: [] };
    
    for (let i = 0; i < productCount; i++) {
        layouts.desktop.push({
            i: `product-${i}`,
            x: (i % 3) * 4,  // 3 columns, each 4 units wide (12/3)
            y: Math.floor(i / 3) * 20,
            w: 4,
            h: 20,
        });
        // Similar for tablet and mobile...
    }
    
    return layouts;
}
```

