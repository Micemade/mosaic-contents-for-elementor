<?php

namespace Micemade\MosaicProductLayoutsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Micemade\MosaicProductLayoutsElementor\WidgetHelpers;

/**
 * Single Product Layout Widget for Elementor.
 *
 * Displays a single WooCommerce product's elements (title, price, image,
 * excerpt, add to cart, rating, etc.) arranged in a draggable grid layout.
 * Uses react-grid-layout to position individual product elements as grid items.
 *
 * Ported from the Mosaic Product Layouts Gutenberg "Single Product" block.
 */
class SingleProductLayout extends Widget_Base {

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
		return 'single-product-layout';
	}

	public function get_title() {
		return __( 'Single Product Layout', 'mosaic-product-layouts-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-single-product';
	}

	public function get_categories() {
		return array( 'mosaic-product-layouts' );
	}

	/**
	 * Get WooCommerce products for the product picker.
	 *
	 * @return array Associative array of product_id => product_name.
	 */
	private function get_products_list() {
		$products = array();

		if ( ! function_exists( 'wc_get_products' ) ) {
			return $products;
		}

		$wc_products = wc_get_products(
			array(
				'limit'   => 100,
				'orderby' => 'title',
				'order'   => 'ASC',
				'status'  => 'publish',
			)
		);

		if ( ! empty( $wc_products ) ) {
			foreach ( $wc_products as $product ) {
				$products[ (string) $product->get_id() ] = $product->get_name();
			}
		}

		return $products;
	}

	/**
	 * Read single-product layout presets from JSON and return as id => label options.
	 *
	 * @return array Associative array of layout_id => label.
	 */
	private function get_sp_layout_options() {
		$json_path = MPL4E_PLUGIN_DIR . 'assets/presets/single-product-layouts.json';
		$layouts   = wp_json_file_decode( $json_path, array( 'associative' => true ) );

		if ( empty( $layouts ) || ! is_array( $layouts ) ) {
			return array( 'default' => __( 'Default', 'mosaic-product-layouts-for-elementor' ) );
		}

		$options = array();
		foreach ( $layouts as $layout ) {
			if ( isset( $layout['id'], $layout['label'] ) ) {
				$options[ $layout['id'] ] = $layout['label'];
			}
		}

		return $options;
	}

	/**
	 * Register a standard set of style controls for a text element.
	 *
	 * @param string $element_id  Snake‑case ID for control names (e.g. 'title', 'sale_badge').
	 * @param string $css_class   camelCase CSS class used in JSX (e.g. 'title', 'saleBadge').
	 */
	private function register_element_style_controls( $element_id, $css_class ) {
		
		$selector = "{{WRAPPER}} .{$css_class} .elements-wrapper";

		// Omit text size control for rating since it uses stars 
		// instead of text and font-size would not apply well.
		if( $element_id !== 'rating' ) {
		
			// Text size (responsive).
			$this->add_responsive_control(
				"mpl4e_sp_{$element_id}_text_size",
				array(
					'label'      => esc_html__( 'Text Size', 'mosaic-product-layouts-for-elementor' ),
					'type'       => Controls_Manager::SLIDER,
					'size_units' => array( 'px', 'em', 'rem' ),
					'range'      => self::get_range(),
					'selectors'  => array(
						$selector => 'font-size: {{SIZE}}{{UNIT}};',
					),
				)
			);
	
		}
		
		// Text color.
		$this->add_control(
			"mpl4e_sp_{$element_id}_text_color",
			array(
				'label'     => esc_html__( 'Text Color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					$selector => 'color: {{VALUE}};',
					"{{WRAPPER}} .sp-element.{$css_class} .elements-wrapper .rated-perc .stars .star" => 'background: {{VALUE}};',
				),
			)
		);

		// Background.
		$this->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'     => "mpl4e_sp_{$element_id}_background",
				'selector' => $selector,
			)
		);

		// Horizontal align (responsive).
		$this->add_responsive_control(
			"mpl4e_sp_{$element_id}_h_align",
			array(
				'label'     => esc_html__( 'Horizontal Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'start'  => array(
						'title' => esc_html__( 'Left', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => esc_html__( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'end'    => array(
						'title' => esc_html__( 'Right', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),
				),
				'selectors' => array(
					$selector => 'align-items: {{VALUE}}; text-align: {{VALUE}};',
				),
			)
		);

		// Vertical align (responsive).
		$this->add_responsive_control(
			"mpl4e_sp_{$element_id}_v_align",
			array(
				'label'     => esc_html__( 'Vertical Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'start'  => array(
						'title' => esc_html__( 'Top', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center' => array(
						'title' => esc_html__( 'Middle', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'end'    => array(
						'title' => esc_html__( 'Bottom', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-bottom',
					),
				),
				'selectors' => array(
					$selector => 'justify-content: {{VALUE}};',
				),
			)
		);

		// Padding (responsive).
		$this->add_responsive_control(
			"mpl4e_sp_{$element_id}_padding",
			array(
				'label'      => esc_html__( 'Padding', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem' ),
				'range'      => self::get_range(),
				'selectors'  => array(
					$selector => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}} !important;',
				),
			)
		);

		// Border.
		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => "mpl4e_sp_{$element_id}_border",
				'selector' => $selector,
			)
		);

		// Border radius (responsive).
		$this->add_responsive_control(
			"mpl4e_sp_{$element_id}_border_radius",
			array(
				'label'      => esc_html__( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					$selector => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		// Box shadow.
		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => "mpl4e_sp_{$element_id}_box_shadow",
				'selector' => $selector,
			)
		);
	}

	/**
	 * Register widget controls.
	 */
	public function register_controls() {

		// ── Product Selection Section ──────────────────────────────────────
		$this->start_controls_section(
			'product_section',
			array(
				'label' => __( 'Product Selection', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mpl4e_sp_product_id',
			array(
				'label'       => __( 'Product', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_product_select',
				'default'     => '',
				'label_block' => true,
				'description' => __( 'Select a product to display. Type to search.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Layout Section ─────────────────────────────────────────────────
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$this->add_control(
			'mpl4e_sp_layout',
			array(
				'label'       => __( 'Predefined Layouts', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'default',
				'options'     => $this->get_sp_layout_options(),
				'description' => __( 'Choose a predefined element arrangement.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_sp_custom_layout',
			array(
				'label'   => __( 'Custom Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$this->add_control(
			'mpl4e_sp_reset_layout',
			array(
				'label' => __( 'Reset to Predefined Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'  => Controls_Manager::BUTTON,
				'text'  => __( 'Reset Layout', 'mosaic-product-layouts-for-elementor' ),
				'event' => 'mosaic:spResetLayout',
			)
		);

		$this->add_control(
			'mpl4e_sp_items_margin',
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
					'size' => 5,
					'unit' => 'px',
				),
			)
		);

		$this->add_control(
			'mpl4e_sp_row_height',
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
					'size' => 10,
					'unit' => 'px',
				),
			)
		);

		$this->add_control(
			'mpl4e_sp_allow_overlap',
			array(
				'label'        => __( 'Allow Overlap', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'mpl4e_sp_compaction_type',
			array(
				'label'     => __( 'Compaction Type', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'none',
				'options'   => array(
					'vertical'   => __( 'Vertical', 'mosaic-product-layouts-for-elementor' ),
					'horizontal' => __( 'Horizontal', 'mosaic-product-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-product-layouts-for-elementor' ),
				),
				'condition' => array(
					'mpl4e_sp_allow_overlap!' => 'yes',
				),
			)
		);

		$this->add_control(
			'mpl4e_sp_helper_notice',
			array(
				'type' => \Elementor\Controls_Manager::NOTICE,
				'notice_type' => 'info',
				'dismissible' => false,
				'heading' => esc_html__( 'Helpers', 'mosaic-product-layouts-for-elementor' ),
				'content' => esc_html__( 'Visual aids - a grid visualization for placing and resizing elements, and element outlines with labels.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_sp_helper_grid',
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

		$this->add_control(
			'mpl4e_sp_helper_outline_labels',
			array(
				'label'        => __( 'Element outlines and labels', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SELECT,
				'default'      => 'outline-aid-hover',
				'options'      => array(
					'no-outline'        => __( 'None', 'mosaic-product-layouts-for-elementor' ),
					'outline-aid-hover' => __( 'On widget hover', 'mosaic-product-layouts-for-elementor' ),
					'outline-aid'       => __( 'Always', 'mosaic-product-layouts-for-elementor' ),
				),
				'description'  => __( 'Visual aid for element boundaries and labels.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Saved Setups Section ───────────────────────────────────────────
		$this->start_controls_section(
			'saved_setups_section',
			array(
				'label' => __( 'Saved Setups', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mpl4e_sp_saved_setup',
			array(
				'label'       => __( 'Layout & Style Setups', 'mosaic-product-layouts-for-elementor' ),
				'description' => __( 'Save, load, or delete layout and style configurations.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_saved_setups',
				'default'     => '',
			)
		);

		$this->end_controls_section();

		// ══════════════════════════════════════════════════════════════════
		// STYLE TAB
		// ══════════════════════════════════════════════════════════════════

		// ── Style Presets ──────────────────────────────────────────────────
		$this->start_controls_section(
			'sp_style_preset_section',
			array(
				'label' => esc_html__( 'Style Presets', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'mpl4e_sp_style_preset',
			array(
				'label'       => esc_html__( 'Style Preset', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::VISUAL_CHOICE,
				'columns'     => 4,
				'label_block' => true,
				'default'     => '',
				'options'     => $this->get_style_preset_options( 'single-product-layout' ),
				'description' => esc_html__( 'Pick a preset to instantly apply a complete style pack.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Global Element Styles ──────────────────────────────────────────
		$this->start_controls_section(
			'sp_global_styles_section',
			array(
				'label' => esc_html__( 'Global Element Styles', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'sp_global_description',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => esc_html__( 'Default styles for all elements. Override per element in sections below.', 'mosaic-product-layouts-for-elementor' ),
				'content_classes' => 'elementor-descriptor',
			)
		);

		$this->add_responsive_control(
			'mpl4e_sp_global_h_align',
			array(
				'label'     => esc_html__( 'Horizontal Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'start'  => array(
						'title' => esc_html__( 'Left', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => esc_html__( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'end'    => array(
						'title' => esc_html__( 'Right', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .sp-element > .elements-wrapper' => 'align-items: {{VALUE}}; text-align: {{VALUE}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_sp_global_v_align',
			array(
				'label'     => esc_html__( 'Vertical Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'start'  => array(
						'title' => esc_html__( 'Top', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center' => array(
						'title' => esc_html__( 'Middle', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'end'    => array(
						'title' => esc_html__( 'Bottom', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-bottom',
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .sp-element > .elements-wrapper' => 'justify-content: {{VALUE}};',
				),
			)
		);

		$this->add_responsive_control(
			'mpl4e_sp_global_padding',
			array(
				'label'      => esc_html__( 'Padding', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem' ),
				'selectors'  => array(
					'{{WRAPPER}} .sp-element > .elements-wrapper' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
				'separator' => 'before'
			)
		);

		$this->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'      => 'mpl4e_sp_global_background',
				'selector'  => '{{WRAPPER}} .sp-element > .elements-wrapper',
				'separator' => 'before'
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'      => 'mpl4e_sp_global_border',
				'selector'  => '{{WRAPPER}} .sp-element > .elements-wrapper',
				'separator' => 'before'
			)
		);

		$this->add_responsive_control(
			'mpl4e_sp_global_border_radius',
			array(
				'label'      => esc_html__( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .sp-element > .elements-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'      => 'mpl4e_sp_global_box_shadow',
				'selector'  => '{{WRAPPER}} .sp-element > .elements-wrapper',
				'separator' => 'before' 
			)
		);

		$this->end_controls_section();

		// ── Per-Element Style Sections ─────────────────────────────────────
		$text_elements = array(
			array( 'id' => 'title',      'label' => 'Title',              'css_class' => 'title' ),
			array( 'id' => 'price',      'label' => 'Price',              'css_class' => 'price' ),
			array( 'id' => 'excerpt',    'label' => 'Short Description',  'css_class' => 'excerpt' ),
			array( 'id' => 'addtocart',  'label' => 'Add to Cart',        'css_class' => 'addToCart' ),
			array( 'id' => 'sale_badge', 'label' => 'Sale Badge',         'css_class' => 'saleBadge' ),
			array( 'id' => 'rating',     'label' => 'Rating',             'css_class' => 'rating' ),
			array( 'id' => 'categories', 'label' => 'Categories',         'css_class' => 'categories' ),
			array( 'id' => 'brands',     'label' => 'Brands',             'css_class' => 'brands' ),
			array( 'id' => 'outofstock', 'label' => 'Out of Stock Badge', 'css_class' => 'outofstock' ),
			array( 'id' => 'attributes', 'label' => 'Attributes',         'css_class' => 'attributes' ),
		);

		foreach ( $text_elements as $element ) {
			
			$this->start_controls_section(
				"sp_{$element['id']}_style_section",
				array(
					/* translators: %s: element label */
					'label' => sprintf( esc_html__( '%s Style', 'mosaic-product-layouts-for-elementor' ), $element['label'] ),
					'tab'   => Controls_Manager::TAB_STYLE,
				)
			);

			// Added before all elements since it only applies to rating and is more intuitive to have near the top of the controls for that element.
			if ( 'rating' === $element['id'] ) {
				$this->add_control(
					'mpl4e_rating_size',
					array(
						'label'     => esc_html__( 'Rating stars size', 'mosaic-product-layouts-for-elementor' ),
						'type'      => Controls_Manager::SLIDER,
						'default'   => array('size' => 100, 'unit' => ''),
						'range'       => array(
							'min'  => 1,
							'max'  => 200,
							'step' => 1,
						),
						'selectors' => array(
							'{{WRAPPER}} .sp-element.rating .rating-stars' => 'transform: scale(calc({{size}} / 100));',
						),
					)
				);
			}

			$this->register_element_style_controls( $element['id'], $element['css_class'] );

			// Added after global styles since it only applies to text elements and is more intuitive to have near the top of the controls for those elements.
			// Excerpt-specific: truncation controls.
			if ( 'excerpt' === $element['id'] ) {
				$this->add_control(
					'mpl4e_sp_excerpt_truncate',
					array(
						'label'        => esc_html__( 'Truncate excerpt', 'mosaic-product-layouts-for-elementor' ),
						'type'         => Controls_Manager::SWITCHER,
						'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
						'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
						'return_value' => 'yes',
						'default'      => 'yes',
						'separator'    => 'before',
					)
				);

				$this->add_control(
					'mpl4e_sp_excerpt_truncate_lines',
					array(
						'label'     => esc_html__( 'Truncate lines', 'mosaic-product-layouts-for-elementor' ),
						'type'      => Controls_Manager::NUMBER,
						'min'       => 1,
						'max'       => 20,
						'default'   => 3,
						'selectors' => array(
							'{{WRAPPER}} .sp-element.excerpt .excerpt.truncated' => '-webkit-line-clamp: {{VALUE}};',
						),
						'condition' => array(
							'mpl4e_sp_excerpt_truncate' => 'yes',
						),
					)
				);
			}
			// end Excerpt-specific: truncation controls.

			$this->end_controls_section();
		} // end foreach element


		// ── Image Style Section ────────────────────────────────────────────
		$this->start_controls_section(
			'sp_image_style_section',
			array(
				'label' => esc_html__( 'Image Style', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'mpl4e_sp_featured_image_size',
			array(
				'label'   => esc_html__( 'Image resolution', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'automatic',
				'options' => $this->get_image_sizes(),
			)
		);

		$this->add_control(
			'mpl4e_sp_image_fit',
			array(
				'label'     => esc_html__( 'Image fit', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => 'cover',
				'options'   => array(
					'cover'      => __( 'Cover', 'mosaic-product-layouts-for-elementor' ),
					'contain'    => __( 'Contain', 'mosaic-product-layouts-for-elementor' ),
					'fill'       => __( 'Fill', 'mosaic-product-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-product-layouts-for-elementor' ),
					'scale-down' => __( 'Scale Down', 'mosaic-product-layouts-for-elementor' ),
				),
				'selectors' => array(
					'{{WRAPPER}} .sp-element.image .product-featured-image img' => 'object-fit: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_sp_image_position',
			array(
				'label'       => esc_html__( 'Image position', 'mosaic-product-layouts-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the image.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_focal_point',
				'default'     => array(
					'x' => 50,
					'y' => 50,
				),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'mpl4e_sp_image_border',
				'selector' => '{{WRAPPER}} .sp-element.image .product-featured-image',
			)
		);

		$this->add_responsive_control(
			'mpl4e_sp_image_border_radius',
			array(
				'label'      => esc_html__( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .sp-element.image .product-featured-image' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'mpl4e_sp_image_box_shadow',
				'selector' => '{{WRAPPER}} .sp-element.image .product-featured-image',
			)
		);

		$this->end_controls_section();

		// ── Group Styles Section ───────────────────────────────────────────
		$this->start_controls_section(
			'sp_group_styles_section',
			array(
				'label' => esc_html__( 'Group Styles', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'sp_group_description',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => esc_html__( 'Style controls for group containers. Add groups using the "Add group" button in the widget toolbar.', 'mosaic-product-layouts-for-elementor' ),
				'content_classes' => 'elementor-descriptor',
			)
		);

		$group_repeater = new \Elementor\Repeater();

		$group_repeater->add_control(
			'group_id',
			array(
				'label'   => esc_html__( 'Group ID', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::HIDDEN,
				'default' => '',
			)
		);

		$group_repeater->add_control(
			'group_label',
			array(
				'label'       => esc_html__( 'Group', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::HIDDEN,
				'default'     => '',
			)
		);

		$group_repeater->add_control(
			'group_align',
			array(
				'label'     => esc_html__( 'Horizontal Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'default'   => 'center',
				'options'   => array(
					'flex-start' => array(
						'title' => esc_html__( 'Left', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center'     => array(
						'title' => esc_html__( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'flex-end'   => array(
						'title' => esc_html__( 'Right', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),
				),
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper .grouped-elements' => 'align-items: {{VALUE}};',
				),
				'separator' => 'before',
			)
		);

		$group_repeater->add_control(
			'group_valign',
			array(
				'label'     => esc_html__( 'Vertical Align', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'default'   => 'center',
				'options'   => array(
					'flex-start' => array(
						'title' => esc_html__( 'Top', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center'     => array(
						'title' => esc_html__( 'Middle', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'flex-end'   => array(
						'title' => esc_html__( 'Bottom', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-bottom',
					),
				),
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper .grouped-elements' => 'justify-content: {{VALUE}};',
				),
			)
		);

		$group_repeater->add_control(
			'group_text_color',
			array(
				'label'     => esc_html__( 'Text Color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper' => 'color: {{VALUE}};',
				),
				'separator' => 'before',
			)
		);

		$group_repeater->add_control(
			'group_links_color',
			array(
				'label'     => esc_html__( 'Links Color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper a:not(.add_to_cart_button)' => 'color: {{VALUE}};',
				),
			)
		);

		$group_repeater->add_control(
			'group_background',
			array(
				'label'     => esc_html__( 'Background Color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#ffffff',
				'selectors' => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper' => 'background-color: {{VALUE}};',
				),
				'separator' => 'before',
			)
		);

		$group_repeater->add_responsive_control(
			'group_padding',
			array(
				'label'      => esc_html__( 'Padding', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem' ),
				'default'    => array(
					'top'      => '1',
					'right'    => '1',
					'bottom'   => '1',
					'left'     => '1',
					'unit'     => 'em',
					'isLinked' => true,
				),
				'selectors'  => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
				'separator'  => 'before',
			)
		);

		$group_repeater->add_control(
			'group_gap',
			array(
				'label'      => esc_html__( 'Gap', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'em', 'px', 'rem' ),
				'default'    => array(
					'size' => 0.3,
					'unit' => 'em',
				),
				'range'      => array(
					'em'  => array(
						'min'  => 0,
						'max'  => 3,
						'step' => 0.1,
					),
					'px'  => array(
						'min'  => 0,
						'max'  => 50,
						'step' => 1,
					),
					'rem' => array(
						'min'  => 0,
						'max'  => 3,
						'step' => 0.1,
					),
				),
				'selectors'  => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper .grouped-elements' => 'gap: {{SIZE}}{{UNIT}};',
				),
			)
		);

		$group_repeater->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'      => 'group_border',
				'selector'  => '{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper',
				'separator' => 'before',
				'fields_options' => array(
					'border' => array(
						'default' => 'solid',
					),
					'width'  => array(
						'default' => array(
							'top'      => '1',
							'right'    => '1',
							'bottom'   => '1',
							'left'     => '1',
							'isLinked' => true,
						),
					),
					'color'  => array(
						'default' => '#cccccc',
					),
				),
			)
		);

		$group_repeater->add_responsive_control(
			'group_border_radius',
			array(
				'label'      => esc_html__( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$group_repeater->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'group_box_shadow',
				'selector' => '{{WRAPPER}} {{CURRENT_ITEM}}.sp-element > .elements-wrapper',
			)
		);

		$this->add_control(
			'mpl4e_sp_group_styles',
			array(
				'label'         => esc_html__( 'Groups', 'mosaic-product-layouts-for-elementor' ),
				'type'          => Controls_Manager::REPEATER,
				'fields'        => $group_repeater->get_controls(),
				'default'       => array(),
				'title_field'   => '{{{ group_label || "Group" }}}',
				'prevent_empty' => false,
			)
		);

		$this->end_controls_section();
	}
}
