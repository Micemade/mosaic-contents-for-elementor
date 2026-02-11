/**
 * Main Frontend Entry Point
 *
 * Lightweight entry for production frontend pages.
 * Does NOT include editor functionality (drag/resize, add/remove, settings sync).
 *
 * This bundle is loaded on published pages via wp_enqueue_scripts.
 * For the Elementor editor, main-editor.jsx is loaded instead.
 */

// Global styles for all widgets
import './globalStyles.scss';

// Frontend-only modules
import { getRegisteredWidgets } from './core/widget-registry';
import { registerFrontendHooks, initializeFrontendWidgets } from './core/frontend-hooks';
import { injectBreakpointStylesheet } from './core/elementor-utils';

// Elementor frontend initialization
if (typeof jQuery !== 'undefined') {
	jQuery(window).on('elementor/frontend/init', function () {
		// Inject dynamic breakpoint stylesheet based on Elementor config
		injectBreakpointStylesheet();

		// Register frontend hooks (display mode only)
		registerFrontendHooks();
	});
}

// Fallback for non-Elementor pages
window.addEventListener('DOMContentLoaded', () => {
	// Only run if not in Elementor context
	if (typeof elementorFrontend === 'undefined' && typeof jQuery !== 'undefined') {
		initializeFrontendWidgets();
	}
});
