/**
 * Main Editor Entry Point
 *
 * Full-featured entry for Elementor editor preview.
 * Includes all editor functionality: drag/resize, add/remove items, settings sync.
 *
 * This bundle is loaded in the Elementor editor via elementor/preview/enqueue_scripts.
 * For published pages, the lighter main-frontend.jsx is used instead.
 */

// Global styles for all widgets
import './globalStyles.scss';

// Full editor modules
import { getRegisteredWidgets } from './core/widget-registry';
import { initializeEditorHooks } from './core/editor-hooks';
import { injectBreakpointStylesheet } from './core/elementor-utils';

// Elementor frontend initialization (runs in editor preview iframe)
if (typeof jQuery !== 'undefined') {
	jQuery(window).on('elementor/frontend/init', function () {
		// Inject dynamic breakpoint stylesheet based on Elementor config
		injectBreakpointStylesheet();

		// Initialize all editor hooks (frontend, editor, observer)
		initializeEditorHooks();
	});
}
