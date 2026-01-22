/**
 * Elementor Integration Utilities
 * 
 * Helper functions for React components to interact with Elementor.
 * Provides methods to update settings and trigger events.
 */

/**
 * Update Elementor model setting from React component
 * Critical for saving custom layouts after drag/resize
 * 
 * @param {string} widgetType - Widget type (e.g., 'products-layout')
 * @param {string} widgetId - Widget instance ID
 * @param {string} settingName - Setting key to update
 * @param {*} value - New value
 * @returns {boolean} Success status
 */
export const updateElementorSetting = (widgetType, widgetId, settingName, value) => {
	if (typeof window.MosaicLayoutsReact === 'undefined') {
		console.warn('MosaicLayoutsReact not available');
		return false;
	}

	window.MosaicLayoutsReact.updateModelSetting(widgetType, widgetId, settingName, value);
	
	// Mark document as changed to enable Update/Publish button
	if (typeof elementor !== 'undefined' && elementor.saver) {
		elementor.saver.setFlagEditorChange(true);
	}
	
	return true;
};

/**
 * Trigger layout reset event
 * Sends event to Elementor to clear custom_layout setting
 */
export const triggerLayoutReset = () => {
	if (typeof elementor !== 'undefined' && elementor.channels?.editor) {
		elementor.channels.editor.trigger('mosaic:resetLayout');
	}
};

/**
 * Check if currently in Elementor editor mode
 * 
 * @returns {boolean} True if in editor mode
 */
export const isElementorEditor = () => {
	return typeof elementor !== 'undefined' || 
	       (typeof window.elementorFrontend !== 'undefined' && window.elementorFrontend.isEditMode());
};

/**
 * Get current Elementor model for a widget
 * 
 * @param {string} widgetType - Widget type
 * @param {string} widgetId - Widget ID
 * @returns {Object|null} Elementor model or null
 */
export const getElementorModel = (widgetType, widgetId) => {
	if (typeof window.MosaicLayoutsReact === 'undefined') {
		return null;
	}
	
	return window.MosaicLayoutsReact.getModel(widgetType, widgetId);
};
