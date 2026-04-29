/**
 * Generic Widget Manager
 * 
 * Manages React widget instances across all widget types.
 * Handles initialization, updates, and lifecycle management.
 * Provides two-way communication between React components and Elementor models.
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getWidgetConfig } from './widget-registry';

// Global widget manager - handles all widget types
class WidgetManager {
	constructor() {
		// Store mounted React roots and their state
		this.instances = {};
		// Store functions that retrieve current Elementor model settings
		this.modelGetters = {};
		// Store Elementor model references for two-way updates (React → Elementor)
		this.models = {};
	}

	markDocumentModified(status = true) {
		const $e = window.$e || window.parent?.$e;
		if ($e?.internal) {
			try {
				$e.internal('document/save/set-is-modified', { status });
				return;
			} catch (error) {
				console.warn('Elementor internal save state command failed, falling back:', error);
			}
		}

		if (typeof elementor !== 'undefined' && elementor.saver) {
			elementor.saver.setFlagEditorChange(status);
		}
	}

	resolveModel(widgetType, widgetId) {
		const modelKey = `${widgetType}_${widgetId}`;
		if (this.models[modelKey]) {
			return this.models[modelKey];
		}

		const currentPanelModel = elementor?.getPanelView?.()?.getCurrentPageView?.()?.model;
		if (currentPanelModel?.id === widgetId && typeof currentPanelModel.setSetting === 'function') {
			this.models[modelKey] = currentPanelModel;
			return currentPanelModel;
		}

		const containerModel = elementor?.getContainer?.(widgetId)?.model;
		if (containerModel && typeof containerModel.setSetting === 'function') {
			this.models[modelKey] = containerModel;
			return containerModel;
		}

		return null;
	}

	/**
	 * Initialize or update a widget instance.
	 *
	 * If the widget DOM was replaced (Elementor re-render), the old React root
	 * is unmounted and a new root is created. If the DOM is still connected,
	 * the existing instance is updated via its exposed setter.
	 *
	 * @param {string} widgetType
	 * @param {string} widgetId
	 * @param {HTMLElement} rootElement
	 * @param {Object} initialSettings
	 * @param {string} mode - 'display' (frontend) or 'edit' (editor)
	 * @return void
	 */
	init(widgetType, widgetId, rootElement, initialSettings, mode = 'display') {
		const widgetConfig = getWidgetConfig(widgetType);
		if (!widgetConfig) {
			return;
		}

		const instanceKey = `${widgetType}_${widgetId}`;
		const existingInstance = this.instances[instanceKey];
		
		// If DOM was replaced (Elementor re-render), unmount safely
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
			
			// Dynamically render the correct widget component from registry
			const WidgetComponent = widgetConfig.component;
			return <WidgetComponent widgetData={settings} widgetId={widgetId} mode={mode} />;
		};
		
		root.render(<App />);
		
		// Store instance data for future updates
		this.instances[instanceKey] = {
			root: root, // React root for unmounting
			rootElement: rootElement, // DOM element to check connection
			widgetType: widgetType, // Widget type for reference
			currentSettings: currentSettingsRef, // Current settings reference
			// Update settings without remounting
			updateSettings: (newSettings) => {
				currentSettingsRef = { ...currentSettingsRef, ...newSettings };
				if (setSettings) {
					setSettings(newSettings);
				}
			}
		};
	}

	/**
	 * Update an existing widget instance with new settings
	 * 
	 * @param {string} widgetType - Widget type
	 * @param {string} widgetId - Widget ID
	 * @param {Object} newSettings - New settings to merge
	 */
	updateInstance(widgetType, widgetId, newSettings) {
		const instanceKey = `${widgetType}_${widgetId}`;
		const instance = this.instances[instanceKey];

		// Update the React instance in-place if present and connected.
		if (
			instance &&
			instance.rootElement &&
			instance.rootElement.isConnected
		) {
			instance.updateSettings(newSettings);
			return;
		}
		// Otherwise leave initialization to the widget initializer.
		return;
	}

	/**
	 * Update Elementor model setting from React component
	 * Critical for saving custom layouts after drag/resize
	 * 
	 * @param {string} widgetType - Widget type
	 * @param {string} widgetId - Widget ID
	 * @param {string} settingName - Setting key to update
	 * @param {*} value - New value
	 * 
	 * @return void
	 */
	updateModelSetting(widgetType, widgetId, settingName, value) {
		const model = this.resolveModel(widgetType, widgetId);

		if (model && model.setSetting) {
			// Prefer Elementor command API to create proper undo/redo history entries.
			const $e = window.$e || window.parent?.$e;
			const elementorRef = typeof elementor !== 'undefined' ? elementor : window.parent?.elementor;
			const container = elementorRef?.getContainer?.(widgetId);

			if ($e && container) {
				try {
					$e.run('document/elements/settings', {
						container,
						settings: {
							[settingName]: value,
						},
					});
					return;
				} catch (error) {
					console.warn('History-aware setting command failed, falling back to setSetting:', error);
				}
			}

			// Fallback for older Elementor APIs.
			model.setSetting(settingName, value);
			this.markDocumentModified(true);
		} else {
			console.warn(`Model not found for ${widgetType} widget ${widgetId}`);
		}
	}

	/**
	 * Get current Elementor model for a widget (editor only).
	 * 
	 * @param {string} widgetType - Widget type
	 * @param {string} widgetId - Widget ID
	 * @returns {Object|null} Elementor model or null
	 */
	getModel(widgetType, widgetId) {
		const modelKey = `${widgetType}_${widgetId}`;
		return this.models[modelKey] || null;
	}
}

// Create singleton instance
const widgetManager = new WidgetManager();

// Expose globally for React components to access
window.MosaicContentsReact = widgetManager;

export default widgetManager;
