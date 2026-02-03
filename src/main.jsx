/**
 * Main Entry Point
 * 
 * Orchestrates the initialization of all widget management modules.
 * Handles both Elementor and non-Elementor contexts.
 */

// Global styles for all widgets
import './globalStyles.scss';

// Import core modules
import { getRegisteredWidgets } from './core/widget-registry';
import { initializeElementorHooks } from './core/elementor-hooks';
import { createWidgetInitializer } from './core/widget-initializer';
import { injectBreakpointStylesheet } from './core/elementor-utils';

// Elementor frontend initialization (runs when Elementor loads)
if (typeof jQuery !== 'undefined') {
	jQuery(window).on('elementor/frontend/init', function () {
		// Inject dynamic breakpoint stylesheet based on Elementor config
		injectBreakpointStylesheet();

		// Initialize all Elementor hooks (frontend, editor, observer)
		initializeElementorHooks();
	});
}

// Fallback for non-Elementor pages (frontend display)
window.addEventListener('DOMContentLoaded', () => {
	// Only run if not in Elementor editor and jQuery is available
	if (typeof elementor === 'undefined' && typeof jQuery !== 'undefined') {
		// Initialize all registered widgets on the page
		getRegisteredWidgets().forEach(widgetType => {
			jQuery(`.elementor-widget-${widgetType}`).each(function () {
				createWidgetInitializer(widgetType)(jQuery(this));
			});
		});
	}
});

