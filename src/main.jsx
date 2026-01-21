// React imports for component state and rendering
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles for all widgets
import './globalStyles.scss';
// Main widget component
import ProductsLayoutWidget from './widgets/products-layout/products-layout';

// Global registry to track mounted widget instances
// Prevents duplicate React roots and enables settings updates without remounting
window.ProductsLayoutReact = {
	// Store mounted React roots and their state
	instances: {},
	// Store functions that retrieve current Elementor model settings
	modelGetters: {},
	
	// Initialize or update a widget instance
	init: function(widgetId, rootElement, initialSettings) {

		const existingInstance = this.instances[widgetId];
		
		// If DOM was replaced (Elementor re-render), unmount old root and create new one
		if (existingInstance && !existingInstance.rootElement.isConnected) {
			try {
				existingInstance.root.unmount();
			} catch (e) {
				// Silently handle unmount errors (root may already be unmounted)
			}
		}
		
		// If instance exists and DOM is still connected, just update settings (no remount needed)
		if (existingInstance && existingInstance.rootElement.isConnected) {
			existingInstance.updateSettings(initialSettings);
			return;
		}
		
		// Create new React root for this widget instance
		const root = createRoot(rootElement);
		let setSettings; // Will be set inside App component
		let currentSettingsRef = initialSettings; // Track current settings outside React state

		// Wrapper component that manages widget settings state
		const App = () => {
			const [settings, _setSettings] = useState(initialSettings);
			// Expose setter function to external code
			setSettings = (newSettings) => {
				_setSettings(prevSettings => {
					// Merge new settings with previous ones
					const merged = { ...prevSettings, ...newSettings };
					currentSettingsRef = merged;
					return merged;
				});
			};
			
			// Render the actual widget with current settings
			return <ProductsLayoutWidget widgetData={settings} widgetId={widgetId} />;
		};
		
		root.render(<App />);
		
		// Store instance data for future updates
		this.instances[widgetId] = {
			root: root, // React root for unmounting
			rootElement: rootElement, // DOM element to check connection
			currentSettings: currentSettingsRef, // Current settings reference
			// Function to update settings without remounting
			updateSettings: (newSettings) => {
				currentSettingsRef = { ...currentSettingsRef, ...newSettings };
				if (setSettings) {
					setSettings(newSettings);
				}
			}
		};
	},
	
	// Public method to update an existing widget instance
	updateInstance: function(widgetId, newSettings) {
		if (this.instances[widgetId]) {
			this.instances[widgetId].updateSettings(newSettings);
		}
	}
};

// Initialize a widget instance (called by Elementor hooks)
const initWidget = ($scope) => {
	// Extract widget ID from jQuery element
	const widgetId = $scope.data('id') || $scope.data('widget-id');
	// Find widget wrapper (handles both jQuery and DOM queries)
	const wrapper = $scope.find('.products-layout-wrapper')[0] || $scope[0]?.querySelector('.products-layout-wrapper');
	// Find React root container within wrapper
	const rootElement = wrapper?.querySelector('.products-layout-react-root');
	
	if (!rootElement) return; // Exit if no React root found // Exit if no React root found

	// Initialize settings object
	let settings = {};
	// Look for hidden input with JSON settings (from PHP content_template)
	const settingsInput = wrapper.querySelector('.elementor-settings-data');
	
	if (settingsInput?.value) {
		try {
			// Parse JSON settings from hidden input
			settings = JSON.parse(settingsInput.value);
		} catch (error) {
			// Invalid JSON in settings input - use empty object
		}
	}
	
	// Check if there's a model getter (in editor mode)
	const modelGetter = window.ProductsLayoutReact.modelGetters[widgetId];
	if (modelGetter && !settingsInput) {
		// Use settings from Elementor model if no hidden input
		settings = modelGetter();
	}
	
	// Initialize or update the React widget
	window.ProductsLayoutReact.init(widgetId, rootElement, settings);
	
	// Fallback: if no settings source found, wait briefly for model getter to be registered
	if (!settingsInput && !modelGetter) {
		setTimeout(() => {
			// Check again after brief delay (model getter may be registered async)
			const delayedGetter = window.ProductsLayoutReact.modelGetters[widgetId];
			if (delayedGetter) {
				window.ProductsLayoutReact.updateInstance(widgetId, delayedGetter());
			}
		}, 50);
	}
};

// Elementor frontend initialization (runs when Elementor loads) (runs when Elementor loads)
if (typeof jQuery !== 'undefined') {
	jQuery(window).on('elementor/frontend/init', function () {
		if (typeof elementorFrontend !== 'undefined') {
			// Register widget initialization hook for frontend rendering
			// Hook name matches widget's get_name() in PHP: 'products-layout'
			elementorFrontend.hooks.addAction(
				'frontend/element_ready/products-layout.default',
				initWidget
			);
		}
		
		// Editor mode: Listen to model changes for live updates
		if (typeof elementor !== 'undefined') {
			// Prevent Elementor from re-rendering the widget DOM on every settings change
			// React will handle updates internally without DOM replacement
			elementor.hooks.addFilter('editor/widget/renderOnChange', function(renderOnChange, widgetType) {
				if (widgetType === 'products-layout') {
					return false; // Disable automatic DOM re-renders
				}
				return renderOnChange;
			});
			
			// Hook triggered when widget panel is opened in editor
			elementor.hooks.addAction('panel/open_editor/widget/products-layout', (panel, model, view) => {
				const widgetId = model.id;
				
				// Override renderOnChange method to prevent DOM re-renders (redundant with filter above)
				view.renderOnChange = () => false; // Override renderOnChange method to prevent DOM re-renders (redundant with filter above)

				// Function to extract all widget settings from Elementor model
				const getSettingsFromModel = () => {
					const settings = model.get('settings');
					return {
						// WooCommerce query settings
						per_page: settings.get('per_page'),
						orderby: settings.get('orderby'),
						order: settings.get('order'),
						category: settings.get('category'),
						on_sale: settings.get('on_sale') === 'yes',
						featured: settings.get('featured') === 'yes',
						// Grid layout settings
						layout: settings.get('layout'),
						custom_layout: settings.get('custom_layout'),
						items_margin: settings.get('items_margin'),
						row_height: settings.get('row_height'),
						allow_overlap: settings.get('allow_overlap') === 'yes',
						compaction_type: settings.get('compaction_type'),
						// Product card styling settings
						product_layout: settings.get('product_layout'),
					};
				};
				
				// Store getter globally so it's available during widget remounts
				window.ProductsLayoutReact.modelGetters[widgetId] = getSettingsFromModel;
				
				// Store model reference for potential two-way updates (React → Elementor)
				window.ProductsLayoutReact.models = window.ProductsLayoutReact.models || {};
				window.ProductsLayoutReact.models[widgetId] = model;

				// Listen to Elementor settings changes and update React component
				model.get('settings').on('change', () => {
					window.ProductsLayoutReact.updateInstance(widgetId, getSettingsFromModel());
				});

				// Listen for custom 'reset layout' event from React component
				elementor.channels.editor.on('mosaic:resetLayout', () => {
					// Only reset if this widget is currently open in the panel
					if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
						model.setSetting('custom_layout', ''); // Clear custom layout setting
					}
				});
			});
		}
		
		// Handle initial render and dynamic widget additions in Elementor editor
		if (typeof elementor !== 'undefined') {
			const previewFrame = document.querySelector('#elementor-preview-iframe');
			if (previewFrame) {
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
								// Find widget wrappers in added nodes
									const widgets = node.classList?.contains('products-layout-wrapper') 
										? [node] 
										: (node.querySelectorAll ? node.querySelectorAll('.products-layout-wrapper') : []);
									
									// Initialize each widget wrapper found
									widgets.forEach((wrapper) => {
										const $wrapper = jQuery(wrapper).closest('.elementor-widget-products-layout');
										if ($wrapper.length) {
											const widgetId = $wrapper.data('id') || $wrapper.data('widget-id');
											// Only initialize if not already initialized
											if (!window.ProductsLayoutReact.instances[widgetId]) {
												initWidget($wrapper);
											}
										}
									});
								}
							});
						});
					});
					
					// Observe entire preview document for changes
					observer.observe(previewDoc.body, { childList: true, subtree: true }); // Observe entire preview document for changes

					// Initialize any existing widgets already in the DOM
					previewDoc.querySelectorAll('.products-layout-wrapper').forEach((wrapper) => {
						const $wrapper = jQuery(wrapper).closest('.elementor-widget-products-layout');
						if ($wrapper.length && !window.ProductsLayoutReact.instances[$wrapper.data('id')]) {
							initWidget($wrapper);
						}
					});
				};
				
				// Start initialization based on iframe load state
				if (previewFrame.contentDocument?.readyState === 'complete') {
					initPreview(); // Already loaded
				} else {
					previewFrame.addEventListener('load', initPreview); // Wait for load
				}
			}
		}
	});
}

// Fallback for non-Elementor pages (frontend display)
window.addEventListener('DOMContentLoaded', () => {
	// Only run if not in Elementor editor and jQuery is available
	if (typeof elementor === 'undefined' && typeof jQuery !== 'undefined') {
		// Initialize all widgets on the page
		jQuery('.elementor-widget-products-layout').each(function () {
			initWidget(jQuery(this));
		});
	}
});

