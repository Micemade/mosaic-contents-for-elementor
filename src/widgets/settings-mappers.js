/**
 * Settings Mappers
 * 
 * Extract and format widget settings from Elementor models.
 * Uses a generic factory driven by JSON setting definitions.
 * Not all settings are mapped; only those needed for React components.
 */

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
 * Create a settings mapper function for any widget type.
 * 
 * Returns a mapper that reads an Elementor model and produces
 * a plain settings object based on the provided JSON definition.
 * 
 * @param {Object} settingsDefinition - JSON schema defining the widget's settings
 * @returns {Function} (model) => Object  — settings mapper
 */
export const createSettingsMapper = (settingsDefinition) => (model) => {
	const settings = model.get('settings');
	const result = {};

	Object.keys(settingsDefinition).forEach(key => {
		const definition = settingsDefinition[key];
		const value = settings.get(key);

		if (definition.type === 'responsive') {
			result[key] = getResponsiveValue(
				settings,
				key,
				getActiveBreakpoints(),
				definition
			);
		} else if (definition.type === 'boolean') {
			result[key] = value === 'yes';
		} else if (definition.type === 'number') {
			result[key] = value !== undefined ? value : definition.default;
		} else if (definition.type === 'array') {
			// Repeater controls return a Backbone Collection whose reference
			// never changes on reorder.  Serialize to a plain array so React
			// can detect changes by reference comparison.
			if (value && typeof value.toJSON === 'function') {
				result[key] = value.toJSON();
			} else if (Array.isArray(value)) {
				result[key] = value;
			} else {
				result[key] = definition.default;
			}
		} else {
			result[key] = value !== undefined ? value : definition.default;
		}
	});

	return result;
};


