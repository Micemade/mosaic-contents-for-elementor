import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './globalStyles.scss';
import ProductsLayoutWidget from './widgets/products-layout/products-layout';

// Global registry to track mounted widget instances
window.ProductsLayoutReact = {
	instances: {},
	modelGetters: {},
	
	init: function(widgetId, rootElement, initialSettings) {
		const existingInstance = this.instances[widgetId];
		
		// If DOM was replaced, unmount old root and create new one
		if (existingInstance && !existingInstance.rootElement.isConnected) {
			try {
				existingInstance.root.unmount();
			} catch (e) {
				// Silently handle unmount errors
			}
		}
		
		// If instance exists and is connected, just update settings
		if (existingInstance && existingInstance.rootElement.isConnected) {
			existingInstance.updateSettings(initialSettings);
			return;
		}
		
		// Create new React root
		const root = createRoot(rootElement);
		let setSettings;
		let currentSettingsRef = initialSettings;
		
		const App = () => {
			const [settings, _setSettings] = useState(initialSettings);
			setSettings = (newSettings) => {
				_setSettings(prevSettings => {
					const merged = { ...prevSettings, ...newSettings };
					currentSettingsRef = merged;
					return merged;
				});
			};
			
			return <ProductsLayoutWidget widgetData={settings} widgetId={widgetId} />;
		};
		
		root.render(<App />);
		
		this.instances[widgetId] = {
			root: root,
			rootElement: rootElement,
			currentSettings: currentSettingsRef,
			updateSettings: (newSettings) => {
				currentSettingsRef = { ...currentSettingsRef, ...newSettings };
				if (setSettings) {
					setSettings(newSettings);
				}
			}
		};
	},
	
	updateInstance: function(widgetId, newSettings) {
		if (this.instances[widgetId]) {
			this.instances[widgetId].updateSettings(newSettings);
		}
	}
};

const initWidget = ($scope) => {
	const widgetId = $scope.data('id') || $scope.data('widget-id');
	const wrapper = $scope.find('.products-layout-wrapper')[0] || $scope[0]?.querySelector('.products-layout-wrapper');
	const rootElement = wrapper?.querySelector('.products-layout-react-root');
	
	if (!rootElement) return;
	
	let settings = {};
	const settingsInput = wrapper.querySelector('.elementor-settings-data');
	
	if (settingsInput?.value) {
		try {
			settings = JSON.parse(settingsInput.value);
		} catch (error) {
			// Invalid JSON in settings input
		}
	}
	
	const modelGetter = window.ProductsLayoutReact.modelGetters[widgetId];
	if (modelGetter && !settingsInput) {
		settings = modelGetter();
	}
	
	window.ProductsLayoutReact.init(widgetId, rootElement, settings);
	
	if (!settingsInput && !modelGetter) {
		setTimeout(() => {
			const delayedGetter = window.ProductsLayoutReact.modelGetters[widgetId];
			if (delayedGetter) {
				window.ProductsLayoutReact.updateInstance(widgetId, delayedGetter());
			}
		}, 50);
	}
};

// Elementor frontend initialization
if (typeof jQuery !== 'undefined') {
	jQuery(window).on('elementor/frontend/init', function () {
		if (typeof elementorFrontend !== 'undefined') {
			elementorFrontend.hooks.addAction(
				'frontend/element_ready/products-layout.default',
				initWidget
			);
		}
		
		// Editor mode: Listen to model changes for live updates
		if (typeof elementor !== 'undefined') {
			// Set renderOnChange to false to prevent DOM re-renders
			elementor.hooks.addFilter('editor/widget/renderOnChange', function(renderOnChange, widgetType) {
				if (widgetType === 'products-layout') {
					return false;
				}
				return renderOnChange;
			});
			
			elementor.hooks.addAction('panel/open_editor/widget/products-layout', (panel, model, view) => {
				const widgetId = model.id;
				
				// Override renderOnChange to return false (prevent DOM re-renders)
				view.renderOnChange = () => false;
				
				// Create settings getter from model
				const getSettingsFromModel = () => {
					const settings = model.get('settings');
					return {
						title: settings.get('widget_title'),
						per_page: settings.get('per_page'),
						orderby: settings.get('orderby'),
						order: settings.get('order'),
						category: settings.get('category'),
						on_sale: settings.get('on_sale') === 'yes',
						featured: settings.get('featured') === 'yes',
						columns: settings.get('columns'),
						gap: settings.get('gap'),
						layout: settings.get('layout'),
						custom_layout: settings.get('custom_layout'),
						items_margin: settings.get('items_margin'),
						row_height: settings.get('row_height'),
						allow_overlap: settings.get('allow_overlap') === 'yes',
						compaction_type: settings.get('compaction_type')
					};
				};
				
				// Store globally for remounts
				window.ProductsLayoutReact.modelGetters[widgetId] = getSettingsFromModel;
				
				// Store model reference for updating settings from React
				window.ProductsLayoutReact.models = window.ProductsLayoutReact.models || {};
				window.ProductsLayoutReact.models[widgetId] = model;

				// Listen to settings changes
				model.get('settings').on('change', () => {
					window.ProductsLayoutReact.updateInstance(widgetId, getSettingsFromModel());
				});

				// Listen for reset layout button click
				elementor.channels.editor.on('mosaic:resetLayout', () => {
					if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
						model.setSetting('custom_layout', '');
					}
				});
			});
		}
		
		// Handle initial render when widget is added in edit mode
		if (typeof elementor !== 'undefined') {
			const previewFrame = document.querySelector('#elementor-preview-iframe');
			if (previewFrame) {
				const initPreview = () => {
					const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
					if (!previewDoc?.body) {
						setTimeout(initPreview, 100);
						return;
					}
					
					const observer = new MutationObserver((mutations) => {
						mutations.forEach((mutation) => {
							mutation.addedNodes.forEach((node) => {
								if (node.nodeType === 1) {
									const widgets = node.classList?.contains('products-layout-wrapper') 
										? [node] 
										: (node.querySelectorAll ? node.querySelectorAll('.products-layout-wrapper') : []);
									
									widgets.forEach((wrapper) => {
										const $wrapper = jQuery(wrapper).closest('.elementor-widget-products-layout');
										if ($wrapper.length) {
											const widgetId = $wrapper.data('id') || $wrapper.data('widget-id');
											if (!window.ProductsLayoutReact.instances[widgetId]) {
												initWidget($wrapper);
											}
										}
									});
								}
							});
						});
					});
					
					observer.observe(previewDoc.body, { childList: true, subtree: true });
					
					previewDoc.querySelectorAll('.products-layout-wrapper').forEach((wrapper) => {
						const $wrapper = jQuery(wrapper).closest('.elementor-widget-products-layout');
						if ($wrapper.length && !window.ProductsLayoutReact.instances[$wrapper.data('id')]) {
							initWidget($wrapper);
						}
					});
				};
				
				if (previewFrame.contentDocument?.readyState === 'complete') {
					initPreview();
				} else {
					previewFrame.addEventListener('load', initPreview);
				}
			}
		}
	});
}

// Fallback for non-Elementor pages
window.addEventListener('DOMContentLoaded', () => {
	if (typeof elementor === 'undefined' && typeof jQuery !== 'undefined') {
		jQuery('.elementor-widget-products-layout').each(function () {
			initWidget(jQuery(this));
		});
	}
});

