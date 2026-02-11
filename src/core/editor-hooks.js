/**
 * Editor Hooks Registration
 *
 * Editor-only hooks for Elementor integration. Handles model binding,
 * settings sync, and DOM re-render prevention. Not loaded on frontend.
 */

import { getRegisteredWidgets, getWidgetConfig } from './widget-registry';
import { createWidgetInitializer } from './widget-initializer';
import widgetManager from './widget-manager';
import { getActiveBreakpoints } from './elementor-utils';
import { addItemToLayout } from '../shared/utils/addItem';
import { getComputedLayout } from '../shared/utils/layoutUtils';

/**
 * Register frontend hooks for editor preview.
 * Same as frontend-hooks but with 'edit' mode.
 *
 * @return void
 */
export const registerFrontendHooks = () => {
	if (typeof elementorFrontend === 'undefined') {
		return;
	}

	getRegisteredWidgets().forEach(widgetType => {
		elementorFrontend.hooks.addAction(
			`frontend/element_ready/${widgetType}.default`,
			createWidgetInitializer(widgetType, 'edit')
		);
	});
};

/**
 * Register editor hooks to prevent DOM re-renders and provide live updates.
 *
 * Ensures Elementor does not replace the widget DOM on each settings change
 * and wires the panel open event to provide a model getter for the widget
 * manager.
 *
 * @return void
 */
export const registerEditorHooks = () => {
	if (typeof elementor === 'undefined') {
		return;
	}

	// Prevent Elementor from re-rendering widget DOM on every settings change
	// React will handle updates internally without DOM replacement
	elementor.hooks.addFilter('editor/widget/renderOnChange', function (renderOnChange, widgetType) {
		if (getRegisteredWidgets().includes(widgetType)) {
			return false; // Disable automatic DOM re-renders for our widgets
		}
		return renderOnChange;
	});

	// Register panel open hooks for each widget type
	getRegisteredWidgets().forEach(widgetType => {
		elementor.hooks.addAction(`panel/open_editor/widget/${widgetType}`, (panel, model, view) => {
			const widgetId = model.id;
			const modelKey = `${widgetType}_${widgetId}`;
			const widgetConfig = getWidgetConfig(widgetType);
			const getSettingsFromModel = () => widgetConfig.settingsMapper(model);

			// Register the editor view with the widget manager so the
			// manager can consult it when deciding whether to remount
			// (for example: core/advanced settings should allow remount).
			if (view) {
				try {
					// Derive widget-owned setting keys from the mapper result
					const mapped = getSettingsFromModel() || {};
					const widgetKeys = Object.keys(mapped);

					// Expand widgetKeys to include responsive control variants
					// Responsive settings in Elementor are stored as:
					// - base_key (desktop), base_key_tablet, base_key_mobile
					// But in mapped settings they appear as single key with breakpoints object
					const expandedWidgetKeys = new Set(widgetKeys);

					widgetKeys.forEach(key => {
						const value = mapped[key];
						// Check if this is a responsive setting (object with breakpoint keys)
						if (value && typeof value === 'object' && !Array.isArray(value)) {
							const activeBreakpoints = getActiveBreakpoints();
							const hasBreakpoints = activeBreakpoints.some(bp => value.hasOwnProperty(bp));

							if (hasBreakpoints) {
								// Add breakpoint variants: key_tablet, key_mobile, etc.
								// Exclude 'desktop' as it's the base key
								activeBreakpoints.filter(bp => bp !== 'desktop').forEach(bp => {
									expandedWidgetKeys.add(`${key}_${bp}`);
								});
							}
						}
					});

					const widgetKeysArray = Array.from(expandedWidgetKeys);

					// Override view.renderOnChange to be conditional:
					// - For widget-owned changes, false (React handles it)
					// - For core/advanced changes, call the original renderOnChange
					const originalRenderOnChange = view.renderOnChange.bind(view);
					view.renderOnChange = (settings) => {
						const changed = settings.changedAttributes();
						const hasNonWidgetChange = Object.keys(changed).some(k => !widgetKeysArray.includes(k));
						if (hasNonWidgetChange) {
							// Call original to handle core/advanced changes
							originalRenderOnChange(settings);
						}
						// For widget-owned changes, do nothing (React updates in-place)
					};

				} catch (e) {
					// ignore registration errors
				}
			}

			// Store getter globally so it's available during widget remounts
			widgetManager.modelGetters[modelKey] = getSettingsFromModel;

			// Store model reference for two-way updates (React → Elementor)
			widgetManager.models[modelKey] = model;

			// Push initial settings immediately so React mounts with correct data.
			// This ensures settings are applied on first widget load.
			widgetManager.updateInstance(
				widgetType,
				widgetId,
				getSettingsFromModel()
			);

			// Update React component whenever Elementor model settings change (Elementor → React).
			model.get('settings').on('change', (settingsModel) => {
				widgetManager.updateInstance(
					widgetType,
					widgetId,
					getSettingsFromModel()
				);
			});

			// Clear custom layout when predefined layout changes
			// This ensures switching predefined layouts applies immediately
			model.get('settings').on('change:mpl4e_layout', (settingsModel, newLayoutId) => {
				const customLayout = model.getSetting('mpl4e_custom_layout');
				if (customLayout) {
					// Clear custom layout so new predefined layout takes effect
					model.setSetting('mpl4e_custom_layout', '');
				}
			});

			// Listen for custom 'reset layout' event from React component
			// (React → Elementor)
			elementor.channels.editor.on('mosaic:resetLayout', () => {
				// Only reset if this widget is currently open in the panel
				if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
					model.setSetting('mpl4e_custom_layout', ''); // Clear custom layout setting
				}
			});

			// Listen for 'add grid item' event from panel button
			// (Elementor Panel → React)
			elementor.channels.editor.on('mosaic:addItem', () => {
				// Only add if this widget is currently open in the panel
				if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
					const customLayoutData = model.getSetting('mpl4e_custom_layout') || '';
					const layoutId = model.getSetting('mpl4e_layout') || 'layout-1';
					const gridColumns = {
						desktop: 48,
						tablet: 24,
						mobile: 12
					};

					// Get the actual layout data (from custom or predefined)
					const currentLayoutData = getComputedLayout(customLayoutData, layoutId);
					const { newLayoutJson, newItemId } = addItemToLayout(JSON.stringify(currentLayoutData), gridColumns);
					model.setSetting('mpl4e_custom_layout', newLayoutJson);

					// Mark document as changed
					if (elementor.saver) {
						elementor.saver.setFlagEditorChange(true);
					}
				}
			});
		});
	});
};

/**
 * Setup a MutationObserver inside the Elementor preview iframe.
 *
 * This observes dynamically added widgets (for example when dragging a
 * new widget into the canvas) and initializes React instances for them.
 *
 * @return void
 */
export const setupEditorObserver = () => {
	if (typeof elementor === 'undefined') return;

	const previewFrame = document.querySelector('#elementor-preview-iframe');
	if (!previewFrame) return;

	const initPreview = () => {
		// Access iframe document
		const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
		if (!previewDoc?.body) {
			// Retry if iframe body not ready yet
			setTimeout(initPreview, 100);
			return;
		}

		// Watch for new widgets added to DOM (e.g., drag & drop in editor)
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1) { // Element node
						// Check for all registered widget types
						getRegisteredWidgets().forEach(widgetType => {
							const wrapperClass = `${widgetType}-wrapper`;
							const elementorClass = `elementor-widget-${widgetType}`;

							// Find widget wrappers in added nodes
							const widgets = node.classList?.contains(wrapperClass)
								? [node]
								: (node.querySelectorAll ? node.querySelectorAll(`.${wrapperClass}`) : []);

							// Initialize each widget wrapper found
							widgets.forEach((wrapper) => {
								const $wrapper = jQuery(wrapper).closest(`.${elementorClass}`);
								if ($wrapper.length) {
									const widgetId = $wrapper.data('id') || $wrapper.data('widget-id');
									const instanceKey = `${widgetType}_${widgetId}`;
									// Only initialize if not already initialized
									if (!widgetManager.instances[instanceKey]) {
										createWidgetInitializer(widgetType, 'edit')($wrapper);
									}
								}
							});
						});
					}
				});
			});
		});

		// Observe entire preview document for changes
		observer.observe(previewDoc.body, { childList: true, subtree: true });

		// Initialize any existing widgets already in the DOM
		getRegisteredWidgets().forEach(widgetType => {
			const wrapperClass = `${widgetType}-wrapper`;
			const elementorClass = `elementor-widget-${widgetType}`;

			previewDoc.querySelectorAll(`.${wrapperClass}`).forEach((wrapper) => {
				const $wrapper = jQuery(wrapper).closest(`.${elementorClass}`);
				if ($wrapper.length) {
					const instanceKey = `${widgetType}_${$wrapper.data('id')}`;
					if (!widgetManager.instances[instanceKey]) {
						createWidgetInitializer(widgetType, 'edit')($wrapper);
					}
				}
			});
		});
	};

	// Start initialization based on iframe load state
	if (previewFrame.contentDocument?.readyState === 'complete') {
		initPreview(); // Already loaded
	} else {
		previewFrame.addEventListener('load', initPreview); // Wait for load
	}
};

/**
 * Initialize all editor hooks.
 *
 * @return void
 */
export const initializeEditorHooks = () => {
	registerFrontendHooks();
	registerEditorHooks();
	setupEditorObserver();
};
