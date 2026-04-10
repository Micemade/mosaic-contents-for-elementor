import { updateElementorSetting } from '../../core/elementor-utils';
import { addItemToLayout, removeItemFromLayout } from './addItem.js';
import { mergeVisibleIntoFullLayout } from './visibleLayout.js';

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

export const selectElementorWidget = ({ isEditMode, widgetId, widgetClass }) => {
	if (!isEditMode || !widgetId) {
		return;
	}

	try {
		const $widgetEl = jQuery(`.${widgetClass}[data-widget-id="${widgetId}"]`).closest('[data-id]');
		if ($widgetEl && $widgetEl.length) {
			$widgetEl.trigger('click');
		}
	} catch (error) {
		console.error('Error selecting widget:', error);
	}
};

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
