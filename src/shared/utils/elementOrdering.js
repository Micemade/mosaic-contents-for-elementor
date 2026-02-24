/**
 * Element Ordering Utilities
 *
 * Shared helpers for sorting and applying breakpoint visibility
 * to product/category elements based on the repeater control data.
 *
 * @module elementOrdering
 */

/**
 * Normalize element label to a key.
 *
 * Converts label strings like "Add to Cart" → "add_to_cart",
 * matching the pattern used in rendering.
 *
 * @param {string} label - Display label from repeater control.
 * @returns {string} Normalized key.
 */
export function normalizeLabel(label) {
	return label.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get CSS class names for breakpoint-based visibility hiding.
 *
 * Inspects the visibility switchers on a repeater item and returns
 * an array of `mosaic-hide-{breakpoint}` classes for each breakpoint
 * where the element should be hidden.
 *
 * @param {Object} item - Repeater item with visible_{breakpoint} properties.
 * @returns {string} Space-separated CSS class string (e.g. "mosaic-hide-mobile mosaic-hide-tablet").
 */
export function getVisibilityClasses(item) {
	const hideClasses = [];
	for (const [key, value] of Object.entries(item)) {
		if (key.startsWith('visible_') && value !== 'yes') {
			const bp = key.replace('visible_', '');
			hideClasses.push(`mosaic-hide-${bp}`);
		}
	}
	return hideClasses.join(' ');
}

/**
 * Parse element ordering data into an ordered array of element configs.
 *
 * @param {Array} ordering - Raw repeater data from Elementor setting.
 * @param {Array} defaultOrdering - Default ordering if setting is empty/invalid.
 * @returns {Array<{key: string, label: string, hideClasses: string}>}
 */
export function parseElementOrdering(ordering, defaultOrdering) {
	const data = Array.isArray(ordering) && ordering.length > 0
		? ordering
		: defaultOrdering;

	return data.map((item) => ({
		key: normalizeLabel(item.element_label || ''),
		label: item.element_label || '',
		hideClasses: getVisibilityClasses(item),
	}));
}
