<?php
/**
 * Saved Setups Custom Control
 *
 * A custom Elementor control for saving, loading, and deleting layout+style setups.
 * Stores setup selections in wp_options via WP Settings API (REST).
 *
 * @package Micemade\MosaicContentsElementor\Controls
 */

namespace Micemade\MosaicContentsElementor\Controls;

use Elementor\Base_Data_Control;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Saved Setups Control class.
 *
 * Provides a UI in the Elementor panel for managing layout+style setups:
 * - Select dropdown to load a saved setup
 * - Text input + save button to save the current setup
 * - Delete button to remove the currently selected setup
 */
class Saved_Setups extends Base_Data_Control {

	/**
	 * Get control type.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return string Control type.
	 */
	public function get_type() {
		return 'mc4e_saved_setups';
	}

	/**
	 * Get default control settings.
	 *
	 * @since 1.0.0
	 * @access protected
	 * @return array Control default settings.
	 */
	protected function get_default_settings() {
		return array(
			'label_block' => true,
		);
	}

	/**
	 * Get control default value.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return string Default value (empty string = no setup selected).
	 */
	public function get_default_value() {
		return '';
	}

	/**
	 * Enqueue control scripts and styles.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function enqueue() {
		// Enqueue the React-based control script.
		wp_enqueue_script(
			'mc4e-saved-setups-control',
			plugins_url( 'assets/admin/js/saved-setups-control.js', dirname( __FILE__ ) ),
			array( 'jquery', 'react', 'react-dom', 'wp-api-fetch', 'wp-i18n' ),
			'1.0.0',
			true
		);

		// Enqueue the control styles.
		wp_enqueue_style(
			'mc4e-saved-setups-control',
			plugins_url( 'assets/admin/css/saved-setups-control.css', dirname( __FILE__ ) ),
			array(),
			'1.0.0'
		);
	}

	/**
	 * Render control output in the editor.
	 *
	 * Uses Underscore JS template. The React component mounts into
	 * the .mc4e-saved-setups-container element.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function content_template() {
		$control_uid = $this->get_control_uid();
		?>
<div class="elementor-control-field">
	<# if ( data.label ) { #>
		<label for="<?php echo esc_attr( $control_uid ); ?>" class="elementor-control-title">{{{ data.label }}}</label>
	<# } #>

	<div class="elementor-control-input-wrapper elementor-control-unit-5">
		<!-- Hidden input for Elementor data binding (stores selected setup ID) -->
		<input type="hidden"
			id="<?php echo esc_attr( $control_uid ); ?>"
			class="mc4e-saved-setups-value"
			data-setting="value"
			value="{{ data.controlValue }}" />

		<!-- React mount container -->
		<div class="mc4e-saved-setups-container"
			data-control-uid="<?php echo esc_attr( $control_uid ); ?>"
			data-initial-value="{{ data.controlValue }}">
		</div>
	</div>
</div>

<# if ( data.description ) { #>
	<div class="elementor-control-field-description">{{{ data.description }}}</div>
<# } #>
		<?php
	}
}
