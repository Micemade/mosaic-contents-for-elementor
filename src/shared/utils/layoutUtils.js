/**
 * Layout Utilities
 *
 * Shared functions for working with grid layouts.
 *
 * Bundle note: the preset catalog (assets/presets/layouts.json, ~47 KB) is only
 * reachable from `getLayout`, which in turn is only called under
 * `__MC4E_EDITOR__`. In the frontend build that constant folds to `false`, the
 * call is dropped, and Rollup then drops both `getLayout` and the JSON import.
 * The frontend instead reads `mc4e_resolved_layout`, which PHP resolves in
 * WidgetHelpers::resolve_layout(). scripts/check-bundles.mjs enforces this.
 */

import Layouts from '../../../assets/presets/layouts.json';

const EMPTY_LAYOUT = { desktop: [], tablet: [], mobile: [], zindex: {} };

/**
 * Get layout from predefined layouts.
 *
 * Parses the layout JSON and converts PascalCase breakpoint keys to lowercase.
 * Layout item IDs (item-0, item-1, etc.) are preserved for items mapping.
 *
 * EDITOR ONLY — see the bundle note above. Do not call from a code path that
 * runs on the frontend; use `resolveLayoutData` instead.
 *
 * @param {string} layoutId  - ID of the layout to use (e.g., 'layout-5')
 * @param {number} itemCount - Number of items in the layout (for fallback selection)
 * @return {Object} Parsed layouts object with desktop, tablet, mobile arrays
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
		return EMPTY_LAYOUT;
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
 * EDITOR ONLY — reaches the preset catalog via `getLayout`.
 *
 * @param {string} customLayoutData - Custom layout JSON string (from mc4e_custom_layout)
 * @param {string} layoutId         - Predefined layout ID (from mc4e_layout)
 * @param {number} itemCount        - Number of items for fallback
 * @return {Object} Parsed layouts object
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

/**
 * Resolve the layout a widget should render, from either build context.
 *
 * Precedence:
 *   1. `mc4e_resolved_layout` — supplied by PHP on the frontend, already in the
 *      lowercase breakpoint shape. Costs the bundle nothing.
 *   2. `mc4e_custom_layout` — a user's dragged/resized layout, stored as JSON.
 *   3. The selected preset — editor only, since only the editor needs to
 *      re-resolve when the user switches presets in the panel.
 *
 * @param {Object} widgetData - Widget settings object.
 * @return {Object} Layout with desktop, tablet, mobile and zindex keys.
 */
export function resolveLayoutData(widgetData = {}) {
	const resolved = widgetData?.mc4e_resolved_layout;
	if (resolved && typeof resolved === 'object') {
		return resolved;
	}

	const customLayoutData = widgetData?.mc4e_custom_layout || '';
	if (customLayoutData) {
		try {
			return JSON.parse(customLayoutData);
		} catch (error) {
			console.error('Failed to parse custom layout:', error);
		}
	}

	if (__MC4E_EDITOR__) {
		return getLayout(widgetData?.mc4e_layout || 'default');
	}

	// Frontend with neither a resolved nor a custom layout: PHP failed to read
	// the preset catalog. Render nothing rather than guessing at a layout.
	return EMPTY_LAYOUT;
}
