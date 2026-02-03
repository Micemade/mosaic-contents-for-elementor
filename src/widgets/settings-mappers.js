/**
 * Settings Mappers
 * 
 * Extract and format widget settings from Elementor models.
 * Each widget type has its own mapper function.
 * Not all settings are mapped; only those needed for React components.
 */

import productsLayoutSettingsDefinition from './products-layout/utils/products-layout-settings.json';
import { getActiveBreakpoints } from '../core/elementor-utils';

/**
 * Extract responsive setting value from Elementor model
 * 
 * @param {Object} settings - Elementor settings object
 * @param {string} key - Base setting key (e.g., 'title_size')
 * @param {Array} breakpoints - Breakpoint names ['desktop', 'tablet', 'mobile']
 * @param {Object} definition - Setting definition with defaults
 * @returns {Object} Responsive values { desktop: ..., tablet: ..., mobile: ... }
 */
const getResponsiveValue = (settings, key, breakpoints, definition) => {
	const result = {};

	breakpoints.forEach((breakpoint, index) => {
		let value;

		if (index === 0) {
			// Desktop (base value, no suffix)
			value = settings.get(key);
		} else {
			// Tablet/Mobile (with suffix)
			value = settings.get(`${key}_${breakpoint}`);
		}

		// Get breakpoint-specific default (e.g., tablet_default) or fallback to main default
		const breakpointDefaultKey = `${breakpoint}_default`;
		const breakpointDefault = definition[breakpointDefaultKey] || definition.default;

		// Use value if set, otherwise use breakpoint-specific default
		if (value !== undefined && value !== null && value !== '') {
			result[breakpoint] = value;
		} else {
			result[breakpoint] = breakpointDefault;
		}
	});

	return result;
};

/**
 * Extract settings for Products Layout widget
 * 
 * @param {Object} model - Elementor widget model
 * @returns {Object} Formatted settings object
 */
export const mapProductsLayoutSettings = (model) => {
	const settings = model.get('settings');
	const result = {};

	// Iterate through all settings defined in JSON
	Object.keys(productsLayoutSettingsDefinition).forEach(key => {
		const definition = productsLayoutSettingsDefinition[key];
		const value = settings.get(key);

		// Handle responsive settings (Elementor responsive controls)
		if (definition.type === 'responsive') {
			result[key] = getResponsiveValue(
				settings,
				key,
				getActiveBreakpoints(),
				definition
			);
		}
		// Apply type-specific conversion for regular settings
		else if (definition.type === 'boolean') {
			// Convert 'yes'/'no' string to boolean
			result[key] = value === 'yes';
		} else if (definition.type === 'number') {
			// Ensure numeric values
			result[key] = value !== undefined ? value : definition.default;
		} else {
			// String values
			result[key] = value !== undefined ? value : definition.default;
		}
	});

	return result;
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
