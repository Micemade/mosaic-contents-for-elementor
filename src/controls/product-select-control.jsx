/**
 * Product Select Control Entry Point
 *
 * Registers a custom Elementor control that uses React Select's AsyncSelect
 * for searching and selecting WooCommerce products at scale.
 *
 * Runs in the Elementor editor panel (NOT the preview iframe).
 */

import './product-select-control.scss';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ProductSelectView from './ProductSelectView';

// Wait for Elementor to be ready.
window.addEventListener('elementor/init', () => {
	initProductSelectControl();
});

// Also try the standard event listener.
document.addEventListener('DOMContentLoaded', () => {
	if (typeof elementor !== 'undefined') {
		initProductSelectControl();
	}
});

/**
 * Initialize the product select control in Elementor.
 */
function initProductSelectControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) {
		return;
	}

	const BaseDataControl = elementor.modules.controls.BaseData;

	if (!BaseDataControl) {
		console.error('MC4E: BaseData control not found');
		return;
	}

	const ProductSelectControl = BaseDataControl.extend({
		/**
		 * Called when control is ready and rendered in the panel.
		 */
		onReady() {
			this.initProductSelect();
		},

		/**
		 * Initialize the React Select component.
		 */
		initProductSelect() {
			const container = this.$el.find('.mc4e-product-select-container');

			if (!container.length) {
				return;
			}

			// Get initial value from the data attribute.
			const initialValue = container.data('initial-value') || '';

			// Create a React root and render the component.
			const rootEl = container[0];
			this._reactRoot = createRoot(rootEl);

			this._reactRoot.render(
				<ProductSelectView
					initialValue={String(initialValue)}
					onChange={(productId) => this.onProductChange(productId)}
				/>
			);
		},

		/**
		 * Handle product selection change.
		 *
		 * @param {string} productId Selected product ID or empty string.
		 */
		onProductChange(productId) {
			// Update the hidden input.
			this.$el.find('.mc4e-product-select-value').val(productId);

			// Save value to Elementor.
			this.setValue(productId);
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
					<ProductSelectView
						initialValue={String(value || '')}
						onChange={(productId) =>
							this.onProductChange(productId)
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
	elementor.addControlView('mc4e_product_select', ProductSelectControl);
}
