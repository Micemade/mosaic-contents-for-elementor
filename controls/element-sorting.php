<?php
/**
 * Custom Elementor sorter label control.
 *
 * A read-only label control used inside a Repeater to enable drag-to-reorder
 * of product/category elements (title, price, rating, etc.).
 * The label text comes from repeater default data and cannot be edited by the user.
 *
 * Based on the sorter control pattern from Micemade Elements.
 *
 * @package Micemade\MosaicProductLayoutsElementor\Controls
 */

namespace Micemade\MosaicProductLayoutsElementor\Controls;

use Elementor\Base_Data_Control;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Element Sorting Control class.
 *
 * Renders a hidden input with a visible label inside a Repeater row.
 * Users reorder rows via drag-and-drop to control element display order.
 */
class Element_Sorting extends Base_Data_Control {

	/**
	 * Get control type.
	 *
	 * @since 1.0.0
	 * @access public
	 * @return string Control type.
	 */
	public function get_type() {
		return 'mpl4e_sorter_label';
	}

	/**
	 * Get control default settings.
	 *
	 * @since 1.0.0
	 * @access protected
	 * @return array Control default settings.
	 */
	protected function get_default_settings() {
		return array(
			'label_block' => true,
			'default'     => '',
		);
	}

	/**
	 * Render control output in the editor.
	 *
	 * Uses Underscore JS template to display the label and a hidden input.
	 * The hidden input stores the sorter value for Elementor's data model.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function content_template() {
		$control_uid = $this->get_control_uid();
		?>
<div class="elementor-control-field">
	<label for="<?php echo esc_attr( $control_uid ); ?>" class="elementor-control-title">{{{ data.label }}}</label>
	<div class="elementor-control-input-wrapper">
		<input id="<?php echo esc_attr( $control_uid ); ?>" type="hidden" data-setting="{{ data.name }}" readonly>
	</div>
</div>
<# if ( data.description ) { #>
	<div class="elementor-control-field-description">{{{ data.description }}}</div>
<# } #>
		<?php
	}
}
