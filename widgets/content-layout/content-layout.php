<?php

namespace Micemade\MosaicLayoutsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Typography;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Repeater;
use Micemade\MosaicLayoutsElementor\WidgetHelpers;
use Micemade\MosaicLayoutsElementor\RestAPI;

/**
 * Content Layout Widget for Elementor.
 *
 * Displays general-purpose post content using React rendering with WP REST API.
 * Query settings are passed to React via content_template hidden input.
 */
class ContentLayout extends Widget_Base {

	use WidgetHelpers;

	/**
	 * Cached post type metadata from RestAPI::get_post_types().
	 *
	 * @var array[]|null
	 */
	private $post_types_data_cache = null;

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
		return 'content-layout';
	}

	public function get_title() {
		return __( 'Content Layout', 'mosaic-layouts-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-posts-grid';
	}

	public function get_categories() {
		return array( 'mosaic-layouts' );
	}



	/**
	 * Get REST post type metadata from the plugin REST API class.
	 *
	 * @return array[]
	 */
	private function get_post_types_data() {
		if ( is_array( $this->post_types_data_cache ) ) {
			return $this->post_types_data_cache;
		}

		$api      = new RestAPI();
		$response = $api->get_post_types();

		if ( ! is_object( $response ) || ! method_exists( $response, 'get_data' ) ) {
			$this->post_types_data_cache = array();
			return $this->post_types_data_cache;
		}

		$data = $response->get_data();
		$this->post_types_data_cache = is_array( $data ) ? $data : array();

		return $this->post_types_data_cache;
	}

	/**
	 * Build post type select options from REST post type metadata.
	 *
	 * @return array
	 */
	private function get_post_types_options() {
		$options = array();
		$types   = $this->get_post_types_data();

		foreach ( $types as $type ) {
			if ( empty( $type['name'] ) || empty( $type['label'] ) ) {
				continue;
			}

			$options[ $type['name'] ] = $type['label'];
		}

		return $options;
	}

	/**
	 * Get public taxonomies for a post type.
	 *
	 * @param string $post_type Post type slug.
	 * @return array
	 */
	private function get_taxonomies_options( $post_type = 'post' ) {
		$options = array();
		$types   = $this->get_post_types_data();

		foreach ( $types as $type ) {
			if ( empty( $type['name'] ) || $type['name'] !== $post_type ) {
				continue;
			}

			$taxonomies      = ! empty( $type['taxonomies'] ) && is_array( $type['taxonomies'] ) ? $type['taxonomies'] : array();
			$taxonomy_labels = ! empty( $type['taxonomy_labels'] ) && is_array( $type['taxonomy_labels'] ) ? $type['taxonomy_labels'] : array();

			foreach ( $taxonomies as $taxonomy ) {
				if ( ! is_string( $taxonomy ) || '' === $taxonomy ) {
					continue;
				}

				$options[ $taxonomy ] = isset( $taxonomy_labels[ $taxonomy ] ) ? $taxonomy_labels[ $taxonomy ] : $taxonomy;
			}

			break;
		}

		return $options;
	}

	/**
	 * Get taxonomy terms in a flat list for a specific taxonomy.
	 *
	 * @param string $taxonomy Taxonomy slug.
	 * @return array
	 */
	private function get_terms_options( $taxonomy = '' ) {
		$options    = array();

		if ( empty( $taxonomy ) ) {
			return $options;
		}

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => false,
			)
		);

		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return $options;
		}

		foreach ( $terms as $term ) {
			$key             = $taxonomy . ':' . $term->term_id;
			$options[ $key ] = sprintf( '%1$s: %2$s', $taxonomy, $term->name );
		}

		return $options;
	}

	/**
	 * Register widget controls.
	 */
	public function register_controls() {
		$post_type_options = $this->get_post_types_options();
		$default_post_type = isset( $post_type_options['post'] ) ? 'post' : ( ! empty( $post_type_options ) ? (string) key( $post_type_options ) : '' );
		$taxonomy_options  = $this->get_taxonomies_options( $default_post_type );
		$default_taxonomy  = isset( $taxonomy_options['category'] ) ? 'category' : ( ! empty( $taxonomy_options ) ? (string) key( $taxonomy_options ) : '' );

		// ── Content Section - Query Settings ──────────────────────────────
		$this->start_controls_section(
			'query_section',
			array(
				'label' => __( 'Query Settings', 'mosaic-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'ml4e_post_type',
			array(
				'label'   => __( 'Post Type', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => $default_post_type,
				'options' => $post_type_options,
			)
		);

		$this->add_control(
			'ml4e_taxonomy',
			array(
				'label'   => __( 'Taxonomy', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => $default_taxonomy,
				'options' => $taxonomy_options,
			)
		);

		$this->add_control(
			'ml4e_terms',
			array(
				'label'       => __( 'Terms', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT2,
				'default'     => array(),
				'options'     => $this->get_terms_options( $default_taxonomy ),
				'multiple'    => true,
				'label_block' => true,
			)
		);

		$this->add_control(
			'ml4e_orderby',
			array(
				'label'   => __( 'Order By', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'date',
				'options' => array(
					'date'       => __( 'Date', 'mosaic-layouts-for-elementor' ),
					'title'      => __( 'Title', 'mosaic-layouts-for-elementor' ),
					'modified'   => __( 'Modified', 'mosaic-layouts-for-elementor' ),
					'menu_order' => __( 'Menu Order', 'mosaic-layouts-for-elementor' ),
					'rand'       => __( 'Random', 'mosaic-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'ml4e_order',
			array(
				'label'   => __( 'Order', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'desc',
				'options' => array(
					'desc' => __( 'Descending', 'mosaic-layouts-for-elementor' ),
					'asc'  => __( 'Ascending', 'mosaic-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'ml4e_sticky',
			array(
				'label'        => __( 'Sticky Only', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'ml4e_enable_pagination',
			array(
				'label'        => __( 'Enable Pagination', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'post_meta_section',
			array(
				'label' => __( 'Post Meta Display', 'mosaic-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$meta_repeater = new Repeater();

		$meta_repeater->add_control(
			'meta_key',
			array(
				'label'       => __( 'Meta Key', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
			)
		);

		$meta_repeater->add_control(
			'meta_label',
			array(
				'label'       => __( 'Display Label', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
			)
		);

		$meta_repeater->add_control(
			'meta_prefix',
			array(
				'label' => __( 'Prefix', 'mosaic-layouts-for-elementor' ),
				'type'  => Controls_Manager::TEXT,
			)
		);

		$meta_repeater->add_control(
			'meta_suffix',
			array(
				'label' => __( 'Suffix', 'mosaic-layouts-for-elementor' ),
				'type'  => Controls_Manager::TEXT,
			)
		);

		$meta_repeater->add_control(
			'meta_condition',
			array(
				'label'   => __( 'Condition', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'always',
				'options' => array(
					'always'     => __( 'Always', 'mosaic-layouts-for-elementor' ),
					'not_empty'  => __( 'Not Empty', 'mosaic-layouts-for-elementor' ),
					'equals'     => __( 'Equals', 'mosaic-layouts-for-elementor' ),
					'not_equals' => __( 'Not Equals', 'mosaic-layouts-for-elementor' ),
				),
			)
		);

		$meta_repeater->add_control(
			'meta_condition_value',
			array(
				'label'     => __( 'Condition Value', 'mosaic-layouts-for-elementor' ),
				'type'      => Controls_Manager::TEXT,
				'condition' => array(
					'meta_condition' => array( 'equals', 'not_equals' ),
				),
			)
		);

		$this->add_control(
			'ml4e_post_meta',
			array(
				'label'       => __( 'Meta Fields', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $meta_repeater->get_controls(),
				'title_field' => '{{{ meta_key }}}',
			)
		);

		$this->end_controls_section();

		// ── Layout Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$this->add_control(
			'ml4e_layout',
			array(
				'label'       => __( 'Predefined Layouts', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'default',
				'options'     => $this->get_layout_options( 'content-layout' ),
				'description' => __( 'Choose a predefined layout for the product grid. Layouts 1-9 display 3 items, Layouts 10-14 display 4 items.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_custom_layout',
			array(
				'label'       => __( 'Custom Layout', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::HIDDEN,
				'default'     => '',
				'description' => __( 'Stores custom layout data when you drag/resize items in the editor.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_reset_layout',
			array(
				'label'        => __( 'Reset to Predefined Layout', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Reset Layout', 'mosaic-layouts-for-elementor' ),
				'description'  => __( 'Clear layout modifications and restore the selected predefined layout.', 'mosaic-layouts-for-elementor' ),
				'event'        => 'mosaic:resetLayout',
			)
		);

		$this->add_control(
			'ml4e_add_item',
			array(
				'label'        => __( 'Add Item', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::BUTTON,
				'text'         => __( 'Add Item', 'mosaic-layouts-for-elementor' ),
				'description'  => __( 'Add a new item to the layout.', 'mosaic-layouts-for-elementor' ),
				'event'        => 'mosaic:addItem',
			)
		);

		$this->add_control(
			'ml4e_items_margin',
			array(
				'label'   => __( 'Grid Gap', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_row_height',
			array(
				'label'   => __( 'Grid Row Height', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_allow_overlap',
			array(
				'label'        => __( 'Allow Overlap', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'description'  => __( 'Allow grid items to overlap each other.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_compaction_type',
			array(
				'label'       => __( 'Compaction Type', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'vertical',
				'options'     => array(
					'vertical'   => __( 'Vertical', 'mosaic-layouts-for-elementor' ),
					'horizontal' => __( 'Horizontal', 'mosaic-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-layouts-for-elementor' ),
				),
				'description' => __( 'How items compact when moved. "None" keeps items in place.', 'mosaic-layouts-for-elementor' ),
				'condition'   => array(
					'ml4e_allow_overlap!' => 'yes',
				),
			)
		);


		$this->add_control(
			'ml4e_helper_notice',
			array(
				'type' => \Elementor\Controls_Manager::NOTICE,
				'notice_type' => 'info',
				'dismissible' => false,
				'heading' => esc_html__( 'Helpers', 'mosaic-layouts-for-elementor' ),
				'content' => esc_html__( 'Visual aid - a grid visualization for placing and resizing items.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_helper_grid',
			array(
				'label'        => __( 'Grid Visualization', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::SELECT,
				'default'      => 'none',
				'options'      => array(
					'none'   => __( 'None', 'mosaic-layouts-for-elementor' ),
					'front'  => __( 'Front', 'mosaic-layouts-for-elementor' ),
					'behind' => __( 'Behind', 'mosaic-layouts-for-elementor' ),
				),
				'description'  => __( 'Visual aid for underlying grid structure.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Saved Setups Section ──────────────────────────────────────────
		$this->start_controls_section(
			'saved_setups_section',
			array(
				'label' => __( 'Saved Setups', 'mosaic-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'ml4e_saved_setup',
			array(
				'label'       => __( 'Layout & Style Setups', 'mosaic-layouts-for-elementor' ),
				'description' => __( 'Save, load, or delete layout and style configurations.', 'mosaic-layouts-for-elementor' ),
				'type'        => 'ml4e_saved_setups',
				'default'     => '',
			)
		);

		$this->end_controls_section();

		// ── Element Ordering Section ───────────────────────────────────────
		$this->register_element_ordering_controls(
			'ml4e_element_ordering',
			__( 'Element Order & Visibility', 'mosaic-layouts-for-elementor' ),
			array(
				$this->default_elements_visibility(
					__( 'Title', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Excerpt', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Featured Image', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Read More', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Terms', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Post Meta', 'mosaic-layouts-for-elementor' ),
					array( true, true, true, true, true )
				),
			)
		);

		// ── Style Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'product_style_settings_section',
			[
				'label' => esc_html__( 'Product Card Style', 'mosaic-layouts-for-elementor' ),
				'tab' => \Elementor\Controls_Manager::TAB_STYLE,
			]
		);

		$this->add_control(
			'ml4e_style_preset',
			array(
				'label'       => esc_html__( 'Style Preset', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::VISUAL_CHOICE,
				'columns'     => 4,
				'label_block' => true,
				'default'     => '',
				'options'     => $this->get_style_preset_options( 'content-layout' ),
				'description' => esc_html__( 'Pick a preset to instantly apply a complete style pack.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_style_preset_divider',
			array(
				'type' => Controls_Manager::DIVIDER,
			)
		);
/* 
		$this->add_control(
			'popover-toggle-test',
			[
				'label' => esc_html__( 'Popover test', 'mosaic-layouts-for-elementor' ),
				'type' => \Elementor\Controls_Manager::POPOVER_TOGGLE,
				'label_off' => esc_html__( 'Default', 'mosaic-layouts-for-elementor' ),
				'label_on' => esc_html__( 'Custom', 'mosaic-layouts-for-elementor' ),
				'return_value' => 'yes',
			]
		);
		$this->start_popover();
		$this->add_control(
				'popover_content',
				array(
					'type'            => Controls_Manager::RAW_HTML,
					'raw'             =>  __( '<strong>JUST AN EMPTY POPOVER', 'mosaic-layouts-for-elementor' ) ,
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
				'label' => esc_html__( 'Text', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'ml4e_title_size',
			array(
				'label'     => esc_html__( 'Title size', 'mosaic-layouts-for-elementor' ),
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
					'#ml4e-{{ID}} .flex-wrapper .product-elements .name' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'ml4e_price_size',
			array(
				'label'     => esc_html__( 'Price size', 'mosaic-layouts-for-elementor' ),
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
					'#ml4e-{{ID}} .flex-wrapper .product-elements .price' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'ml4e_button_size',
			array(
				'label'     => esc_html__( 'Button text size', 'mosaic-layouts-for-elementor' ),
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
					'#ml4e-{{ID}} .flex-wrapper .product-elements .add_to_cart_button' => 'font-size:{{SIZE}}{{UNIT}} !important;',
				),
			)
		);

		$this->add_responsive_control(
			'ml4e_taxonomy_size',
			array(
				'label'     => esc_html__( 'Taxonomy text size', 'mosaic-layouts-for-elementor' ),
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
					'#ml4e-{{ID}} .flex-wrapper .product-elements .taxonomy' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);
		$this->end_controls_tab();

		
		// Product layout tab.
		$this->start_controls_tab(
			'product_layout_tab',
			array(
				'label' => esc_html__( 'Layout', 'mosaic-layouts-for-elementor' ),
			)
		);
		$this->add_control(
			'ml4e_product_layout',
			array(
				'label'       => __( 'Product Card Layout', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'vertical',
				'options'     => array(
					'image-background' => __( 'Image background', 'mosaic-layouts-for-elementor' ),
					'horizontal'       => __( 'Image left', 'mosaic-layouts-for-elementor' ),
					'horizontal-alt'   => __( 'Image right', 'mosaic-layouts-for-elementor' ),
					'vertical'         => __( 'Image top', 'mosaic-layouts-for-elementor' ),
					'vertical-alt'     => __( 'Image bottom', 'mosaic-layouts-for-elementor' ),
				),
				// 'description' => __( 'Select predefined layout for product display.', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'hr_layout_align', [ 'type' => Controls_Manager::DIVIDER, ]
		);

		$this->add_responsive_control(
			'ml4e_product_align',
			array(
				'label'        => esc_html__( 'Align', 'mosaic-layouts-for-elementor' ),
				'type'         => Controls_Manager::CHOOSE,
				'options'      => array(
					'flex-start'   => array(
						'title' => __( 'Left', 'mosaic-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center' => array(
						'title' => __( 'Center', 'mosaic-layouts-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'flex-end'  => array(
						'title' => __( 'Right', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_product_vertical_align',
			array(
				'label'     => esc_html__( 'Vertical align', 'mosaic-layouts-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'flex-start' => array(
						'title' => __( 'Top', 'mosaic-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center'     => array(
						'title' => __( 'Center', 'mosaic-layouts-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'flex-end'   => array(
						'title' => __( 'Bottom', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_elements_gap',
			array(
				'label'     => esc_html__( 'Elements gap', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-layouts-for-elementor' ),
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
				'label' => esc_html__( 'Image', 'mosaic-layouts-for-elementor' ),
			)
		);
		
		$this->add_responsive_control(
			'ml4e_image_size',
			array(
				'label'     => esc_html__( 'Image size', 'mosaic-layouts-for-elementor' ),
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
					'ml4e_product_layout!' => 'image-background',
				)
			)
		);

		$this->add_control(
			'ml4e_featured_image_size',
			array(
				'label'       => esc_html__( 'Image resolution', 'mosaic-layouts-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'automatic',
				'options'     => $this->get_image_sizes(),
			)
		);

		$this->add_control(
			'ml4e_image_fit',
			array(
				'label'   => esc_html__( 'Image fit', 'mosaic-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'cover',
				'options' => array(
					'cover'      => __( 'Cover', 'mosaic-layouts-for-elementor' ),
					'contain'    => __( 'Contain', 'mosaic-layouts-for-elementor' ),
					'fill'       => __( 'Fill', 'mosaic-layouts-for-elementor' ),
					'none'       => __( 'None', 'mosaic-layouts-for-elementor' ),
					'scale-down' => __( 'Scale Down', 'mosaic-layouts-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'ml4e_featured_image_position',
			array(
				'label'       => esc_html__( 'Image position', 'mosaic-layouts-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the image within the product card.', 'mosaic-layouts-for-elementor' ),
				'type'        => 'ml4e_focal_point',
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
				'label' => esc_html__( 'Colors', 'mosaic-layouts-for-elementor' ),
			)
		);
		
		$this->add_control(
			'ml4e_text_color',
			array(
				'label'     => esc_html__( 'Text color', 'mosaic-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .product-elements' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'ml4e_links_color',
			array(
				'label'     => esc_html__( 'Links color', 'mosaic-layouts-for-elementor' ),
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
				'name'      => 'ml4e_background_color',
				'label'     => esc_html__( 'Background', 'mosaic-layouts-for-elementor' ),
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
				'label' => esc_html__( 'Borders', 'mosaic-layouts-for-elementor' ),
			)
		);
		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'      => 'ml4e_product_border',
				'label'     => __( 'Products border', 'mosaic-layouts-for-elementor' ),
				'selector'  => '{{WRAPPER}} .item-wrapper',
			)
		);

		$this->add_control(
			'ml4e_border_radius',
			array(
				'show_label' => true,
				'label'      => __( 'Border Radius', 'mosaic-layouts-for-elementor' ),
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
				'name'      => 'ml4e_box_shadow',
				'selector'  => '{{WRAPPER}} .item-wrapper',
			)
		);
		
		$this->end_controls_tab();

		$this->end_controls_tabs();

		$this->add_control(
			'special_elements_heading',
			array(
				'label' => esc_html__( 'Special Elements', 'mosaic-layouts-for-elementor' ),
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
				'label' => esc_html__( 'Badges', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'ml4e_sale_badge_size',
			array(
				'label'      => esc_html__( 'Sale badge text size', 'mosaic-layouts-for-elementor' ),
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
			'ml4e_sale_badge_color',
			array(
				'label'     => esc_html__( 'Sale badge text color', 'mosaic-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#FFFFFF',
				'selectors' => array(
					'{{WRAPPER}} .sale-badge' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'ml4e_sale_badge_backcolor',
			array(
				'label'     => esc_html__( 'Sale badge background color', 'mosaic-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#CC0000',
				'selectors' => array(
					'{{WRAPPER}} .sale-badge' => 'background-color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'ml4e_sale_badge_position',
			array(
				'label'       => esc_html__( 'Sale badge position', 'mosaic-layouts-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the sale badge within the product card.', 'mosaic-layouts-for-elementor' ),
				'type'        => 'ml4e_focal_point',
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
				'label' => esc_html__( 'Other', 'mosaic-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'ml4e_rating_size',
			array(
				'label'     => esc_html__( 'Rating stars size', 'mosaic-layouts-for-elementor' ),
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
