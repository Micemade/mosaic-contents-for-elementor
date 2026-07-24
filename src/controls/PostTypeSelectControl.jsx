/**
 * Post type Select Control Entry Point
 *
 * Registers a custom Elementor control that uses React Select's AsyncSelect
 * for searching and selecting WooCommerce products at scale.
 *
 * Runs in the Elementor editor panel (NOT the preview iframe).
 */

import './PostTypeSelectControl.scss';
import React from 'react';
import { createRoot } from 'react-dom/client';
import PostTypeSelectView from './PostTypeSelectView';

// Wait for Elementor to be ready.
window.addEventListener('elementor/init', () => {
	initPosttypeSelectControl();
});

// Also try the standard event listener.
document.addEventListener('DOMContentLoaded', () => {
	if (typeof elementor !== 'undefined') {
		initPosttypeSelectControl();
	}
});

/**
 * Initialize the post type select control in Elementor.
 */
function initPosttypeSelectControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) {
		return;
	}

	const BaseDataControl = elementor.modules.controls.BaseData;

	if (!BaseDataControl) {
		console.error('Mosaic Contents for Elementor: BaseData control not found');
		return;
	}

	const PostTypeSelectControl = BaseDataControl.extend({
		/**
		 * Called when control is ready and rendered in the panel.
		 */
		onReady() {
			this.initPostTypeSelect();
		},

		/**
		 * Initialize the React Select component.
		 */
		initPostTypeSelect() {
			const container = this.$el.find('.mc4e-posttype-select-container');

			if (!container.length) {
				return;
			}

			// Get initial value from the data attribute.
			const initialValue = container.data('initial-value') || '';

			// Create a React root and render the component.
			const rootEl = container[0];
			this._reactRoot = createRoot(rootEl);

			this._reactRoot.render(
				<PostTypeSelectView
					initialValue={String(initialValue)}
					onChange={(postTypeId) => this.onPostTypeChange(postTypeId)}
				/>
			);
		},

		/**
		 * Handle post type selection change.
		 *
		 * @param {string} postTypeId Selected post type ID or empty string.
		 */
		onPostTypeChange(postTypeId) {
			// Update the hidden input.
			this.$el.find('.mc4e-posttype-select-value').val(postTypeId);

			// Save value to Elementor.
			this.setValue(postTypeId);
		},

		/**
		 * Apply saved value when control is rendered.
		 */
		applySavedValue() {
			BaseDataControl.prototype.applySavedValue.apply(this, arguments);

			const value = this.getControlValue();

			// Re-render with the current value if the React root exists.
			if (this._reactRoot) {
				this._reactRoot.render(
					<PostTypeSelectView
						initialValue={String(value || '')}
						onChange={(postTypeId) =>
							this.onPostTypeChange(postTypeId)
						}
					/>
				);
			}
		},

		/**
		 * Cleanup when control is destroyed.
		 */
		onBeforeDestroy() {
			if (this._reactRoot) {
				this._reactRoot.unmount();
				this._reactRoot = null;
			}
		},
	});

	// Register the control view with Elementor.
	elementor.addControlView('mc4e_posttype_select', PostTypeSelectControl);
}
