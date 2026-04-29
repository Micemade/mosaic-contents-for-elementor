/**
 * Focal Point Control Entry Point
 * 
 * This file is the entry point for the Elementor editor focal point control.
 * It initializes the React-based focal point picker in the Elementor editor panel.
 */

import './focal-point-control.scss';
import { FocalPointControlView } from './FocalPointControlView';

// Wait for Elementor to be ready
window.addEventListener('elementor/init', () => {
	initFocalPointControl();
});

// Also try the standard event listener
document.addEventListener('DOMContentLoaded', () => {
	// Check if we're in Elementor editor context
	if (typeof elementor !== 'undefined') {
		initFocalPointControl();
	}
});

/**
 * Initialize the focal point control in Elementor
 */
function initFocalPointControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) {
		return;
	}

	// Extend Elementor's BaseData control to create our focal point control
	const BaseDataControl = elementor.modules.controls.BaseData;
	
	if (!BaseDataControl) {
		console.error('MC4E: BaseData control not found');
		return;
	}

	const FocalPointControl = BaseDataControl.extend({
		/**
		 * Called when control is ready and rendered in the panel
		 */
		onReady() {
			this.initializeFocalPoint();
		},

		/**
		 * Initialize the focal point picker
		 */
		initializeFocalPoint() {
			const container = this.$el.find('.mc4e-focal-point-container');
			
			if (!container.length) {
				return;
			}

			// Get initial values
			const initialX = parseFloat(container.data('initial-x')) || 50;
			const initialY = parseFloat(container.data('initial-y')) || 50;
			const previewImage = container.data('preview-image') || '';

			// Create the React-based control view
			this.focalPointView = new FocalPointControlView({
				container: container[0],
				initialX,
				initialY,
				previewImage,
				onChange: (x, y) => this.onFocalPointChange(x, y),
			});

			this.focalPointView.render();
		},

		/**
		 * Handle focal point value changes
		 * @param {number} x - X position (0-100)
		 * @param {number} y - Y position (0-100)
		 */
		onFocalPointChange(x, y) {
			// Round values
			const roundedX = Math.round(x);
			const roundedY = Math.round(y);

			// Update hidden inputs
			this.$el.find('.mc4e-focal-point-x').val(roundedX);
			this.$el.find('.mc4e-focal-point-y').val(roundedY);

			// Update value display
			this.$el.find('.mc4e-x-value').text(roundedX);
			this.$el.find('.mc4e-y-value').text(roundedY);

			// Save value to Elementor
			this.setValue({
				x: roundedX,
				y: roundedY,
			});
		},

		/**
		 * Apply saved value when control is rendered
		 */
		applySavedValue() {
			BaseDataControl.prototype.applySavedValue.apply(this, arguments);
			
			const value = this.getControlValue();
			
			if (value && this.focalPointView) {
				this.focalPointView.updatePosition(value.x || 50, value.y || 50);
			}
		},

		/**
		 * Cleanup when control is destroyed
		 */
		onBeforeDestroy() {
			if (this.focalPointView) {
				this.focalPointView.destroy();
				this.focalPointView = null;
			}
		},
	});

	// Register the control view with Elementor
	elementor.addControlView('mc4e_focal_point', FocalPointControl);
}
