# Block Themes: Detailed Code Reference

## Full theme.json Example

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {
    "color": {
      "palette": [
        { "slug": "primary", "color": "#1a1a2e", "name": "Primary" },
        { "slug": "secondary", "color": "#16213e", "name": "Secondary" },
        { "slug": "accent", "color": "#e94560", "name": "Accent" }
      ],
      "gradients": [],
      "custom": false,
      "defaultPalette": false
    },
    "typography": {
      "fontFamilies": [
        {
          "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "slug": "system",
          "name": "System"
        }
      ],
      "fontSizes": [
        { "slug": "small", "size": "0.875rem", "name": "Small" },
        { "slug": "medium", "size": "1rem", "name": "Medium" },
        { "slug": "large", "size": "1.5rem", "name": "Large" },
        { "slug": "x-large", "size": "2.25rem", "name": "Extra Large" }
      ],
      "lineHeight": true
    },
    "spacing": {
      "units": [ "px", "em", "rem", "vh", "vw", "%" ],
      "spacingSizes": [
        { "slug": "10", "size": "0.5rem", "name": "Small" },
        { "slug": "20", "size": "1rem", "name": "Medium" },
        { "slug": "30", "size": "1.5rem", "name": "Large" },
        { "slug": "40", "size": "2rem", "name": "Extra Large" }
      ]
    },
    "layout": {
      "contentSize": "720px",
      "wideSize": "1200px"
    },
    "border": {
      "color": true,
      "radius": true,
      "style": true,
      "width": true,
      "radiusSizes": [
        { "name": "Small", "slug": "small", "size": "4px" },
        { "name": "Medium", "slug": "medium", "size": "8px" },
        { "name": "Large", "slug": "large", "size": "16px" }
      ]
    }
  },
  "styles": {
    "color": {
      "background": "var(--wp--preset--color--primary)",
      "text": "#ffffff"
    },
    "typography": {
      "fontFamily": "var(--wp--preset--font-family--system)",
      "fontSize": "var(--wp--preset--font-size--medium)",
      "lineHeight": "1.6"
    },
    "spacing": {
      "blockGap": "1.5rem"
    },
    "elements": {
      "link": {
        "color": { "text": "var(--wp--preset--color--accent)" }
      },
      "heading": {
        "typography": { "fontWeight": "700" }
      },
      "button": {
        "color": {
          "background": "var(--wp--preset--color--accent)",
          "text": "#ffffff"
        },
        ":hover": {
          "color": { "background": "#d63851" }
        },
        ":focus": {
          "color": { "background": "#d63851" }
        }
      },
      "input": {
        "border": { "color": "#cccccc", "width": "1px", "radius": "4px" },
        "spacing": { "padding": { "top": "8px", "bottom": "8px", "left": "12px", "right": "12px" } }
      }
    },
    "blocks": {
      "core/paragraph": {
        "typography": { "lineHeight": "1.8" }
      },
      "core/heading": {
        "spacing": { "margin": { "top": "2rem", "bottom": "1rem" } }
      }
    }
  },
  "customTemplates": [
    { "name": "blank", "title": "Blank", "postTypes": [ "page" ] }
  ],
  "templateParts": [
    { "name": "header", "title": "Header", "area": "header" },
    { "name": "footer", "title": "Footer", "area": "footer" },
    { "name": "sidebar", "title": "Sidebar", "area": "uncategorized" }
  ]
}
```

## Templates

Templates use block markup in HTML files under `templates/`:

```html
<!-- templates/single.html -->
<!-- wp:template-part {"slug":"header","area":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
    <!-- wp:post-title {"level":1} /-->
    <!-- wp:post-featured-image /-->
    <!-- wp:post-content {"layout":{"type":"constrained"}} /-->
    <!-- wp:post-terms {"term":"category"} /-->
</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","area":"footer"} /-->
```

## Template Parts

Template parts live in `parts/` (not nested in subdirectories):

```html
<!-- parts/header.html -->
<!-- wp:group {"tagName":"header","layout":{"type":"constrained"}} -->
<header class="wp-block-group">
    <!-- wp:site-title /-->
    <!-- wp:navigation /-->
</header>
<!-- /wp:group -->
```

```html
<!-- parts/footer.html -->
<!-- wp:group {"tagName":"footer","layout":{"type":"constrained"}} -->
<footer class="wp-block-group">
    <!-- wp:paragraph {"align":"center"} -->
    <p class="has-text-align-center">Built with WordPress</p>
    <!-- /wp:paragraph -->
</footer>
<!-- /wp:group -->
```

## Patterns

Filesystem patterns in `patterns/*.php` are auto-registered via file-level docblock:

```php
<?php
/**
 * Title: Hero Section
 * Slug: my-theme/hero
 * Categories: featured
 * Keywords: hero, banner, header
 * Block Types: core/template-part/header
 * Post Types: page
 * Viewport Width: 1200
 */
?>
<!-- wp:cover {"overlayColor":"primary","minHeight":500,"align":"full"} -->
<div class="wp-block-cover alignfull" style="min-height:500px">
    <span class="wp-block-cover__background has-primary-background-color has-background-dim-100 has-background-dim"></span>
    <div class="wp-block-cover__inner-container">
        <!-- wp:heading {"textAlign":"center","level":1} -->
        <h1 class="has-text-align-center">Welcome</h1>
        <!-- /wp:heading -->
        <!-- wp:paragraph {"align":"center"} -->
        <p class="has-text-align-center">Your tagline here.</p>
        <!-- /wp:paragraph -->
    </div>
</div>
<!-- /wp:cover -->
```

To hide a pattern from the inserter, add `Inserter: no` to the docblock.

## Style Variations

JSON files under `styles/` that override settings and styles:

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "title": "Dark",
  "settings": {
    "color": {
      "palette": [
        { "slug": "primary", "color": "#0d1117", "name": "Primary" },
        { "slug": "accent", "color": "#58a6ff", "name": "Accent" }
      ]
    }
  },
  "styles": {
    "color": {
      "background": "var(--wp--preset--color--primary)",
      "text": "#e6edf3"
    }
  }
}
```

Once a user selects a variation, the choice is stored in the database. Changing the JSON file will not update what the user already selected.

## Template Hierarchy

The WordPress block theme template hierarchy follows the same lookup order as classic themes. Templates are resolved from `templates/` directory:

- **index.html** -- Ultimate fallback (required)
- **single.html** -- Single posts
- **single-{post-type}.html** -- Single custom post type
- **page.html** -- Pages
- **page-{slug}.html** -- Specific page by slug
- **archive.html** -- Archive pages
- **category-{slug}.html** -- Specific category archive
- **author.html** -- Author archive
- **search.html** -- Search results
- **404.html** -- Not found
- **home.html** -- Blog home (posts page)
- **front-page.html** -- Static front page
