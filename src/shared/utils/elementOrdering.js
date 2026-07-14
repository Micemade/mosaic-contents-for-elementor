/**
 * Element Ordering Utilities
 *
 * Shared helpers for sorting and applying breakpoint visibility
 * to post type item elements based on the repeater control data.
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
 * Get the breakpoints at which a repeater element is hidden.
 *
 * Inspects the visibility switchers on a repeater item and returns the
 * breakpoint names whose switcher is off.
 *
 * @param {Object} item - Repeater item with visible_{breakpoint} properties.
 * @returns {Array<string>} Breakpoint names (e.g. ["tablet", "mobile"]).
 */
export function getHiddenBreakpoints(item) {
	const hidden = [];
	for (const [key, value] of Object.entries(item)) {
		if (key.startsWith('visible_') && value !== 'yes') {
			hidden.push(key.replace('visible_', ''));
		}
	}
	return hidden;
}

/**
 * Get CSS class names for breakpoint-based visibility hiding.
 *
 * @param {Object} item - Repeater item with visible_{breakpoint} properties.
 * @returns {string} Space-separated CSS class string (e.g. "mosaic-hide-mobile mosaic-hide-tablet").
 */
export function getVisibilityClasses(item) {
	return getHiddenBreakpoints(item)
		.map((bp) => `mosaic-hide-${bp}`)
		.join(' ');
}

/**
 * Parse element ordering data into an ordered array of element configs.
 *
 * @param {Array} ordering - Raw repeater data from Elementor setting.
 * @param {Array} defaultOrdering - Default ordering if setting is empty/invalid.
 * @returns {Array<{key: string, label: string, hideClasses: string, hiddenBreakpoints: Array<string>}>}
 */
export function parseElementOrdering(ordering, defaultOrdering) {
	const data = Array.isArray(ordering) && ordering.length > 0
		? ordering
		: defaultOrdering;

	return data.map((item) => ({
		key: normalizeLabel(item.element_label || ''),
		label: item.element_label || '',
		hideClasses: getVisibilityClasses(item),
		hiddenBreakpoints: getHiddenBreakpoints(item),
	}));
}
