<?php

namespace Micemade\MosaicContentsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Repeater;
use Micemade\MosaicContentsElementor\WidgetHelpers;
use Micemade\MosaicContentsElementor\RestAPI;

/**
 * Content Layout Widget for Elementor.
 *
 * Displays general-purpose post content using React rendering with WP REST API.
 * Query settings are passed to React via content_template hidden input.
 */
class ContentLayout extends Widget_Base {

	use WidgetHelpers;

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
		return __( 'Content Layout', 'mosaic-contents-for-elementor' );
	}

	public function get_icon() {
		return 'eicon-posts-grid';
	}

	public function get_categories() {
		return array( 'micemade-mosaic-contents-for-elementor' );
	}

	/**
	 * Get all public REST-enabled post types.
	 *
	 * @return array[] Array of post type metadata, each with keys: name, label, rest_base, taxonomies, taxonomy_labels, taxonomy_rest_bases.
	 */
	public function get_post_types_data(): array {
		$post_types = get_post_types(
			array(
				'public'             => true,
				'publicly_queryable' => true,
				'show_in_rest'       => true,
			),
			'objects'
		);

		$data = array();

		foreach ( $post_types as $post_type ) {
			// Filter out unwanted post types
			if ( in_array( $post_type->name, array( 'e-floating-buttons', 'elementor_library' ), true ) ) {
				continue;
			}

			$post_type_taxonomies = get_object_taxonomies( $post_type->name, 'objects' );
			$taxonomies           = array();
			$taxonomy_labels      = array();
			$taxonomy_rest_bases  = array();

			foreach ( $post_type_taxonomies as $taxonomy ) {
				if ( empty( $taxonomy->public ) || empty( $taxonomy->show_in_rest ) ) {
					continue;
				}

				$taxonomies[]                           = $taxonomy->name;
				$taxonomy_labels[ $taxonomy->name ]     = $taxonomy->label;
				$taxonomy_rest_bases[ $taxonomy->name ] = ! empty( $taxonomy->rest_base ) ? $taxonomy->rest_base : $taxonomy->name;
			}

			$data[] = array(
				'name'                => $post_type->name,
				'label'               => $post_type->label,
				'rest_base'           => ! empty( $post_type->rest_base ) ? $post_type->rest_base : $post_type->name,
				'taxonomies'          => array_values( $taxonomies ),
				'taxonomy_labels'     => $taxonomy_labels,
				'taxonomy_rest_bases' => $taxonomy_rest_bases,
			);
		}

		return $data;
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
		$options = array();

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
				'label' => __( 'Query Settings', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mc4e_post_type',
			array(
				'label'   => __( 'Post Type', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => $default_post_type,
				'options' => $post_type_options,
			)
		);

		$this->add_control(
			'mc4e_taxonomy',
			array(
				'label'   => __( 'Taxonomy', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => $default_taxonomy,
				'options' => $taxonomy_options,
			)
		);

		$this->add_control(
			'mc4e_terms',
			array(
				'label'       => __( 'Terms', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::SELECT2,
				'default'     => array(),
				'options'     => $this->get_terms_options( $default_taxonomy ),
				'multiple'    => true,
				'label_block' => true,
			)
		);

		$this->add_control(
			'mc4e_orderby',
			array(
				'label'   => __( 'Order By', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'date',
				'options' => array(
					'date'       => __( 'Date', 'mosaic-contents-for-elementor' ),
					'title'      => __( 'Title', 'mosaic-contents-for-elementor' ),
					'modified'   => __( 'Modified', 'mosaic-contents-for-elementor' ),
					'menu_order' => __( 'Menu Order', 'mosaic-contents-for-elementor' ),
					'random'       => __( 'Random', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mc4e_order',
			array(
				'label'   => __( 'Order', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'desc',
				'options' => array(
					'desc' => __( 'Descending', 'mosaic-contents-for-elementor' ),
					'asc'  => __( 'Ascending', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mc4e_sticky',
			array(
				'label'        => __( 'Sticky Only', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-contents-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-contents-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->add_control(
			'mc4e_enable_pagination',
			array(
				'label'        => __( 'Enable Pagination', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-contents-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-contents-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'post_meta_section',
			array(
				'label' => __( 'Post Meta Display', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$meta_repeater = new Repeater();

		$meta_repeater->add_control(
			'meta_key',
			array(
				'label'       => __( 'Meta Key', 'mosaic-contents-for-elementor' ),
				'type'        => 'mc4e_meta_key_select',
				'label_block' => true,
			)
		);

		$meta_repeater->add_control(
			'meta_label',
			array(
				'label'       => __( 'Display Label', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::TEXT,
				'label_block' => true,
			)
		);

		$meta_repeater->add_control(
			'meta_prefix',
			array(
				'label' => __( 'Prefix', 'mosaic-contents-for-elementor' ),
				'type'  => Controls_Manager::TEXT,
			)
		);

		$meta_repeater->add_control(
			'meta_suffix',
			array(
				'label' => __( 'Suffix', 'mosaic-contents-for-elementor' ),
				'type'  => Controls_Manager::TEXT,
			)
		);

		$meta_repeater->add_control(
			'meta_condition',
			array(
				'label'   => __( 'Condition', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'always',
				'options' => array(
					'always'     => __( 'Always', 'mosaic-contents-for-elementor' ),
					'not_empty'  => __( 'Not Empty', 'mosaic-contents-for-elementor' ),
					'equals'     => __( 'Equals', 'mosaic-contents-for-elementor' ),
					'not_equals' => __( 'Not Equals', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$meta_repeater->add_control(
			'meta_condition_value',
			array(
				'label'     => __( 'Condition Value', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::TEXT,
				'condition' => array(
					'meta_condition' => array( 'equals', 'not_equals' ),
				),
			)
		);

		$this->add_control(
			'mc4e_post_meta',
			array(
				'label'       => __( 'Meta Fields', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::REPEATER,
				'fields'      => $meta_repeater->get_controls(),
				'title_field' => '{{{ meta_key }}}',
			)
		);

		// ── Author ─────────────────────────────────────────────────────────
		$this->add_control(
			'mc4e_author_heading',
			array(
				'label'     => __( 'Author', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		$this->add_control(
			'mc4e_author_prefix',
			array(
				'label'   => __( 'Author Prefix', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::TEXT,
				'default' => __( 'By ', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_author_link',
			array(
				'label'        => __( 'Link to Author Archive', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-contents-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-contents-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		// ── Date ───────────────────────────────────────────────────────────
		$this->add_control(
			'mc4e_date_heading',
			array(
				'label'     => __( 'Date', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		$this->add_control(
			'mc4e_date_type',
			array(
				'label'   => __( 'Date to Show', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'published',
				'options' => array(
					'published' => __( 'Published', 'mosaic-contents-for-elementor' ),
					'modified'  => __( 'Last Modified', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mc4e_date_format',
			array(
				'label'   => __( 'Date Format', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'long',
				'options' => array(
					'long'    => __( 'Long (e.g. January 1, 2026)', 'mosaic-contents-for-elementor' ),
					'medium'  => __( 'Medium (e.g. Jan 1, 2026)', 'mosaic-contents-for-elementor' ),
					'short'   => __( 'Short (e.g. 01/01/2026)', 'mosaic-contents-for-elementor' ),
					'numeric' => __( 'Numeric (e.g. 2026-01-01)', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		// ── Terms ──────────────────────────────────────────────────────────
		$this->add_control(
			'mc4e_terms_heading',
			array(
				'label'     => __( 'Terms', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		$this->add_control(
			'mc4e_terms_taxonomy',
			array(
				'label'       => __( 'Show Terms From', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				// Seeded for the default post type; re-populated per selected
				// post type by editor-hooks.js (syncTaxonomyOptionsForPostType).
				'options'     => array_merge(
					array( '' => __( 'All taxonomies', 'mosaic-contents-for-elementor' ) ),
					$taxonomy_options
				),
				'description' => __( 'Which taxonomy to pull the displayed terms from.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->end_controls_section();

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
				'options'     => $this->get_layout_options( 'content-layout' ),
				'description' => __( 'Choose a predefined layout for the items grid. Layouts 1-9 display 3 items, Layouts 10-14 display 4 items.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_custom_layout',
			array(
				'label'       => __( 'Custom Layout', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::HIDDEN,
				'default'     => '',
				'description' => __( 'Stores custom layout data when you drag/resize items in the editor.', 'mosaic-contents-for-elementor' ),
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
				'description' => __( 'Add a new item to the layout.', 'mosaic-contents-for-elementor' ),
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
				'description'  => __( 'Allow grid items to overlap each other.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_compaction_type',
			array(
				'label'       => __( 'Compaction Type', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'vertical',
				'options'     => array(
					'vertical'   => __( 'Vertical', 'mosaic-contents-for-elementor' ),
					'horizontal' => __( 'Horizontal', 'mosaic-contents-for-elementor' ),
					'none'       => __( 'None', 'mosaic-contents-for-elementor' ),
				),
				'description' => __( 'How items compact when moved. "None" keeps items in place.', 'mosaic-contents-for-elementor' ),
				'condition'   => array(
					'mc4e_allow_overlap!' => 'yes',
				),
			)
		);

		$this->add_control(
			'mc4e_helper_notice',
			array(
				'type'        => \Elementor\Controls_Manager::NOTICE,
				'notice_type' => 'info',
				'dismissible' => false,
				'heading'     => esc_html__( 'Helpers', 'mosaic-contents-for-elementor' ),
				'content'     => esc_html__( 'Visual aid - a grid visualization for placing and resizing items.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_helper_grid',
			array(
				'label'       => __( 'Grid Visualization', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'none',
				'options'     => array(
					'none'   => __( 'None', 'mosaic-contents-for-elementor' ),
					'front'  => __( 'Front', 'mosaic-contents-for-elementor' ),
					'behind' => __( 'Behind', 'mosaic-contents-for-elementor' ),
				),
				'description' => __( 'Visual aid for underlying grid structure.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->end_controls_section();

		// ── Saved Setups Section ──────────────────────────────────────────
		$this->start_controls_section(
			'saved_setups_section',
			array(
				'label' => __( 'Saved Setups', 'mosaic-contents-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'mc4e_saved_setup',
			array(
				'label'       => __( 'Layout & Style Setups', 'mosaic-contents-for-elementor' ),
				'description' => __( 'Save, load, or delete layout and style configurations.', 'mosaic-contents-for-elementor' ),
				'type'        => 'mc4e_saved_setups',
				'default'     => '',
			)
		);

		$this->end_controls_section();

		// ── Element Ordering Section ───────────────────────────────────────
		$this->register_element_ordering_controls(
			'mc4e_element_ordering',
			__( 'Element Order & Visibility', 'mosaic-contents-for-elementor' ),
			array(
				$this->default_elements_visibility(
					__( 'Terms', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Title', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Excerpt', 'mosaic-contents-for-elementor' ),
					array( false, false, false, false, false )
				),
				$this->default_elements_visibility(
					__( 'Featured Image', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Read More', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Post Author', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Post Date', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
				$this->default_elements_visibility(
					__( 'Post Meta', 'mosaic-contents-for-elementor' ),
					array( true, true, true, true, true )
				),
			)
		);

		// ── Style Section ────────────────────────────────────────────────
		$this->start_controls_section(
			'card_style_settings_section',
			array(
				'label' => esc_html__( 'Item Card Style', 'mosaic-contents-for-elementor' ),
				'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'mc4e_style_preset',
			array(
				'label'       => esc_html__( 'Style Preset', 'mosaic-contents-for-elementor' ),
				'type'        => Controls_Manager::VISUAL_CHOICE,
				'columns'     => 4,
				'label_block' => true,
				'default'     => '',
				'options'     => $this->get_style_preset_options( 'content-layout' ),
				'description' => esc_html__( 'Pick a preset to instantly apply a complete style pack.', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_style_preset_divider',
			array(
				'type' => Controls_Manager::DIVIDER,
			)
		);

		// ACTIVE, HOVER, INACTIVE.
		$this->start_controls_tabs( 'card_styles' );

		// Text controls tab.
		$this->start_controls_tab(
			'text_sizes_tab',
			array(
				'label' => esc_html__( 'Text', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mc4e_title_size',
			array(
				'label'          => esc_html__( 'Title size', 'mosaic-contents-for-elementor' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'        => array(
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
				'range'          => self::get_range(),
				'selectors'      => array(
					'#mc4e-{{ID}} .flex-wrapper .item-elements .name' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'mc4e_excerpt_size',
			array(
				'label'          => esc_html__( 'Excerpt size', 'mosaic-contents-for-elementor' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'        => array(
					'size' => 16,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 16,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'range'          => self::get_range(),
				'selectors'      => array(
					'#mc4e-{{ID}} .flex-wrapper .item-elements .excerpt' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_responsive_control(
			'mc4e_readmore_size',
			array(
				'label'          => esc_html__( 'Read more text size', 'mosaic-contents-for-elementor' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'        => array(
					'size' => 16,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 12,
					'unit' => 'px',
				),
				'range'          => self::get_range(),
				'selectors'      => array(
					'#mc4e-{{ID}} .flex-wrapper .item-elements .read-more-link' => 'font-size:{{SIZE}}{{UNIT}} !important;',
				),
			)
		);

		$this->add_responsive_control(
			'mc4e_taxonomy_size',
			array(
				'label'          => esc_html__( 'Terms text size', 'mosaic-contents-for-elementor' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'        => array(
					'size' => 14,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 12,
					'unit' => 'px',
				),
				'range'          => self::get_range(),
				'selectors'      => array(
					'#mc4e-{{ID}} .flex-wrapper .item-elements .taxonomy' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'mc4e_excerpt_truncate',
			array(
				'label'        => esc_html__( 'Truncate excerpt', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-contents-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-contents-for-elementor' ),
				'return_value' => 'yes',
				'default'      => 'yes',
				'separator'    => 'before',
			)
		);

			$this->add_control(
				'mc4e_excerpt_truncate_lines',
				array(
					'label'     => esc_html__( 'Truncate lines', 'mosaic-contents-for-elementor' ),
					'type'      => Controls_Manager::NUMBER,
					'min'       => 1,
					'max'       => 20,
					'default'   => 2,
					'selectors' => array(
						'{{WRAPPER}} .item-elements .excerpt.truncated' => '-webkit-line-clamp: {{VALUE}};',
					),
					'condition' => array(
						'mc4e_excerpt_truncate' => 'yes',
					),
				)
			);

			$this->add_responsive_control(
				'mc4e_date_size',
				array(
					'label'          => esc_html__( 'Date size', 'mosaic-contents-for-elementor' ),
					'type'           => Controls_Manager::SLIDER,
					'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
					'default'        => array(
						'size' => 14,
						'unit' => 'px',
					),
					'tablet_default' => array(
						'size' => 14,
						'unit' => 'px',
					),
					'mobile_default' => array(
						'size' => 12,
						'unit' => 'px',
					),
					'range'          => self::get_range(),
					'selectors'      => array(
						'#mc4e-{{ID}} .flex-wrapper .item-elements .post-date' => 'font-size:{{SIZE}}{{UNIT}};',
					),
				)
			);

		$this->add_responsive_control(
			'mc4e_author_size',
			array(
				'label'          => esc_html__( 'Author text size', 'mosaic-contents-for-elementor' ),
				'type'           => Controls_Manager::SLIDER,
				'size_units'     => array( 'px', 'em', 'rem', 'vw', 'vh' ),
				'default'        => array(
					'size' => 14,
					'unit' => 'px',
				),
				'tablet_default' => array(
					'size' => 14,
					'unit' => 'px',
				),
				'mobile_default' => array(
					'size' => 12,
					'unit' => 'px',
				),
				'range'          => self::get_range(),
				'selectors'      => array(
					'#mc4e-{{ID}} .flex-wrapper .item-elements .post-author' => 'font-size:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_tab();

		// The layout tab.
		$this->start_controls_tab(
			'layout_tab',
			array(
				'label' => esc_html__( 'Layout', 'mosaic-contents-for-elementor' ),
			)
		);
		$this->add_control(
			'mc4e_item_layout',
			array(
				'label'   => __( 'Item Card Layout', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'vertical',
				'options' => array(
					'image-background' => __( 'Image background', 'mosaic-contents-for-elementor' ),
					'horizontal'       => __( 'Image left', 'mosaic-contents-for-elementor' ),
					'horizontal-alt'   => __( 'Image right', 'mosaic-contents-for-elementor' ),
					'vertical'         => __( 'Image top', 'mosaic-contents-for-elementor' ),
					'vertical-alt'     => __( 'Image bottom', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'hr_layout_align',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mc4e_item_align',
			array(
				'label'     => esc_html__( 'Align', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'flex-start' => array(
						'title' => __( 'Left', 'mosaic-contents-for-elementor' ),
						'icon'  => 'eicon-h-align-left',
					),
					'center'     => array(
						'title' => __( 'Center', 'mosaic-contents-for-elementor' ),
						'icon'  => 'eicon-h-align-center',
					),
					'flex-end'   => array(
						'title' => __( 'Right', 'mosaic-contents-for-elementor' ),
						'icon'  => 'eicon-h-align-right',
					),

				),
				'default'   => '',
				'selectors' => array(
					'{{WRAPPER}} .item-wrapper .flex-wrapper .item-elements' => 'justify-content: {{VALUE}};',
					'{{WRAPPER}} .item-wrapper .flex-wrapper .item-elements > *' => 'justify-content: {{VALUE}};',
				),
			)
		);

		$this->add_responsive_control(
			'mc4e_item_vertical_align',
			array(
				'label'     => esc_html__( 'Vertical align', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::CHOOSE,
				'options'   => array(
					'flex-start' => array(
						'title' => __( 'Top', 'mosaic-contents-for-elementor' ),
						'icon'  => 'eicon-v-align-top',
					),
					'center'     => array(
						'title' => __( 'Center', 'mosaic-contents-for-elementor' ),
						'icon'  => 'eicon-v-align-middle',
					),
					'flex-end'   => array(
						'title' => __( 'Bottom', 'mosaic-contents-for-elementor' ),
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
			'hr_layout_gap',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mc4e_elements_gap',
			array(
				'label'      => esc_html__( 'Elements gap', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'default'    => array(
					'size' => 0.2,
					'unit' => 'em',
				),
				'range'      => self::get_range(),
				'selectors'  => array(
					'{{WRAPPER}} .item-elements' => 'gap:{{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->add_control(
			'hr_layout_padding',
			array( 'type' => Controls_Manager::DIVIDER )
		);

		$this->add_responsive_control(
			'mc4e_padding',
			array(
				'label'      => __( 'Padding', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem', 'vw', 'vh' ),
				'selectors'  => array(
					'{{WRAPPER}} .item-wrapper .flex-wrapper' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_tab();

		// Featured image controls tab.
		$this->start_controls_tab(
			'featured_image_tab',
			array(
				'label' => esc_html__( 'Image', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_responsive_control(
			'mc4e_image_size',
			array(
				'label'     => esc_html__( 'Image size', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
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
					'{{WRAPPER}} .item-wrapper .featured-image' => 'flex-basis: {{size}}%;',
					'{{WRAPPER}} .item-wrapper .flex-wrapper' => 'flex-basis: calc(100% - {{size}}%);',
				),
				'condition' => array(
					'mc4e_item_layout!' => 'image-background',
				),
			)
		);

		$this->add_control(
			'mc4e_image_resolution',
			array(
				'label'   => esc_html__( 'Image resolution', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'automatic',
				'options' => $this->get_image_sizes(),
			)
		);

		$this->add_control(
			'mc4e_image_fit',
			array(
				'label'   => esc_html__( 'Image fit', 'mosaic-contents-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => 'cover',
				'options' => array(
					'cover'      => __( 'Cover', 'mosaic-contents-for-elementor' ),
					'contain'    => __( 'Contain', 'mosaic-contents-for-elementor' ),
					'fill'       => __( 'Fill', 'mosaic-contents-for-elementor' ),
					'none'       => __( 'None', 'mosaic-contents-for-elementor' ),
					'scale-down' => __( 'Scale Down', 'mosaic-contents-for-elementor' ),
				),
			)
		);

		$this->add_control(
			'mc4e_featured_image_position',
			array(
				'label'       => esc_html__( 'Image position', 'mosaic-contents-for-elementor' ),
				'description' => esc_html__( 'Drag the focal point to position the image within the item card.', 'mosaic-contents-for-elementor' ),
				'type'        => 'mc4e_focal_point',
				'default'     => array(
					'x' => 50,
					'y' => 50,
				),
			)
		);

		$this->end_controls_tab();

		// item colors tab.
		$this->start_controls_tab(
			'item_colors_tab',
			array(
				'label' => esc_html__( 'Colors', 'mosaic-contents-for-elementor' ),
			)
		);

		$this->add_control(
			'mc4e_text_color',
			array(
				'label'     => esc_html__( 'Text color', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .item-elements' => 'color: {{VALUE}};',
				),
			)
		);

		$this->add_control(
			'mc4e_links_color',
			array(
				'label'     => esc_html__( 'Links color', 'mosaic-contents-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#333333',
				'selectors' => array(
					'{{WRAPPER}} .item-elements .name a, {{WRAPPER}} .item-elements .taxonomy a, {{WRAPPER}} .item-elements a:not(.read-more-link)' => 'color: {{VALUE}};',
				),
			)
		);
		$this->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'     => 'mc4e_background_color',
				'label'    => esc_html__( 'Background', 'mosaic-contents-for-elementor' ),
				'types'    => array( 'classic', 'gradient' ),
				'selector' => '{{WRAPPER}} .item-wrapper .flex-wrapper',
				'default'  => '#ffffff',
			)
		);

		$this->end_controls_tab();

		// Item borders tab.
		$this->start_controls_tab(
			'item_border_tab',
			array(
				'label' => esc_html__( 'Borders', 'mosaic-contents-for-elementor' ),
			)
		);
		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'     => 'mc4e_item_border',
				'label'    => __( 'items border', 'mosaic-contents-for-elementor' ),
				'selector' => '{{WRAPPER}} .item-wrapper',
			)
		);

		$this->add_control(
			'mc4e_border_radius',
			array(
				'show_label' => true,
				'label'      => __( 'Border Radius', 'mosaic-contents-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'selectors'  => array(
					'{{WRAPPER}} .item-wrapper' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
			)
		);

		$this->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'     => 'mc4e_box_shadow',
				'selector' => '{{WRAPPER}} .item-wrapper',
			)
		);

		$this->end_controls_tab();

		$this->end_controls_tabs();

		$this->end_controls_section();
	}
}
