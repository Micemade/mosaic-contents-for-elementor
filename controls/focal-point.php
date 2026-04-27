<?php
/**
 * Focal Point Custom Control
 *
 * A custom Elementor control for selecting X/Y position using a focal point picker.
 * Used for positioning elements like sale badges within their parent container.
 *
 * @package Micemade\MosaicLayoutsElementor\Controls
 */

namespace Micemade\MosaicLayoutsElementor\Controls;

use Elementor\Base_Data_Control;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Focal Point Control class.
 *
 * Provides a visual focal point picker that outputs x/y coordinates as percentages.
 * Useful for positioning overlays, badges, and other elements.
 */
class Focal_Point extends Base_Data_Control {

	/**
	 * Get control type.
	 *
	 * Returns the unique identifier for this control type.
	 *
	 * @since 1.0.0
	 * @access public
	 *
	 * @return string Control type.
	 */
	public function get_type() {
		return 'ml4e_focal_point';
	}

	/**
	 * Get default control settings.
	 *
	 * Returns the default settings for the focal point control.
	 *
	 * @since 1.0.0
	 * @access protected
	 *
	 * @return array Control default settings.
	 */
	protected function get_default_settings() {
		return array(
			'label_block' => true,
			'preview_image' => '', // Optional preview image URL
		);
	}

	/**
	 * Get control default value.
	 *
	 * Returns the default value for the focal point (centered).
	 *
	 * @since 1.0.0
	 * @access public
	 *
	 * @return array Default value { x: 50, y: 50 }.
	 */
	public function get_default_value() {
		return array(
			'x' => 50,
			'y' => 50,
		);
	}

	/**
	 * Enqueue control scripts and styles.
	 *
	 * Used to register and enqueue custom scripts and styles used by the control.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function enqueue() {
		// Enqueue the React-based control script
		wp_enqueue_script(
			'ml4e-focal-point-control',
			plugins_url( 'assets/admin/js/focal-point-control.js', dirname( __FILE__ ) ),
			array( 'jquery', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		// Enqueue the control styles
		wp_enqueue_style(
			'ml4e-focal-point-control',
			plugins_url( 'assets/admin/css/focal-point-control.css', dirname( __FILE__ ) ),
			array(),
			'1.0.0'
		);
	}

	/**
	 * Render control output in the editor.
	 *
	 * Used to generate the control HTML in the editor using Underscore JS template.
	 * The React component will mount into the .ml4e-focal-point-container element.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function content_template() {
		$control_uid = $this->get_control_uid();
		$x_uid = $this->get_control_uid( 'x' );
		$y_uid = $this->get_control_uid( 'y' );
		?>
<div class="elementor-control-field">
	<# if ( data.label ) { #>
		<label for="<?php echo esc_attr( $control_uid ); ?>" class="elementor-control-title">{{{ data.label }}}</label>
		<# } #>

			<div class="elementor-control-input-wrapper elementor-control-unit-5">
				<# var xValue=data.controlValue && typeof data.controlValue.x !=='undefined' ? data.controlValue.x : 50;
					var yValue=data.controlValue && typeof data.controlValue.y !=='undefined' ? data.controlValue.y :
					50; #>

					<!-- Hidden inputs for Elementor data binding -->
					<input type="hidden" id="<?php echo esc_attr( $x_uid ); ?>" class="ml4e-focal-point-x"
						data-setting="x" value="{{ xValue }}" />
					<input type="hidden" id="<?php echo esc_attr( $y_uid ); ?>" class="ml4e-focal-point-y"
						data-setting="y" value="{{ yValue }}" />

					<!-- React mount container -->
					<div class="ml4e-focal-point-container" data-control-uid="<?php echo esc_attr( $control_uid ); ?>"
						data-initial-x="{{ xValue }}" data-initial-y="{{ yValue }}"
						data-preview-image="{{ data.preview_image }}">
					</div>

					<!-- Value display -->
					<div class="ml4e-focal-point-values">
						<span class="ml4e-focal-point-value">
							X: <span class="ml4e-x-value">{{ xValue }}</span>%
						</span>
						<span class="ml4e-focal-point-value">
							Y: <span class="ml4e-y-value">{{ yValue }}</span>%
						</span>
					</div>
			</div>
</div>

<# if ( data.description ) { #>
	<div class="elementor-control-field-description">{{{ data.description }}}</div>
	<# } #>
		<?php
	}
}
