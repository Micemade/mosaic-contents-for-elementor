<?php

namespace Micemade\MosaicProductLayoutsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Typography;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Micemade\MosaicProductLayoutsElementor\WidgetHelpers;

/**
 * Products Layout Widget for Elementor.
 *
 * Displays WooCommerce products using React rendering with WC Store API.
 * Query settings are passed to React via content_template hidden input.
 */
class ProductsLayout extends Widget_Base {

	use WidgetHelpers;

	public function __construct( $data = array(), $args = null ) {
		parent::__construct( $data, $args );
	}

	public function get_style_depends() {
		return array( 'custom-widget-css' );
	}

	public function get_script_depends() {
		return array( 'custom-widget-js' );
	}

	public function get_name() {
		return 'products-layout';
	}

	public function get_title() {
		return __( 'Products Layout', 'mosaic-product-layouts-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-products';
	}

	public function get_categories() {
		return array( 'micemade-widgets' );
	}



	/**
	 * Get product categories for select control.
	 *
	 * @return array Associative array of term_id => name.
	 */
	private function get_product_categories() {
		$categories = array();

		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return $categories;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => true,
			)
		);

		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			foreach ( $terms as $term ) {
				// SELECT2 requires string keys.
				$categories[ (string) $term->term_id ] = $term->name;
			}
		}

		return $categories;
	}

	/**
	 * Register widget controls.
	 */
	public function register_controls() {

		// ── Content Section - Query Settings ──────────────────────────────
		$this->start_controls_section(
			'query_section',
			array(
				'label' => __( 'Query Settings', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mpl4e_orderby',
			array(
				'label'   => __( 'Order By', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'date',
				'options' => array(
					'date'       => __( 'Date', 'mosaic-product-layouts-for-elementor' ),
					'title'      => __( 'Title', 'mosaic-product-layouts-for-elementor' ),
					'price'      => __( 'Price', 'mosaic-product-layouts-for-elementor' ),
					'popularity' => __( 'Popularity', 'mosaic-product-layouts-for-elementor' ),
					'rating'     => __( 'Rating', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mpl4e_order',
			array(
				'label'   => __( 'Order', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'desc',
				'options' => array(
					'desc' => __( 'Descending', 'mosaic-product-layouts-for-elementor' ),
					'asc'  => __( 'Ascending', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mpl4e_category',
			array(
				'label'       => __( 'Categories', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT2,
				'default'     => array(),
				'options'     => $this->get_product_categories(),
				'multiple'    => true,
				'label_block' => true,
			)
		);

		$this->add_control(
			'mpl4e_on_sale',
			array(
				'label'        => __( 'On Sale Only', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'mpl4e_featured',
			array(
				'label'        => __( 'Featured Only', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'mpl4e_enable_pagination',
			array(
				'label'        => __( 'Enable Pagination', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();

		// ── Layout Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$this->add_control(
			'mpl4e_layout',
			array(
				'label'       => __( 'Predefined Layouts', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'layout-1',
				'options'     => array(
					'layout-1'  => __( 'Layout 1 (3 items - Equal)', 'mosaic-product-layouts-for-elementor' ),
					'layout-2'  => __( 'Layout 2 (3 items - Staggered)', 'mosaic-product-layouts-for-elementor' ),
					'layout-3'  => __( 'Layout 3 (3 items - Featured Left)', 'mosaic-product-layouts-for-elementor' ),
					'layout-4'  => __( 'Layout 4 (3 items - Asymmetric)', 'mosaic-product-layouts-for-elementor' ),
					'layout-5'  => __( 'Layout 5 (3 items - Overlap)', 'mosaic-product-layouts-for-elementor' ),
					'layout-6'  => __( 'Layout 6 (3 items - Compact)', 'mosaic-product-layouts-for-elementor' ),
					'layout-7'  => __( 'Layout 7 (3 items - Hero Left)', 'mosaic-product-layouts-for-elementor' ),
					'layout-8'  => __( 'Layout 8 (3 items - Variable Width)', 'mosaic-product-layouts-for-elementor' ),
					'layout-9'  => __( 'Layout 9 (3 items - Mixed)', 'mosaic-product-layouts-for-elementor' ),
					'layout-10' => __( 'Layout 10 (4 items - Equal Grid)', 'mosaic-product-layouts-for-elementor' ),
					'layout-11' => __( 'Layout 11 (4 items - Featured)', 'mosaic-product-layouts-for-elementor' ),
					'layout-12' => __( 'Layout 12 (4 items - Mosaic)', 'mosaic-product-layouts-for-elementor' ),
					'layout-13' => __( 'Layout 13 (4 items - Banner Bottom)', 'mosaic-product-layouts-for-elementor' ),
					'layout-14' => __( 'Layout 14 (4 items - Sidebar)', 'mosaic-product-layouts-for-elementor' ),
				),
				'description' => __( 'Choose a predefined layout for the product grid. Layouts 1-9 display 3 items, Layouts 10-14 display 4 items.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_custom_layout',
			array(
				'label'       => __( 'Custom Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::HIDDEN,
				'default'     => '',
				'description' => __( 'Stores custom layout data when you drag/resize items in the editor.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_reset_layout',
			array(
				'label'        => __( 'Reset to Predefined Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Reset Layout', 'mosaic-product-layouts-for-elementor' ),
				'description'  => __( 'Clear layout modifications and restore the selected predefined layout.', 'mosaic-product-layouts-for-elementor' ),
				'event'        => 'mosaic:resetLayout',
			)
		);

		$this->add_control(
			'mpl4e_add_item',
			array(
				'label'        => __( 'Add Item', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Add Item', 'mosaic-product-layouts-for-elementor' ),
				'description'  => __( 'Add a new item to the layout.', 'mosaic-product-layouts-for-elementor' ),
				'event'        => 'mosaic:addItem',
			)
		);

		$this->add_control(
			'mpl4e_items_margin',
			array(
				'label'   => __( 'Grid Gap', 'mosaic-product-layouts-for-elementor' ),
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
			'mpl4e_row_height',
			array(
				'label'   => __( 'Grid Row Height', 'mosaic-product-layouts-for-elementor' ),
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
			'mpl4e_allow_overlap',
			array(
				'label'        => __( 'Allow Overlap', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => __( 'Allow grid items to overlap each other.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_compaction_type',
			array(
				'label'       => __( 'Compaction Type', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'vertical',
				'options'     => array(
					'vertical'   => __( 'Vertical', 'mosaic-product-layouts-for-elementor' ),
					'horizontal' => __( 'Horizontal', 'mosaic-product-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-product-layouts-for-elementor' ),
				),
				'description' => __( 'How items compact when moved. "None" keeps items in place.', 'mosaic-product-layouts-for-elementor' ),
				'condition'   => array(
					'mpl4e_allow_overlap!' => 'yes',
				),
			)
		);


		$this->add_control(
			'mpl4e_helper_notice',
			array(
				'type' => \Elementor\Controls_Manager::NOTICE,
				'notice_type' => 'info',
				'dismissible' => false,
				'heading' => esc_html__( 'Helpers', 'mosaic-product-layouts-for-elementor' ),
				'content' => esc_html__( 'Visual aid - a grid visualization for placing and resizing items.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_helper_grid',
			array(
				'label'        => __( 'Grid Visualization', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SELECT,
				'default'      => 'none',
				'options'      => array(
					'none'   => __( 'None', 'mosaic-product-layouts-for-elementor' ),
					'front'  => __( 'Front', 'mosaic-product-layouts-for-elementor' ),
					'behind' => __( 'Behind', 'mosaic-product-layouts-for-elementor' ),
				),
				'description'  => __( 'Visual aid for underlying grid structure.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Saved Setups Section ──────────────────────────────────────────
		$this->start_controls_section(
			'saved_setups_section',
			array(
				'label' => __( 'Saved Setups', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mpl4e_saved_setup',
			array(
				'label'       => __( 'Layout & Style Setups', 'mosaic-product-layouts-for-elementor' ),
				'description' => __( 'Save, load, or delete layout and style configurations.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_saved_setups',
				'default'     => '',
			)
		);

		$this->end_controls_section();

		// ── Element Ordering Section ───────────────────────────────────────
		$this->register_element_ordering_controls(
			'mpl4e_element_ordering',
			__( 'Element Order & Visibility', 'mosaic-product-layouts-for-elementor' ),
			array(
				$this->default_elements_visibility(
					__( 'Title', 'mosaic-product-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Price', 'mosaic-product-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Rating', 'mosaic-product-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Add to Cart', 'mosaic-product-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Categories', 'mosaic-product-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Brands', 'mosaic-product-layouts-for-elementor' ),
					array( false, false, false, false, false )
				),
			)
		);

		// ── Style Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'product_style_settings_section',
			[
				'label' => esc_html__( 'Product Card Style', 'mosaic-product-layouts-for-elementor' ),
				'tab' => \Elementor\Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'mpl4e_style_preset',
			array(
				'label'       => esc_html__( 'Style Preset', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::VISUAL_CHOICE,
				'columns'     => 4,
				'label_block' => true,
				'default'     => '',
				'options'     => $this->get_style_preset_options( 'products-layout' ),
				'description' => esc_html__( 'Pick a preset to instantly apply a complete style pack.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_style_preset_divider',
			array(
				'type' => Controls_Manager::DIVIDER,
			)
		);
/* 
		$this->add_control(
			'popover-toggle-test',
			[
				'label' => esc_html__( 'Popover test', 'mosaic-product-layouts-for-elementor' ),
				'type' => \Elementor\Controls_Manager::POPOVER_TOGGLE,
				'label_off' => esc_html__( 'Default', 'mosaic-product-layouts-for-elementor' ),
				'label_on' => esc_html__( 'Custom', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
			]
		);
		$this->start_popover();
		$this->add_control(
				'popover_content',
				array(
					'type'            => Controls_Manager::RAW_HTML,
					'raw'             =>  __( '<strong>JUST AN EMPTY POPOVER', 'mosaic-product-layouts-for-elementor' ) ,
					'separator'       => 'after',
					'content_classes' => 'elementor-panel-alert elementor-panel-alert-info',
				)
			);
		$this->end_popover();
		 */

		// ACTIVE, HOVER, INACTIVE.
		$this->start_controls_tabs( 'product_styles' );

		// Product text controls tab.
		$this->start_controls_tab(
			'product_text_sizes_tab',
			array(
				'label' => esc_html__( 'Text', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mpl4e_title_size',
			array(
				'label'     => esc_html__( 'Title size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'   => array(
					'size' => 24,
					'unit' => 'px',
				),
				'tablet_default' => [
					'size' => 22,
					'unit' => 'px',
				],
				'mobile_default' => [
					'size' => 20,
					'unit' => 'px',
				],
				'range'     => self::get_range(),
				'selectors' => array(
					'{{WRAPPER}} .product-elements .name' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_price_size',
			array(
				'label'     => esc_html__( 'Price size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'   => array(
					'size' => 20,
					'unit' => 'px',
				),
				'tablet_default' => [
					'size' => 18,
					'unit' => 'px',
				],
				'mobile_default' => [
					'size' => 18,
					'unit' => 'px',
				],
				'range'     => self::get_range(),
				'selectors' => array(
					'{{WRAPPER}} .product-elements .price' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_button_size',
			array(
				'label'     => esc_html__( 'Button text size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'   => array(
					'size' => 16,
					'unit' => 'px',
				),
				'tablet_default' => [
					'size' => 14,
					'unit' => 'px',
				],
				'mobile_default' => [
					'size' => 12,
					'unit' => 'px',
				],
				'range'     => self::get_range(),
				'selectors' => array(
					'{{WRAPPER}} .product-elements .add_to_cart_button' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_taxonomy_size',
			array(
				'label'     => esc_html__( 'Taxonomy text size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'   => array(
					'size' => 14,
					'unit' => 'px',
				),
				'tablet_default' => [
					'size' => 14,
					'unit' => 'px',
				],
				'mobile_default' => [
					'size' => 12,
					'unit' => 'px',
				],
				'range'     => self::get_range(),
				'selectors' => array(
					'{{WRAPPER}} .product-elements .taxonomy .tax-link' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);
		$this->end_controls_tab();

		
		// Product layout tab.
		$this->start_controls_tab(
			'product_layout_tab',
			array(
				'label' => esc_html__( 'Layout', 'mosaic-product-layouts-for-elementor' ),
			)
		);
		$this->add_control(
			'mpl4e_product_layout',
			array(
				'label'       => __( 'Product Card Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'vertical',
				'options'     => array(
					'image-background' => __( 'Image background', 'mosaic-product-layouts-for-elementor' ),
					'horizontal'       => __( 'Image left', 'mosaic-product-layouts-for-elementor' ),
					'horizontal-alt'   => __( 'Image right', 'mosaic-product-layouts-for-elementor' ),
					'vertical'         => __( 'Image top', 'mosaic-product-layouts-for-elementor' ),
					'vertical-alt'     => __( 'Image bottom', 'mosaic-product-layouts-for-elementor' ),
				),
				// 'description' => __( 'Select predefined layout for product display.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'hr_layout_align', [ 'type' => Controls_Manager::DIVIDER, ]
		);

		$this->add_responsive_control(
			'mpl4e_product_align',
			array(
				'label'        => esc_html__( 'Align', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::CHOOSE,
				'options'      => array(
					'flex-start'   => array(
						'title' => __( 'Left', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => __( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'flex-end'  => array(
						'title' => __( 'Right', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),

				),
				'default'      => '',
				'selectors'     => array(
					'{{WRAPPER}} .item-wrapper .flex-wrapper .product-elements' => 'justify-content: {{VALUE}};',
					'{{WRAPPER}} .item-wrapper .flex-wrapper .product-elements > *' => 'justify-content: {{VALUE}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_product_vertical_align',
			array(
				'label'     => esc_html__( 'Vertical align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'flex-start' => array(
						'title' => __( 'Top', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center'     => array(
						'title' => __( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'flex-end'   => array(
						'title' => __( 'Bottom', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-bottom',
					),
				),
				'default'   => '',
				'selectors' => array(
					'{{WRAPPER}} .item-wrapper .flex-wrapper' => 'align-items: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'hr_layout_gap', [ 'type' => Controls_Manager::DIVIDER, ]
		);

		$this->add_responsive_control(
			'mpl4e_elements_gap',
			array(
				'label'     => esc_html__( 'Elements gap', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'default'   => array(
					'size' => 0.2,
					'unit' => 'em',
				),
				'range'     => self::get_range(),
				'selectors' => array(
					'{{WRAPPER}} .product-elements' => 'gap:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'hr_layout_padding', [ 'type' => Controls_Manager::DIVIDER, ]
		);

		$this->add_responsive_control(
			'mpl4e_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'selectors' => array(
					'{{WRAPPER}} .item-wrapper .flex-wrapper' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_tab();

		// Product image controls tab.
		$this->start_controls_tab(
			'product_image_tab',
			array(
				'label' => esc_html__( 'Image', 'mosaic-product-layouts-for-elementor' ),
			)
		);
		
		$this->add_responsive_control(
			'mpl4e_image_size',
			array(
				'label'     => esc_html__( 'Image size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
					'size' => 50,
					'unit' => '',
				),
				'range'       => array(
					'em' => array(
						'min'  => 1,
						'max'  => 100,
						'step' => 1,
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .item-wrapper .product-image' => 'flex-basis: {{size}}%;',
					'{{WRAPPER}} .item-wrapper .flex-wrapper' => 'flex-basis: calc(100% - {{size}}%);',
				),
				'condition'   => array(
					'mpl4e_product_layout!' => 'image-background',
				)
			)
		);

		$this->add_control(
			'mpl4e_featured_image_size',
			array(
				'label'       => esc_html__( 'Image resolution', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'automatic',
				'options'     => $this->get_image_sizes(),
			)
		);

		$this->add_control(
			'mpl4e_image_fit',
			array(
				'label'   => esc_html__( 'Image fit', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'cover',
				'options' => array(
					'cover'      => __( 'Cover', 'mosaic-product-layouts-for-elementor' ),
					'contain'    => __( 'Contain', 'mosaic-product-layouts-for-elementor' ),
					'fill'       => __( 'Fill', 'mosaic-product-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-product-layouts-for-elementor' ),
					'scale-down' => __( 'Scale Down', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mpl4e_featured_image_position',
			array(
				'label'       => esc_html__( 'Image position', 'mosaic-product-layouts-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the image within the product card.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_focal_point',
				'default'     => array(
					'x' => 50,
					'y' => 50,
				),
			)
		);

		$this->end_controls_tab();
		
		// Product colors tab.
		$this->start_controls_tab(
			'product_colors_tab',
			array(
				'label' => esc_html__( 'Colors', 'mosaic-product-layouts-for-elementor' ),
			)
		);
		
		$this->add_control(
			'mpl4e_text_color',
			array(
				'label'     => esc_html__( 'Text color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .product-elements' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_links_color',
			array(
				'label'     => esc_html__( 'Links color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .product-elements .name a, {{WRAPPER}} .product-elements .taxonomy a' => 'color: {{VALUE}};',
				),
			)
		);
		$this->add_group_control(
			\Elementor\Group_Control_Background::get_type(),
			array(
				'name'      => 'mpl4e_background_color',
				'label'     => esc_html__( 'Background', 'mosaic-product-layouts-for-elementor' ),
				'types'     => array( 'classic', 'gradient' ),
				'selector' => '{{WRAPPER}} .item-wrapper .flex-wrapper',
				'default'   => '#ffffff',
			)
		);



		$this->end_controls_tab();

		// Product colors tab.
		$this->start_controls_tab(
			'product_border_tab',
			array(
				'label' => esc_html__( 'Borders', 'mosaic-product-layouts-for-elementor' ),
			)
		);
		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'      => 'mpl4e_product_border',
				'label'     => __( 'Products border', 'mosaic-product-layouts-for-elementor' ),
				'selector'  => '{{WRAPPER}} .item-wrapper',
			)
		);

		$this->add_control(
			'mpl4e_border_radius',
			array(
				'show_label' => true,
				'label'      => __( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors' => array(
					'{{WRAPPER}} .item-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'      => 'mpl4e_box_shadow',
				'selector'  => '{{WRAPPER}} .item-wrapper',
			)
		);
		
		$this->end_controls_tab();

		$this->end_controls_tabs();

		$this->add_control(
			'special_elements_heading',
			array(
				'label' => esc_html__( 'Special Elements', 'mosaic-product-layouts-for-elementor' ),
				'type' => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		// Additional Tabs.
		$this->start_controls_tabs( 'additional_tabs' );

		// Badges tab.
		$this->start_controls_tab(
			'badges_sale_tab',
			array(
				'label' => esc_html__( 'Badges', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mpl4e_sale_badge_size',
			array(
				'label'      => esc_html__( 'Sale badge text size', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'range'      => self::get_range(),
				'default'    => array(
					'size' => 14,
					'unit' => 'px',
				),
				'selectors'  => array(
					'{{WRAPPER}} .sale-badge' => 'font-size: {{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_sale_badge_color',
			array(
				'label'     => esc_html__( 'Sale badge text color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#FFFFFF',
				'selectors' => array(
					'{{WRAPPER}} .sale-badge' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_sale_badge_backcolor',
			array(
				'label'     => esc_html__( 'Sale badge background color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#CC0000',
				'selectors' => array(
					'{{WRAPPER}} .sale-badge' => 'background-color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_sale_badge_position',
			array(
				'label'       => esc_html__( 'Sale badge position', 'mosaic-product-layouts-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the sale badge within the product card.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_focal_point',
				'default'     => array(
					'x' => 10,
					'y' => 10,
				),
			)
		);

		$this->end_controls_tab();

		// Other.
		$this->start_controls_tab(
			'badges_other_tab',
			array(
				'label' => esc_html__( 'Other', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_rating_size',
			array(
				'label'     => esc_html__( 'Rating stars size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array('size' => 100, 'unit' => ''),
				'range'       => array(
					'em' => array(
						'min'  => 1,
						'max'  => 200,
						'step' => 1,
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .product-elements .rating-stars' => 'transform: scale(calc({{size}} / 100));',
				),
			)
		);
		$this->end_controls_tab();

		$this->end_controls_tabs();// Additional Tabs end.

		$this->end_controls_section();
	}
}
