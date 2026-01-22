/**
 * Settings Mappers
 * 
 * Extract and format widget settings from Elementor models.
 * Each widget type has its own mapper function.
 */

/**
 * Extract settings for Products Layout widget
 * 
 * @param {Object} model - Elementor widget model
 * @returns {Object} Formatted settings object
 */
export const mapProductsLayoutSettings = (model) => {
	const settings = model.get('settings');
	return {
		// WooCommerce query settings
		per_page: settings.get('per_page'),
		orderby: settings.get('orderby'),
		order: settings.get('order'),
		category: settings.get('category'),
		on_sale: settings.get('on_sale') === 'yes',
		featured: settings.get('featured') === 'yes',
		
		// Grid layout settings
		layout: settings.get('layout'),
		custom_layout: settings.get('custom_layout'),
		items_margin: settings.get('items_margin'),
		row_height: settings.get('row_height'),
		allow_overlap: settings.get('allow_overlap') === 'yes',
		compaction_type: settings.get('compaction_type'),
		
		// Product card styling settings
		product_layout: settings.get('product_layout'),
	};
};

/**
 * Extract settings for Categories Layout widget (placeholder for future use)
 * 
 * @param {Object} model - Elementor widget model
 * @returns {Object} Formatted settings object
 */
export const mapCategoriesLayoutSettings = (model) => {
	const settings = model.get('settings');
	return {
		// Category query settings
		per_page: settings.get('per_page'),
		orderby: settings.get('orderby'),
		order: settings.get('order'),
		hide_empty: settings.get('hide_empty') === 'yes',
		parent: settings.get('parent'),
		
		// Grid layout settings
		layout: settings.get('layout'),
		custom_layout: settings.get('custom_layout'),
		items_margin: settings.get('items_margin'),
		row_height: settings.get('row_height'),
		
		// Category card styling
		show_count: settings.get('show_count') === 'yes',
	};
};

/**
 * Extract settings for Single Product Layout widget (placeholder for future use)
 * 
 * @param {Object} model - Elementor widget model
 * @returns {Object} Formatted settings object
 */
export const mapSingleProductLayoutSettings = (model) => {
	const settings = model.get('settings');
	return {
		// Product ID
		product_id: settings.get('product_id'),
		
		// Layout settings
		layout: settings.get('layout'),
		custom_layout: settings.get('custom_layout'),
		
		// Display options
		show_gallery: settings.get('show_gallery') === 'yes',
		show_meta: settings.get('show_meta') === 'yes',
	};
};
