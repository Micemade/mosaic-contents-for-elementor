<?php

namespace Micemade\MosaicContentsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Micemade\MosaicContentsElementor\WidgetHelpers;

/**
 * Widgets Layout — hosts any Elementor widget inside each grid cell.
 *
 * Grid structure (predefined + custom) is the same as Content Layout.
 *
 * Inner widgets are real Elementor elements that live in a hidden sibling
 * "holding" container; mc4e_widget_items only stores each cell's widget ids and
 * order ([{ i, widgets: [{ id, type }] }]). React renders the grid and
 * re-parents each real element's DOM into its cell (in the editor and on the
 * frontend), so the widgets stay natively editable and persist through
 * Elementor's own save pipeline.
 */
class WidgetsLayout extends Widget_Base {

	use WidgetHelpers;

	public function get_name() {
		return 'widgets-layout';
	}

	public function get_title() {
		return __( 'Widgets Layout', 'mosaic-contents-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-inner-section';
	}

	public function get_categories() {
		return array( 'mosaic-contents' );
	}

	/**
	 * Register widget controls.
	 */
	public function register_controls() {

		// ── Layout Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$this->add_control(
			'mc4e_layout',
			array(
				'label'       => __( 'Predefined Layouts', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'default',
				'options'     => $this->get_layout_options( 'widgets-layout' ),
				'description' => __( 'Choose a predefined layout for the grid cells.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_custom_layout',
			array(
				'label'   => __( 'Custom Layout', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->add_control(
			'mc4e_reset_layout',
			array(
				'label'       => __( 'Reset to Predefined Layout', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::BUTTON,
				'text'        => __( 'Reset Layout', 'mosaic-contents-for-elementor' ),
				'description' => __( 'Clear layout modifications and restore the selected predefined layout.', 'mosaic-contents-for-elementor' ),
				'event'       => 'mosaic:resetLayout',
			)
		);

		$this->add_control(
			'mc4e_add_item',
			array(
				'label'       => __( 'Add Item', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::BUTTON,
				'text'        => __( 'Add Item', 'mosaic-contents-for-elementor' ),
				'description' => __( 'Add a new empty grid cell.', 'mosaic-contents-for-elementor' ),
				'event'       => 'mosaic:addItem',
			)
		);

		$this->add_control(
			'mc4e_items_margin',
			array(
				'label'   => __( 'Grid Gap', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SLIDER,
				'range'   => array(
					'px' => array(
						'min' => 0,
						'max' => 50,
					),
				),
				'default' => array(
					'size' => 15,
					'unit' => 'px',
				),
			)
		);

		$this->add_control(
			'mc4e_row_height',
			array(
				'label'   => __( 'Grid Row Height', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SLIDER,
				'range'   => array(
					'px' => array(
						'min' => 1,
						'max' => 30,
					),
				),
				'default' => array(
					'size' => 5,
					'unit' => 'px',
				),
			)
		);

		$this->add_control(
			'mc4e_allow_overlap',
			array(
				'label'        => __( 'Allow Overlap', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-contents-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-contents-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'mc4e_compaction_type',
			array(
				'label'     => __( 'Compaction Type', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'vertical',
				'options'   => array(
					'vertical'   => __( 'Vertical', 'mosaic-contents-for-elementor' ),
					'horizontal' => __( 'Horizontal', 'mosaic-contents-for-elementor' ),
					'none'       => __( 'None', 'mosaic-contents-for-elementor' ),
				),
				'condition' => array(
					'mc4e_allow_overlap!' => 'yes',
				),
			)
		);

		$this->add_control(
			'mc4e_helper_notice',
			array(
				'type'         => Controls_Manager::NOTICE,
				'notice_type'  => 'info',
				'dismissible'  => false,
				'heading'      => esc_html__( 'Helpers', 'mosaic-contents-for-elementor' ),
				'content'      => esc_html__( 'Visual aid — a grid visualization for placing and resizing cells.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_helper_grid',
			array(
				'label'   => __( 'Grid Visualization', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'none',
				'options' => array(
					'none'   => __( 'None', 'mosaic-contents-for-elementor' ),
					'front'  => __( 'Front', 'mosaic-contents-for-elementor' ),
					'behind' => __( 'Behind', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		// Hidden storage for inner widget items (JSON string).
		// Format: [{"i":"item-0","html":"<rendered>","type":"heading"},...]
		$this->add_control(
			'mc4e_widget_items',
			array(
				'label'   => __( 'Widget Items', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->end_controls_section();

		// ── Cell Style Section ────────────────────────────────────────────
		$this->start_controls_section(
			'cell_style_section',
			array(
				'label' => esc_html__( 'Cell Style', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'     => 'mc4e_cell_background',
				'label'    => esc_html__( 'Background', 'mosaic-contents-for-elementor' ),
				'types'    => array( 'classic', 'gradient' ),
				'selector' => '{{WRAPPER}} .wl-item-inner',
			)
		);

		$this->add_responsive_control(
			'mc4e_cell_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem' ),
				'selectors'  => array(
					'{{WRAPPER}} .wl-item-inner' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
				'default'    => array(
					'top'      => '15',
					'right'    => '15',
					'bottom'   => '15',
					'left'     => '15',
					'unit'     => 'px',
					'isLinked' => true,
				),
			)
		);

		$this->add_control(
			'mc4e_cell_border_radius',
			array(
				'label'      => __( 'Border Radius', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .wl-item-inner' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'mc4e_cell_border',
				'selector' => '{{WRAPPER}} .wl-item-inner',
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'mc4e_cell_box_shadow',
				'selector' => '{{WRAPPER}} .wl-item-inner',
			)
		);

		$this->end_controls_section();

		// ── Per-Cell Style Section ────────────────────────────────────────
		// A repeater with one (auto-managed) item per GridLayout cell. The React
		// component adds `elementor-repeater-item-{_id}` to the matching cell's
		// .wl-item-inner, so {{CURRENT_ITEM}} targets that cell. Any field left
		// empty falls back to the global Cell Style above (CSS specificity).
		$this->start_controls_section(
			'per_cell_style_section',
			array(
				'label' => esc_html__( 'Per-Cell Style', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'mc4e_per_cell_notice',
			array(
				'type'        => Controls_Manager::NOTICE,
				'notice_type' => 'info',
				'dismissible' => false,
				'content'     => esc_html__( 'One item per grid cell is managed automatically. Empty fields fall back to the Cell Style settings.', 'mosaic-contents-for-elementor' ),
			)
		);

		$cell_repeater = new Repeater();

		// Stores the GridLayout cell id (e.g. "item-0"); managed by React.
		$cell_repeater->add_control(
			'cell_id',
			array(
				'label'   => __( 'Cell', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$cell_repeater->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'     => 'cell_background',
				'label'    => esc_html__( 'Background', 'mosaic-contents-for-elementor' ),
				'types'    => array( 'classic', 'gradient' ),
				'selector' => '{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner',
			)
		);

		$cell_repeater->add_responsive_control(
			'cell_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem' ),
				'selectors'  => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$cell_repeater->add_control(
			'cell_text_color',
			array(
				'label'     => __( 'Text Color', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner' => 'color: {{VALUE}};',
				),
			)
		);

		$cell_repeater->add_control(
			'cell_links_color',
			array(
				'label'     => __( 'Links Color', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner a' => 'color: {{VALUE}};',
				),
			)
		);

		$cell_repeater->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'cell_border',
				'selector' => '{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner',
			)
		);

		$cell_repeater->add_control(
			'cell_border_radius',
			array(
				'label'      => __( 'Border Radius', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$cell_repeater->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'cell_box_shadow',
				'selector' => '{{WRAPPER}} {{CURRENT_ITEM}}.wl-item-inner',
			)
		);

		$this->add_control(
			'mc4e_cell_styles',
			array(
				'label'        => __( 'Cells', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::REPEATER,
				'fields'       => $cell_repeater->get_controls(),
				'title_field'  => 'Cell {{{ cell_id }}}',
				'prevent_empty' => false,
				'default'      => array(),
			)
		);

		$this->end_controls_section();
	}


}
