import { updateElementorSetting } from '../../core/elementor-utils';
import { addItemToLayout, removeItemFromLayout } from './addItem.js';
import { mergeVisibleIntoFullLayout } from './visibleLayout.js';

/**
 * Parse the serialized custom layout JSON from Elementor settings.
 *
 * @param {string} customLayoutData - Serialized layout JSON string.
 * @return {Object} Parsed layout object, or an empty object on failure.
 */
const parseCustomLayout = (customLayoutData) => {
	if (!customLayoutData) {
		return {};
	}

	try {
		return JSON.parse(customLayoutData);
	} catch (error) {
		console.error('Failed to parse existing custom layout:', error);
		return {};
	}
};

/**
 * Persist a layout change by merging visible edits into the full layout map.
 *
 * @param {Object} params                  - Function parameters.
 * @param {string} params.widgetType       - Widget type key used by the widget manager.
 * @param {string} params.widgetId         - Elementor widget instance ID.
 * @param {string} params.settingKey       - Elementor setting key where layout is stored.
 * @param {string} params.customLayoutData - Existing serialized custom layout JSON.
 * @param {Object} params.layoutData       - Default layout data used as fallback.
 * @param {Object} params.newLayouts       - Updated visible layouts from the grid editor.
 * @return {void}
 */
export const applyLayoutChange = ({
	widgetType,
	widgetId,
	settingKey,
	customLayoutData,
	layoutData,
	newLayouts,
}) => {
	if (typeof elementor === 'undefined' || !widgetId) {
		return;
	}

	const existingCustomLayout = parseCustomLayout(customLayoutData);
	const baseLayout = existingCustomLayout.mobile?.length ? existingCustomLayout : layoutData;
	const merged = mergeVisibleIntoFullLayout(baseLayout, newLayouts);

	const customLayout = {
		...merged,
		zindex: existingCustomLayout.zindex || layoutData.zindex || {},
	};

	updateElementorSetting(widgetType, widgetId, settingKey, JSON.stringify(customLayout));
};

/**
 * Select the current widget in the Elementor editor canvas.
 *
 * @param {Object}  params             - Function parameters.
 * @param {boolean} params.isEditMode  - Whether the widget is running in editor mode.
 * @param {string}  params.widgetId    - Elementor widget instance ID.
 * @param {string}  params.widgetClass - CSS class used to locate the widget wrapper.
 * @return {void}
 */
export const selectElementorWidget = ({ isEditMode, widgetId, widgetClass }) => {
	if (!isEditMode || !widgetId) {
		return;
	}

	try {
		const widgetSelector = `.${widgetClass}[data-widget-id="${widgetId}"]`;
		const widgetEl = document.querySelector(widgetSelector);
		const containerEl = widgetEl?.closest('[data-id]');

		if (containerEl instanceof HTMLElement) {
			containerEl.click();
		}
	} catch (error) {
		console.error('Error selecting widget:', error);
	}
};

/**
 * Add a new grid item to the current layout and persist the result.
 *
 * @param {Object}  params                  - Function parameters.
 * @param {boolean} params.isEditMode       - Whether the widget is running in editor mode.
 * @param {string}  params.widgetType       - Widget type key used by the widget manager.
 * @param {string}  params.widgetId         - Elementor widget instance ID.
 * @param {string}  params.settingKey       - Elementor setting key where layout is stored.
 * @param {string}  params.customLayoutData - Existing serialized custom layout JSON.
 * @param {Object}  params.layoutData       - Default layout data used when no custom layout exists.
 * @param {number}  params.gridColumns      - Column count used to compute new item placement.
 * @return {void}
 */
export const addGridItem = ({
	isEditMode,
	widgetType,
	widgetId,
	settingKey,
	customLayoutData,
	layoutData,
	gridColumns,
}) => {
	if (!isEditMode || !widgetId) {
		return;
	}

	const currentLayout = customLayoutData || JSON.stringify(layoutData);
	const { newLayoutJson } = addItemToLayout(currentLayout, gridColumns);
	updateElementorSetting(widgetType, widgetId, settingKey, newLayoutJson);
};

/**
 * Remove a grid item from the current layout and persist the result.
 *
 * @param {Object}  params                  - Function parameters.
 * @param {boolean} params.isEditMode       - Whether the widget is running in editor mode.
 * @param {string}  params.widgetType       - Widget type key used by the widget manager.
 * @param {string}  params.widgetId         - Elementor widget instance ID.
 * @param {string}  params.settingKey       - Elementor setting key where layout is stored.
 * @param {string}  params.customLayoutData - Existing serialized custom layout JSON.
 * @param {Object}  params.layoutData       - Default layout data used when no custom layout exists.
 * @param {string}  params.itemId           - ID of the item to remove.
 * @return {void}
 */
export const removeGridItem = ({
	isEditMode,
	widgetType,
	widgetId,
	settingKey,
	customLayoutData,
	layoutData,
	itemId,
}) => {
	if (!isEditMode || !widgetId) {
		return;
	}

	if (layoutData.mobile.length <= 1) {
		return;
	}

	const currentLayout = customLayoutData || JSON.stringify(layoutData);
	const newLayoutJson = removeItemFromLayout(currentLayout, itemId);
	updateElementorSetting(widgetType, widgetId, settingKey, newLayoutJson);
};
