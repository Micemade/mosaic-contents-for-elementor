/**
 * Widget Initializer Factory
 * 
 * Creates initialization functions for each widget type.
 * Handles DOM extraction, settings parsing, and widget manager coordination.
 */

import widgetManager from './widget-manager';

/**
 * Factory function to create widget initializers for each widget type
 * 
 * @param {string} widgetType - Widget type (e.g., 'products-layout')
 * @returns {Function} Widget initializer function
 */
export const createWidgetInitializer = (widgetType) => {
	return ($scope) => {

		// Widget-specific class names (e.g., .products-layout-wrapper)
		const wrapperClass = `.${widgetType}-wrapper`;
		const rootClass = `.${widgetType}-react-root`;
		
		// Find widget wrapper (handles both jQuery and DOM queries)
		const wrapper = $scope.find(wrapperClass)[0] || $scope[0]?.querySelector(wrapperClass);
		// Find React root container within wrapper
		const rootElement = wrapper?.querySelector(rootClass);
		
		if (!rootElement) {
			console.warn(`React root not found for ${widgetType} widget`);
			return;
		}

		// Extract widget ID - prioritize data-widget-id from wrapper (set in content_template)
		// Fallback to $scope data attributes for backwards compatibility
		let widgetId = wrapper?.dataset?.widgetId || $scope.data('id') || $scope.data('widget-id');

		if (!widgetId) {
			console.error(`Widget ID not found for ${widgetType} widget. Check content_template() includes data-widget-id="{{ view.model.id }}"`);
			return;
		}

		// Initialize settings object
		let settings = {};
		// Look for hidden input with JSON settings (from PHP content_template)
		const settingsInput = wrapper.querySelector('.elementor-settings-data');
		
		if (settingsInput?.value) {
			try {
				// Parse JSON settings from hidden input
				settings = JSON.parse(settingsInput.value);
			} catch (error) {
				console.error(`Invalid JSON in settings for ${widgetType} widget ${widgetId}`, error);
			}
		}
		
		// Check if there's a model getter (in editor mode)
		const modelKey = `${widgetType}_${widgetId}`;
		const modelGetter = widgetManager.modelGetters[modelKey];
		if (modelGetter && !settingsInput) {
			// Use settings from Elementor model if no hidden input
			settings = modelGetter();
		}
		
		// Initialize or update the React widget
		widgetManager.init(widgetType, widgetId, rootElement, settings);
		
		// Fallback: if no settings source found, wait briefly for model getter to be registered
		if (!settingsInput && !modelGetter) {
			setTimeout(() => {
				// Check again after brief delay (model getter may be registered async)
				const delayedGetter = widgetManager.modelGetters[modelKey];
				if (delayedGetter) {
					widgetManager.updateInstance(widgetType, widgetId, delayedGetter());
				}
			}, 50);
		}
	};
};
