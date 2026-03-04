/**
 * Z-Index Controls Component
 *
 * Shared component that renders "Bring Forward" / "Send Backward" buttons
 * for controlling the stacking order (z-index) of grid items.
 *
 * Used by products-layout, categories-layout, and single-product-layout widgets.
 *
 * @module ZIndexControls
 */

import React from 'react';

/**
 * Update z-index for a specific item and persist the change.
 *
 * Reads the current layout JSON, updates the zindex map,
 * and writes it back via updateElementorSetting.
 *
 * @param {string}   itemId           - Layout item ID (e.g. "item-0").
 * @param {number}   delta            - Change to apply (+1 or -1).
 * @param {Object}   layoutData       - Current parsed layout data (with .zindex).
 * @param {string}   customLayoutData - Raw JSON string of the custom layout (from Elementor setting).
 * @param {string}   widgetType       - Widget type slug (e.g. "products-layout").
 * @param {string}   widgetId         - Elementor widget ID.
 * @param {string}   settingKey       - Elementor setting key for the custom layout.
 * @param {Function} updateFn         - The updateElementorSetting function.
 */
export function updateZIndex(
	itemId,
	delta,
	layoutData,
	customLayoutData,
	widgetType,
	widgetId,
	settingKey,
	updateFn
) {
	const currentZIndex = layoutData.zindex?.[itemId] ?? 0;
	const newZIndex = Math.max(0, currentZIndex + delta);

	// Build the full layout object from the existing custom layout or current layoutData.
	let existingCustomLayout = {};
	if (customLayoutData) {
		try {
			existingCustomLayout = JSON.parse(customLayoutData);
		} catch (e) {
			console.error('Failed to parse existing custom layout:', e);
		}
	}

	const customLayout = {
		desktop:
			existingCustomLayout.desktop ||
			layoutData.desktop ||
			[],
		tablet:
			existingCustomLayout.tablet ||
			layoutData.tablet ||
			[],
		mobile:
			existingCustomLayout.mobile ||
			layoutData.mobile ||
			[],
		zindex: {
			...(existingCustomLayout.zindex || layoutData.zindex || {}),
			[itemId]: newZIndex,
		},
	};

	updateFn(widgetType, widgetId, settingKey, JSON.stringify(customLayout));
}

/**
 * ZIndexControls component.
 *
 * Renders two small buttons to increment/decrement a grid item's z-index.
 *
 * @param {Object}   props
 * @param {string}   props.itemId           - Layout item ID.
 * @param {Object}   props.layoutData       - Current parsed layout data.
 * @param {string}   props.customLayoutData - Raw custom layout JSON string.
 * @param {string}   props.widgetType       - Widget type slug.
 * @param {string}   props.widgetId         - Elementor widget ID.
 * @param {string}   props.settingKey       - Elementor setting key for custom layout.
 * @param {Function} props.updateFn         - updateElementorSetting function.
 * @returns {React.Element}
 */
const ZIndexControls = ({
	itemId,
	layoutData,
	customLayoutData,
	widgetType,
	widgetId,
	settingKey,
	updateFn,
}) => {
	const currentZIndex = layoutData.zindex?.[itemId] ?? 0;

	const handleBringForward = (e) => {
		e.stopPropagation();
		e.preventDefault();
		updateZIndex(
			itemId,
			1,
			layoutData,
			customLayoutData,
			widgetType,
			widgetId,
			settingKey,
			updateFn
		);
	};

	const handleSendBackward = (e) => {
		e.stopPropagation();
		e.preventDefault();
		updateZIndex(
			itemId,
			-1,
			layoutData,
			customLayoutData,
			widgetType,
			widgetId,
			settingKey,
			updateFn
		);
	};

	return (
		<div className="mpl4e-zindex-controls">
			<button
				type="button"
				className="mpl4e-zindex-btn mpl4e-zindex-btn--up"
				onMouseDownCapture={handleBringForward}
				title={`Bring Forward (z-index: ${currentZIndex + 1})`}
			>
				<i className="eicon-sort-up" aria-hidden="true" />
			</button>
			<span className="mpl4e-zindex-value" title="Current z-index">
				{currentZIndex}
			</span>
			<button
				type="button"
				className="mpl4e-zindex-btn mpl4e-zindex-btn--down"
				onMouseDownCapture={handleSendBackward}
				title={`Send Backward (z-index: ${Math.max(0, currentZIndex - 1)})`}
				disabled={currentZIndex <= 0}
			>
				<i className="eicon-sort-down" aria-hidden="true" />
			</button>
		</div>
	);
};

export default ZIndexControls;
