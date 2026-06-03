<?php
/**
 * Post Type Select Custom Control
 *
 * A custom Elementor control for selecting a post type using
 * React Select's async capabilities. Designed to scale with large post catalogs.
 *
 * - Initial load: 50 most recent posts
 * - Async search: Triggered when user types 2+ characters
 * - Debounced: 300ms debounce on search input
 *
 * @package Micemade\MosaicContentsElementor\Controls
 */

namespace Micemade\MosaicContentsElementor\Controls;

use Elementor\Base_Data_Control;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Post Type Select Control class.
 *
 * Renders an async React Select component in the Elementor panel
 * for searching and selecting post types.
 */
class Posttype_Select extends Base_Data_Control {

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
		return 'mc4e_posttype_select';
	}

	/**
	 * Get default control settings.
	 *
	 * Returns the default settings for the post type select control.
	 *
	 * @since 1.0.0
	 * @access protected
	 *
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
	 * Returns the default value (empty string = no post type selected).
	 *
	 * @since 1.0.0
	 * @access public
	 *
	 * @return string Default value.
	 */
	public function get_default_value() {
		return '';
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
		// Enqueue the React-based control script.
		wp_enqueue_script(
			'mc4e-PostTypeSelectControl',
			plugins_url( 'assets/admin/js/PostTypeSelectControl.js', dirname( __FILE__ ) ),
			array( 'jquery', 'react', 'react-dom', 'wp-api-fetch', 'wp-i18n' ),
			'1.0.0',
			true
		);

		// Enqueue the control styles.
		wp_enqueue_style(
			'mc4e-PostTypeSelectControl',
			plugins_url( 'assets/admin/css/PostTypeSelectControl.css', dirname( __FILE__ ) ),
			array(),
			'1.0.0'
		);
	}

	/**
	 * Render control output in the editor.
	 *
	 * Uses Underscore JS template. The React component mounts into
	 * the .mc4e-posttype-select-container element.
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
				<!-- Hidden input for Elementor data binding (stores selected post type) -->
				<input type="hidden" id="<?php echo esc_attr( $control_uid ); ?>" class="mc4e-posttype-select-value"
					data-setting="value" value="{{ data.controlValue }}" />

				<!-- React mount container -->
				<div class="mc4e-posttype-select-container" data-control-uid="<?php echo esc_attr( $control_uid ); ?>"
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
