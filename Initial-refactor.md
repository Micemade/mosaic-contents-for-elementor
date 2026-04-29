# Refactor Mosaic Product Layouts for Elementor

## Main task
Refactoring existing codebase, which is essentially a WordPress Elementor/WooCommerce plugin (add-on), to change the focus from WooCommerce-oriented displaying of content to general purpose content layout creation.
The plugin should use the existing functionality regarding the settings, layout, and styling methods and logic.
The 'product' post type should be replaced with option to choose any of registered WordPress post (content) types.

## Specific tasks
- Rename all the Mosaic Product Layouts for Elementor to Mosaic Contents for Elementor, including all variants (like localization domain, abbreviations like mc4e)
- Remove the 'categories-layout' and 'single-product-layout' widgets from the plugin, as well as those two widgets-specific (not shared with 'content-layout' widget) methods, helpers, or any directly related and by removal redundant code.
- Use the 'content-layout' widget to replace a 'product' post type with a selection of registered post types
- Query settings should be changed from product-specific options (onSale, featured) to post type arguments.
- For fetching post types, replace the Store API with WordPress Rest API, both for editor, and for frontend
- Widget registry and all the current arcitecture should be un-altered, in case of possible expansion of plugin with additional widgets.

## Considerations
- all the existing layout creation ans styling options should remain as is, but adapted to new post type data
- for any important codebase change, ask aditional or clarifying questions
- don't delete product-select.php, product-select.jsx, and class-rest-api.php as it may be needed for future implementations.
- use class-rest-api.php for Rest API functionalities for eventual fetching optimizations or caching
- create a system for displaying post meta with key value conditional pair display in content card (previously product card)
