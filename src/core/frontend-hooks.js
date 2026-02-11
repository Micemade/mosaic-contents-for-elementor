/**
 * Frontend Hooks Registration
 *
 * Minimal hooks for frontend widget rendering. No editor functionality.
 * Used by main-frontend.jsx for lightweight frontend bundle.
 */

import { getRegisteredWidgets } from './widget-registry';
import { createWidgetInitializer } from './widget-initializer';

/**
 * Register frontend hooks for all widgets.
 *
 * Initializes widgets when they are rendered on the frontend.
 *
 * @return void
 */
export const registerFrontendHooks = () => {
	if (typeof elementorFrontend === 'undefined') {
		return;
	}

	// Register initialization hook for each widget type
	getRegisteredWidgets().forEach(widgetType => {
		// Hook pattern: frontend/element_ready/{widget-name}.default
		// Matches widget's get_name() in PHP
		elementorFrontend.hooks.addAction(
			`frontend/element_ready/${widgetType}.default`,
			createWidgetInitializer(widgetType, 'display')
		);
	});
};

/**
 * Initialize frontend-only widgets on non-Elementor pages.
 *
 * @return void
 */
export const initializeFrontendWidgets = () => {
	if (typeof jQuery === 'undefined') return;

	getRegisteredWidgets().forEach(widgetType => {
		jQuery(`.elementor-widget-${widgetType}`).each(function () {
			createWidgetInitializer(widgetType, 'display')(jQuery(this));
		});
	});
};
