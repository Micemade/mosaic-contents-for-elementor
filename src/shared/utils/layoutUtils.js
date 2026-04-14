/**
 * Layout Utilities
 * 
 * Shared functions for working with grid layouts.
 */

import Layouts from '../../../assets/presets/layouts.json';

/**
 * Get layout from predefined layouts.
 *
 * Parses the layout JSON and converts PascalCase breakpoint keys to lowercase.
 * Layout item IDs (item-0, item-1, etc.) are preserved for product mapping.
 *
 * @param {string} layoutId - ID of the layout to use (e.g., 'layout-5')
 * @param {number} itemCount - Number of items in the layout (for fallback selection)
 * @returns {Object} Parsed layouts object with desktop, tablet, mobile arrays
 */
export function getLayout(layoutId = 'default', itemCount = 3) {
	// Find layout by ID
	let layoutData = Layouts.find((l) => l.id === layoutId);

	// Fallback: find layout matching item count
	if (!layoutData) {
		if (itemCount <= 3) {
			layoutData = Layouts.find((l) => l.id === 'default');
		} else if (itemCount <= 4) {
			layoutData = Layouts.find((l) => l.id === 'layout-10');
		} else {
			layoutData = Layouts.find((l) => l.id === 'layout-10');
		}
	}

	if (!layoutData) {
		return { desktop: [], tablet: [], mobile: [], zindex: {} };
	}

	// Parse the JSON value
	const parsed = JSON.parse(layoutData.value);
	const zindex = layoutData.zindex ? JSON.parse(layoutData.zindex) : {};

	// Convert PascalCase to lowercase for Elementor breakpoints
	return {
		desktop: parsed.Desktop || [],
		tablet: parsed.Tablet || [],
		mobile: parsed.Mobile || [],
		zindex,
	};
}

/**
 * Get computed layout data from custom layout or predefined layout.
 *
 * @param {string} customLayoutData - Custom layout JSON string (from mpl4e_custom_layout)
 * @param {string} layoutId - Predefined layout ID (from mpl4e_layout)
 * @param {number} itemCount - Number of items for fallback
 * @returns {Object} Parsed layouts object
 */
export function getComputedLayout(customLayoutData, layoutId = 'default', itemCount = 10) {
	if (customLayoutData) {
		try {
			return JSON.parse(customLayoutData);
		} catch (error) {
			console.error('Failed to parse custom layout:', error);
			return getLayout(layoutId, itemCount);
		}
	}
	return getLayout(layoutId, itemCount);
}
