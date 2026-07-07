# Mosaic Contents for Elementor

Free-form, grid-based content layouts for Elementor — for posts, custom post types, and any Elementor widget.

## Description

Mosaic Contents for Elementor adds two Elementor widgets under the **Mosaic Contents** category. Both are
built on a free-form **grid layout** engine (react-grid-layout): instead of being constrained by classic HTML
layout models (flexbox, CSS grid, columns), you place and size items freely on an underlying snap grid.

* **Content Layout** — query posts or any custom post type and arrange the results as cards in a free-form grid.
* **Widgets Layout** — turn each grid cell into a drop zone for any Elementor widget (headings, images, buttons,
  Containers, etc.), so you can compose free-form sections from native, editable Elementor elements.

Key capabilities:

* Free-form drag-and-resize editing directly inside Elementor, with an underlying snap grid.
* Separate desktop, tablet, and mobile layouts (stored per breakpoint).
* React-powered editor rendering with two-way Elementor ↔ React settings sync.
* **Content Layout**: any post type + taxonomy filtering, per-element visibility/ordering, style presets, and
  saved setups. Content is fetched via the WordPress REST API.
* **Widgets Layout**: multiple native widgets per cell, nested Containers, drag widgets between cells, and
  per-cell styling (global Cell Style + a per-cell repeater with automatic cell↔item sync).

## Installation

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin from the WordPress Plugins screen.
3. Ensure Elementor is installed and active.
4. Edit a page with Elementor and add the **Content Layout** or **Widgets Layout** widget from the
   **Mosaic Contents** category.

## Development

Build tooling is Vite. Common commands:

* `npm install`
* `npm run watch` — rebuild the frontend bundle on change
* `npm run watch:editor` — rebuild the editor bundle on change
* `npm run watch:all` — rebuild all bundles/controls on change
* `npm run build` — build all bundles (frontend, editor, and the custom controls)
* `npm run build:prod` — production build without sourcemaps
* `npm run lint`

> There is no HMR inside the Elementor editor iframe; refresh the editor after a rebuild.

## Requirements

* WordPress 6.0+
* PHP 7.0+
* Elementor (Elementor Pro is not required)

WooCommerce is not required. Content Layout can display WooCommerce products if that post type is selected, but
it does not depend on WooCommerce.

## Frequently Asked Questions

### Does this plugin require Elementor Pro?

No. It works with the free Elementor, though your site may also run Elementor Pro.

## Changelog

### 0.1.0

* Initial release with the Content Layout and Widgets Layout widgets.

## License

This plugin is licensed under the GPLv2 or later.
