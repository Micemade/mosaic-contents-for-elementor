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
 * Categories Layout Widget for Elementor.
 *
 * Displays WooCommerce product categories using React rendering with WC Store API.
 * Query settings are passed to React via content_template hidden input.
 */
class CategoriesLayout extends Widget_Base {

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
		return 'categories-layout';
	}

	public function get_title() {
		return __( 'Categories Layout', 'mosaic-product-layouts-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-product-categories';
	}

	public function get_categories() {
		return array( 'micemade-widgets' );
	}

	/**
	 * Get product categories for the parent filter select control.
	 *
	 * @return array Associative array of term_id => name.
	 */
	private function get_product_categories() {
		$categories = array(
			'' => __( 'All (no filter)', 'mosaic-product-layouts-for-elementor' ),
		);

		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return $categories;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'parent'     => 0,
			)
		);

		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			foreach ( $terms as $term ) {
				$categories[ (string) $term->term_id ] = $term->name;
			}
		}

		return $categories;
	}

	/**
	 * Get all product categories for multi-select (SELECT2) control.
	 * Returns all categories including subcategories, with hierarchy indication.
	 *
	 * @return array Associative array of term_id => name.
	 */
	private function get_all_product_categories() {
		$categories = array();

		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return $categories;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			foreach ( $terms as $term ) {
				// SELECT2 requires string keys.
				$prefix = $term->parent ? '— ' : '';
				$categories[ (string) $term->term_id ] = $prefix . $term->name;
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
			'mpl4e_cat_per_page',
			array(
				'label'   => __( 'Categories Per Page', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::NUMBER,
				'min'     => 1,
				'max'     => 100,
				'default' => 10,
			)
		);

		$this->add_control(
			'mpl4e_cat_orderby',
			array(
				'label'   => __( 'Order By', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'name',
				'options' => array(
					'name'  => __( 'Name', 'mosaic-product-layouts-for-elementor' ),
					'id'    => __( 'ID', 'mosaic-product-layouts-for-elementor' ),
					'slug'  => __( 'Slug', 'mosaic-product-layouts-for-elementor' ),
					'count' => __( 'Product Count', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mpl4e_cat_order',
			array(
				'label'   => __( 'Order', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'asc',
				'options' => array(
					'asc'  => __( 'Ascending', 'mosaic-product-layouts-for-elementor' ),
					'desc' => __( 'Descending', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mpl4e_cat_hide_empty',
			array(
				'label'        => __( 'Hide Empty Categories', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'mpl4e_cat_parent',
			array(
				'label'       => __( 'Parent Category', 'mosaic-product-layouts-for-elementor' ),
				'description' => __( 'Show only subcategories of the selected parent. Leave empty for all.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => $this->get_product_categories(),
			)
		);

		$this->add_control(
			'mpl4e_cat_include',
			array(
				'label'       => __( 'Include Categories', 'mosaic-product-layouts-for-elementor' ),
				'description' => __( 'Select specific categories to display. Leave empty to use query settings above.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT2,
				'default'     => array(),
				'options'     => $this->get_all_product_categories(),
				'multiple'    => true,
				'label_block' => true,
			)
		);

		$this->end_controls_section();

		// ── Layout Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mpl4e_cat_layout',
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
				'description' => __( 'Choose a predefined layout for the category grid.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_cat_custom_layout',
			array(
				'label'       => __( 'Custom Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::HIDDEN,
				'default'     => '',
				'description' => __( 'Stores custom layout data when you drag/resize items in the editor.', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_cat_reset_layout',
			array(
				'label'        => __( 'Reset to Predefined Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Reset Layout', 'mosaic-product-layouts-for-elementor' ),
				'description'  => __( 'Clear layout modifications and restore the selected predefined layout.', 'mosaic-product-layouts-for-elementor' ),
				'event'        => 'mosaic:catResetLayout',
			)
		);

		$this->add_control(
			'mpl4e_cat_add_item',
			array(
				'label'        => __( 'Add Item', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Add Item', 'mosaic-product-layouts-for-elementor' ),
				'description'  => __( 'Add a new item to the layout.', 'mosaic-product-layouts-for-elementor' ),
				'event'        => 'mosaic:catAddItem',
			)
		);

		$this->add_control(
			'mpl4e_cat_items_margin',
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
			'mpl4e_cat_row_height',
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
			'mpl4e_cat_allow_overlap',
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
			'mpl4e_cat_compaction_type',
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
					'mpl4e_cat_allow_overlap!' => 'yes',
				),
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
			'mpl4e_cat_saved_setup',
			array(
				'label'       => __( 'Layout & Style Setups', 'mosaic-product-layouts-for-elementor' ),
				'description' => __( 'Save, load, or delete layout and style configurations.', 'mosaic-product-layouts-for-elementor' ),
				'type'        => 'mpl4e_saved_setups',
				'default'     => '',
			)
		);

		$this->end_controls_section();

		// Element Ordering Section.
		$this->register_element_ordering_controls(
			'mpl4e_cat_element_ordering',
			__( 'Element Order & Visibility', 'mosaic-product-layouts-for-elementor' ),
			array(
				array(
					'element_label'   => __( 'Title', 'mosaic-product-layouts-for-elementor' ),
					'visible_desktop' => 'yes',
					'visible_tablet'  => 'yes',
					'visible_mobile'  => 'yes',
				),
				array(
					'element_label'   => __( 'Count', 'mosaic-product-layouts-for-elementor' ),
					'visible_desktop' => 'yes',
					'visible_tablet'  => 'yes',
					'visible_mobile'  => 'yes',
				),
				array(
					'element_label'   => __( 'Description', 'mosaic-product-layouts-for-elementor' ),
					'visible_desktop' => 'yes',
					'visible_tablet'  => 'yes',
					'visible_mobile'  => 'yes',
				),
			)
		);

		// ── Style Section ─────────────────────────────────────────────────
		$this->start_controls_section(
			'category_style_section',
			array(
				'label' => esc_html__( 'Category Card Style', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		// STYLE TABS: Text, Layout, Image, Colors, Borders.
		$this->start_controls_tabs( 'category_styles' );

		// ── Text Tab ──────────────────────────────────────────────────────
		$this->start_controls_tab(
			'category_text_tab',
			array(
				'label' => esc_html__( 'Text', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mpl4e_cat_title_size',
			array(
				'label'     => esc_html__( 'Title size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
					'size' => 24,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 22,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 20,
					'unit' => 'px',
				),
				'range' => self::get_range(),
			)
		);

		$this->add_responsive_control(
			'mpl4e_cat_count_size',
			array(
				'label'     => esc_html__( 'Count text size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
					'size' => 16,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'range' => self::get_range(),
			)
		);

		$this->add_responsive_control(
			'mpl4e_cat_description_size',
			array(
				'label'     => esc_html__( 'Description text size', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
					'size' => 14,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 13,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 12,
					'unit' => 'px',
				),
				'range'     => self::get_range(),
				'condition' => array(
					'mpl4e_cat_show_description' => 'yes',
				),
			)
		);

		$this->add_control(
			'mpl4e_cat_show_count',
			array(
				'label'        => __( 'Show Product Count', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
			)
		);

		$this->add_control(
			'mpl4e_cat_show_description',
			array(
				'label'        => __( 'Show Description', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_tab();

		// ── Layout Tab ────────────────────────────────────────────────────
		$this->start_controls_tab(
			'category_layout_tab',
			array(
				'label' => esc_html__( 'Layout', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_cat_card_layout',
			array(
				'label'   => __( 'Category Card Layout', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'vertical',
				'options' => array(
					'image-background' => __( 'Image background', 'mosaic-product-layouts-for-elementor' ),
					'horizontal'       => __( 'Image left', 'mosaic-product-layouts-for-elementor' ),
					'horizontal-alt'   => __( 'Image right', 'mosaic-product-layouts-for-elementor' ),
					'vertical'         => __( 'Image top', 'mosaic-product-layouts-for-elementor' ),
					'vertical-alt'     => __( 'Image bottom', 'mosaic-product-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'hr_cat_layout_align',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mpl4e_cat_align',
			array(
				'label'   => esc_html__( 'Align', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::CHOOSE,
				'options' => array(
					'left'   => array(
						'title' => __( 'Left', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => __( 'Center', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'right'  => array(
						'title' => __( 'Right', 'mosaic-product-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),
				),
				'default' => '',
			)
		);

		$this->add_responsive_control(
			'mpl4e_cat_vertical_align',
			array(
				'label'   => esc_html__( 'Vertical align', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::CHOOSE,
				'options' => array(
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
				'default' => '',
			)
		);

		$this->add_control(
			'hr_cat_layout_gap',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mpl4e_cat_elements_gap',
			array(
				'label'      => esc_html__( 'Elements gap', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'default'    => array(
					'size' => 0.2,
					'unit' => 'em',
				),
				'range'      => self::get_range(),
				'selectors'  => array(
					'{{WRAPPER}} .category-elements' => 'gap:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'hr_cat_layout_padding',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mpl4e_cat_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'selectors'  => array(
					'{{WRAPPER}} .category-wrapper .flex-wrapper' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_tab();

		// ── Image Tab ─────────────────────────────────────────────────────
		$this->start_controls_tab(
			'category_image_tab',
			array(
				'label' => esc_html__( 'Image', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mpl4e_cat_image_size',
			array(
				'label'   => esc_html__( 'Image size', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SLIDER,
				'default' => array(
					'size' => 50,
					'unit' => '',
				),
				'range'     => array(
					'em' => array(
						'min'  => 1,
						'max'  => 100,
						'step' => 1,
					),
				),
				'selectors' => array(
					'{{WRAPPER}} .category-wrapper .category-image' => 'flex-basis: {{size}}%;',
					'{{WRAPPER}} .category-wrapper .flex-wrapper' => 'flex-basis: calc(100% - {{size}}%);',
				),
				'condition' => array(
					'mpl4e_cat_card_layout!' => 'image-background',
				),
			)
		);

		$this->add_control(
			'mpl4e_cat_image_fit',
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
			'mpl4e_cat_image_position',
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

		$this->end_controls_tab();

		// ── Colors Tab ────────────────────────────────────────────────────
		$this->start_controls_tab(
			'category_colors_tab',
			array(
				'label' => esc_html__( 'Colors', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'mpl4e_cat_text_color',
			array(
				'label'     => esc_html__( 'Text color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .category-elements .cat-count, {{WRAPPER}} .category-elements .cat-description' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mpl4e_cat_links_color',
			array(
				'label'     => esc_html__( 'Links color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .category-elements .name a' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'     => 'mpl4e_cat_background_color',
				'label'    => esc_html__( 'Background', 'mosaic-product-layouts-for-elementor' ),
				'types'    => array( 'classic', 'gradient' ),
				'selector' => '{{WRAPPER}} .category-wrapper .flex-wrapper',
				'default'  => '#ffffff',
			)
		);

		$this->end_controls_tab();

		// ── Borders Tab ───────────────────────────────────────────────────
		$this->start_controls_tab(
			'category_border_tab',
			array(
				'label' => esc_html__( 'Borders', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'mpl4e_cat_border',
				'label'    => __( 'Category border', 'mosaic-product-layouts-for-elementor' ),
				'selector' => '{{WRAPPER}} .category-wrapper',
			)
		);

		$this->add_control(
			'mpl4e_cat_border_radius',
			array(
				'show_label' => true,
				'label'      => __( 'Border Radius', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .category-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'mpl4e_cat_box_shadow',
				'selector' => '{{WRAPPER}} .category-wrapper',
			)
		);

		$this->end_controls_tab();
		$this->end_controls_tabs();

		$this->end_controls_section();
	}
}
