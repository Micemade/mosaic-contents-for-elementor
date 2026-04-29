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
 * @package Micemade\MosaicContentsElementor\Controls
 */

namespace Micemade\MosaicContentsElementor\Controls;

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
		return 'mc4e_sorter_label';
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
	 * Enqueue control scripts.
	 *
	 * Registers a Backbone view for mc4e_sorter_label in the Elementor panel.
	 * Without this, Elementor 3.26+ (container architecture) fails to initialise
	 * the container for repeater items that contain this control, causing all
	 * other controls in the same row (e.g. visibility SWITCHERs) to throw:
	 *   "can't access property validators, this.container.settings is undefined"
	 * which prevents visibility changes from being saved to the model.
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function enqueue() {
		wp_add_inline_script(
			'elementor-editor',
			'(function(){
	function registerSorterLabelView(){
		if("undefined"===typeof elementor||!elementor.modules)return;
		var Base=elementor.modules.controls.BaseData;
		if(!Base)return;
		elementor.addControlView("mc4e_sorter_label",Base.extend({
			onBaseInputChange:function(){}
		}));
	}
	window.addEventListener("elementor/init",registerSorterLabelView);
	if("undefined"!==typeof elementor){registerSorterLabelView();}
}());'
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