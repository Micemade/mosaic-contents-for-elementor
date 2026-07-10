<?php
/**
 * Meta Key Select Custom Control
 *
 * A custom Elementor control for selecting a post meta key using React Select's
 * async capabilities. Used inside the Content Layout "Post Meta Display" repeater:
 * it lists the available (non-protected) meta keys for the widget's selected post
 * type and lets the user search and pick one.
 *
 * @package Micemade\MosaicContentsElementor\Controls
 */

namespace Micemade\MosaicContentsElementor\Controls;

use Elementor\Base_Data_Control;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Meta Key Select Control class.
 *
 * Renders an async React Select component in the Elementor panel for searching
 * and selecting a post meta key scoped to the current post type.
 */
class Meta_Key_Select extends Base_Data_Control {

	/**
	 * Get control type.
	 *
	 * @return string Control type.
	 */
	public function get_type() {
		return 'mc4e_meta_key_select';
	}

	/**
	 * Get default control settings.
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
	 * @return string Default value (empty string = no key selected).
	 */
	public function get_default_value() {
		return '';
	}

	/**
	 * Enqueue control scripts and styles.
	 */
	public function enqueue() {
		wp_enqueue_script(
			'mc4e-MetaKeySelectControl',
			plugins_url( 'assets/admin/js/MetaKeySelectControl.js', dirname( __FILE__ ) ),
			array( 'jquery', 'react', 'react-dom', 'wp-api-fetch', 'wp-i18n' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'mc4e-MetaKeySelectControl',
			plugins_url( 'assets/admin/css/MetaKeySelectControl.css', dirname( __FILE__ ) ),
			array(),
			'1.0.0'
		);
	}

	/**
	 * Render control output in the editor.
	 *
	 * The React component mounts into the .mc4e-metakey-select-container element.
	 */
	public function content_template() {
		$control_uid = $this->get_control_uid();
		?>
<div class="elementor-control-field">
	<# if ( data.label ) { #>
		<label for="<?php echo esc_attr( $control_uid ); ?>" class="elementor-control-title">{{{ data.label }}}</label>
		<# } #>

			<div class="elementor-control-input-wrapper elementor-control-unit-5">
				<!-- Hidden input for Elementor data binding (stores selected meta key) -->
				<input type="hidden" id="<?php echo esc_attr( $control_uid ); ?>" class="mc4e-metakey-select-value"
					data-setting="value" value="{{ data.controlValue }}" />

				<!-- React mount container -->
				<div class="mc4e-metakey-select-container" data-control-uid="<?php echo esc_attr( $control_uid ); ?>"
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
