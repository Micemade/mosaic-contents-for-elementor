=== Mosaic Contents for Elementor ===
Contributors: micemade
Tags: elementor, posts, custom post types, content grid, free-form layout
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 8.0
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free-form, grid-based content layouts for Elementor — for posts, custom post types, and any Elementor widget.

== Description ==

Mosaic Contents for Elementor (MC4E) adds two Elementor widgets under the **Mosaic Contents** category. Both are built on a free-form grid layout engine: instead of being constrained by classic HTML layout models (flexbox, CSS grid, columns), you place and size items freely on an underlying snap grid.

* **Content Layout** - query posts or any custom post type and arrange the results as cards in a free-form grid.
* **Widgets Layout** - turn each grid cell into a drop zone for any Elementor widget (headings, images, buttons, Containers, and more), so you can compose free-form sections from native, editable Elementor elements.

== Key capabilities: ==

* Free-form drag-and-resize editing directly inside Elementor, with an underlying snap grid.
* Separate desktop, tablet, and mobile layouts (stored per breakpoint) - each view layout can be unique!
* Editor-friendly React-powered rendering with two-way Elementor settings sync.
* Content Layout: works with any post type and its taxonomies; per-element visibility and ordering; style presets; predefined layouts; saved setups. Content is fetched via the WordPress REST API.
* Widgets Layout: multiple native widgets per cell; nested Containers; drag widgets between cells; per-cell styling (global Cell Style plus a per-cell repeater with automatic cell-to-item sync).

= Content Layout widget =

Query settings for post type, taxonomy and terms, order, sticky posts, pagination, and custom post-meta fields. Style options include card text, layout, image display and focal point, colors, borders, and reusable style presets, plus element order and visibility controls.

= Widgets Layout widget =

Drop any Elementor widget onto a cell (or use the cell's add icon), stack multiple widgets per cell, and nest Containers/Grid/Flexbox with inner widgets. Cells can be dragged, resized, and stacked (z-index); widgets can be reordered within a cell or moved between cells. Each cell can be styled individually via a per-cell repeater (background, padding, text and links color, overlay color, horizontal and vertical alignment, border, radius, and box shadow), with empty fields falling back to the global Cell Style.

== Installation ==

First and foremost, make sure that Elementor plugin is installed and active.

1. In WordPress Admin Dashboard:
	* Go to "Plugins" &rarr; "Add New" and search for "Mosaic Contents for Elementor". Once found, click "Install".
	* When the installation is done, click on "Activate" button.

2. Manually
	* Download the zipped plugin from the wordpress.org or github.com
	* Unzip the plugin folder to `/wp-content/plugins/`.
	* Activate the plugin from the WordPress Plugins screen.

Now you can edit a page with Elementor and add the Content Layout or Widgets Layout widget from the Mosaic Contents category.

== Documentation ==

For detailed instructions on using the MC4E widgets, consult the documentation in docs/index.html.

== Frequently Asked Questions ==

= Does this plugin require WooCommerce? =

No. Content Layout works with any public post type, so it can display WooCommerce products if that post type is selected, but the plugin does not depend on WooCommerce.

= Does this plugin require Elementor Pro? =

No. It works with the free Elementor, though your site may also run Elementor Pro.

= Are my drag-and-resize layout changes saved automatically? =

Layout changes are stored with the page only after you click Update or Publish in Elementor.

== Screenshots ==

1. Example of editor view, editing Widgets layout - creating free-form hero layout. Each box is a Widget Layout cell with nested Elementor widgets. Widgets are drag and dropped from widgets panel. Each cell has it's own properties, such as background (color, gradient, or image), overlay color, text and links color, padding etc.

2. Another example creation of hero section entirely made with Widgets layout, including the panel settings view with separate style controls for each Widgets Layout cells.

3. Using Content Layout widget, displaying latest posts. The Elementor settings panel shows Style presets, and more fine grained control over each element (post title, terms, Read more button, post author, etc.) styling bellow. Style prests and Predifend Layouts control can be used to fast create beautyfully designed post (or CPT) layouts.

4. Frontend view of Content Layout widget, displaying products post type, from selected product categories. Post and post types can be selected, with dynamically changed taxonomies for selected post type. The pagination view can be toggled on/off.

5. Creative and playful example of Widgets Layout - layout cells (boxes) can nest Elementor widgets, but also can be used as decorative elements, such as in this example.

=== Stay Connected ===

* [View/Contribute on GitHub](https://github.com/Micemade/mosaic-contents-for-elementor)
* [Follow on Twitter](https://twitter.com/theMicemade)
* [Visit the Micemade website](https://micemade.com)

== Changelog ==

= 0.1.0 =

* Initial release with the Content Layout and Widgets Layout widgets.

== License ==

This plugin is licensed under the GPLv2 or later.

The plugin uses, other than WordPress and React modules and packages, third party modules, licenced under MIT or MPL-2.0, GPL compatible licences, but heavily relies on:
* [React Grid Layout]https://github.com/react-grid-layout/react-grid-layout

== Feedback ==

If you would like to have more features to this block, please suggest them in the Support section. This also applies to pointing out to bugs, or UI/UX improvements. Bugfixes or improvements will be added to the plugin.

Thank you for using Mosaic Contents for Elementor!
