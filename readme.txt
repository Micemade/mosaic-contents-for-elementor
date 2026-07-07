=== Mosaic Contents for Elementor ===
Contributors: micemade
Tags: elementor, posts, custom post types, content grid, free-form layout
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.0
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free-form, grid-based content layouts for Elementor — for posts, custom post types, and any Elementor widget.

== Description ==

Mosaic Contents for Elementor (MC4E) adds two Elementor widgets under the **Mosaic Contents** category. Both are built on a free-form grid layout engine: instead of being constrained by classic HTML layout models (flexbox, CSS grid, columns), you place and size items freely on an underlying snap grid.

* **Content Layout** - query posts or any custom post type and arrange the results as cards in a free-form grid.
* **Widgets Layout** - turn each grid cell into a drop zone for any Elementor widget (headings, images, buttons, Containers, and more), so you can compose free-form sections from native, editable Elementor elements.

Key capabilities:

* Free-form drag-and-resize editing directly inside Elementor, with an underlying snap grid.
* Separate desktop, tablet, and mobile layouts (stored per breakpoint).
* Editor-friendly React-powered rendering with two-way Elementor settings sync.
* Content Layout: works with any post type and its taxonomies; per-element visibility and ordering; style presets; saved setups. Content is fetched via the WordPress REST API.
* Widgets Layout: multiple native widgets per cell; nested Containers; drag widgets between cells; per-cell styling (global Cell Style plus a per-cell repeater with automatic cell-to-item sync).

= Content Layout widget =

Query settings for post type, taxonomy and terms, order, sticky posts, pagination, and custom post-meta fields. Style options include card text, layout, image display and focal point, colors, borders, and reusable style presets, plus element order and visibility controls.

= Widgets Layout widget =

Drop any Elementor widget onto a cell (or use the cell's add icon), stack multiple widgets per cell, and nest Containers/Grid/Flexbox with inner widgets. Cells can be dragged, resized, and stacked (z-index); widgets can be reordered within a cell or moved between cells. Each cell can be styled individually via a per-cell repeater (background, padding, text and links color, overlay color, horizontal and vertical alignment, border, radius, and box shadow), with empty fields falling back to the global Cell Style.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`.
2. Activate the plugin from the WordPress Plugins screen.
3. Ensure Elementor is installed and active.
4. Edit a page with Elementor and add the Content Layout or Widgets Layout widget from the Mosaic Contents category.

== Documentation ==

For detailed instructions on using the MC4E widgets, consult the documentation in docs/index.html.

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

No. Content Layout works with any public post type, so it can display WooCommerce products if that post type is selected, but the plugin does not depend on WooCommerce.

= Does this plugin require Elementor Pro? =

No. It works with the free Elementor, though your site may also run Elementor Pro.

= Are my drag-and-resize layout changes saved automatically? =

Layout changes are stored with the page only after you click Update or Publish in Elementor.

== Changelog ==

= 0.1.0 =

* Initial release with the Content Layout and Widgets Layout widgets.

== License ==

This plugin is licensed under the GPLv2 or later.
