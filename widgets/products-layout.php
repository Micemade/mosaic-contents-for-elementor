<?php

namespace Micemade\MosaicProductLayoutsElementor\Widgets;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

/**
 * Products Layout Widget for Elementor.
 *
 * Displays WooCommerce products using React rendering with WC Store API.
 * Query settings are passed to React via content_template hidden input.
 */
class ProductsLayout extends Widget_Base {

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
		$categories = array(
			'' => __( 'All Categories', 'mosaic-product-layouts-for-elementor' ),
		);

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
				$categories[ $term->term_id ] = $term->name;
			}
		}

		return $categories;
	}

	/**
	 * Register widget controls.
	 */
	public function register_controls() {

		// Content Section - Query Settings.
		$this->start_controls_section(
			'query_section',
			array(
				'label' => __( 'Query Settings', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'widget_title',
			array(
				'label'       => esc_html__( 'Title', 'mosaic-product-layouts-for-elementor' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => esc_html__( 'Products', 'mosaic-product-layouts-for-elementor' ),
				'placeholder' => esc_html__( 'Type your title here', 'mosaic-product-layouts-for-elementor' ),
			)
		);

		$this->add_control(
			'per_page',
			array(
				'label'   => __( 'Products Per Page', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::NUMBER,
				'min'     => 1,
				'max'     => 100,
				'default' => 10,
			)
		);

		$this->add_control(
			'orderby',
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
			'order',
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
			'category',
			array(
				'label'   => __( 'Category', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '',
				'options' => $this->get_product_categories(),
			)
		);

		$this->add_control(
			'on_sale',
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
			'featured',
			array(
				'label'        => __( 'Featured Only', 'mosaic-product-layouts-for-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'mosaic-product-layouts-for-elementor' ),
				'label_off'    => __( 'No', 'mosaic-product-layouts-for-elementor' ),
				'return_value' => 'yes',
				'default'      => '',
			)
		);

		$this->end_controls_section();

		// Layout Section.
		$this->start_controls_section(
			'layout_section',
			array(
				'label' => __( 'Layout', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'layout',
			array(
				'label'       => __( 'Select Layout', 'mosaic-product-layouts-for-elementor' ),
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
			'items_margin',
			array(
				'label'   => __( 'Items Margin', 'mosaic-product-layouts-for-elementor' ),
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
			'row_height',
			array(
				'label'   => __( 'Row Height', 'mosaic-product-layouts-for-elementor' ),
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
			'allow_overlap',
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
			'compaction_type',
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
					'allow_overlap!' => 'yes',
				),
			)
		);

		$this->end_controls_section();

		// Style Section.
		$this->start_controls_section(
			'style_section',
			array(
				'label' => __( 'Style', 'mosaic-product-layouts-for-elementor' ),
				'tab'   => Controls_Manager::TAB_STYLE,
			)
		);

		$this->add_control(
			'bg_color',
			array(
				'label'     => __( 'Background Color', 'mosaic-product-layouts-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					'{{WRAPPER}} .products-layout' => 'background-color: {{VALUE}}',
				),
			)
		);

		$this->add_control(
			'columns',
			array(
				'label'   => __( 'Columns', 'mosaic-product-layouts-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'default' => '3',
				'options' => array(
					'1' => '1',
					'2' => '2',
					'3' => '3',
					'4' => '4',
					'5' => '5',
					'6' => '6',
				),
			)
		);

		$this->add_control(
			'gap',
			array(
				'label'      => __( 'Gap', 'mosaic-product-layouts-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem' ),
				'range'      => array(
					'px' => array(
						'min' => 0,
						'max' => 100,
					),
				),
				'default'    => array(
					'unit' => 'px',
					'size' => 20,
				),
				'selectors'  => array(
					'{{WRAPPER}} .products-layout-grid' => 'gap: {{SIZE}}{{UNIT}};',
				),
			)
		);

		$this->end_controls_section();
	}

	private function sanitize_setting( $setting, $default ) {
		$settings = $this->get_settings_for_display();
		if ( isset( $settings[$setting] ) ) {
			return $settings[$setting];
		}
		return $default;
	}

	/**
	 * Render widget on frontend.
	 * Outputs wrapper with settings JSON for React to hydrate.
	 */
	protected function render() {

		$query_settings = array(
			'title'           => $this->sanitize_setting( 'widget_title', '' ),
			'per_page'        => $this->sanitize_setting( 'per_page', 10 ),
			'orderby'         => $this->sanitize_setting( 'orderby', 'date' ),
			'order'           => $this->sanitize_setting( 'order', 'desc' ),
			'category'        => $this->sanitize_setting( 'category', '' ),
			'on_sale'         => 'yes' === $this->sanitize_setting( 'on_sale', 'no' ),
			'featured'        => 'yes' === $this->sanitize_setting( 'featured', 'no' ),
			'columns'         => $this->sanitize_setting( 'columns', '3' ),
			'layout'          => $this->sanitize_setting( 'layout', 'grid' ),
			'items_margin'    => $this->sanitize_setting( 'items_margin', 0 ),
			'row_height'      => $this->sanitize_setting( 'row_height', 200 ),
			'allow_overlap'   => 'yes' === $this->sanitize_setting( 'allow_overlap', 'no' ),
			'compaction_type' => $this->sanitize_setting( 'compaction_type', 'vertical' ),
		);

		$json_data = wp_json_encode( $query_settings );
		$widget_id = $this->get_id();
		?>
<div class="products-layout-wrapper" data-widget-id="<?php echo esc_attr( $widget_id ); ?>">
	<input type="hidden" class="elementor-settings-data" value="<?php echo esc_attr( $json_data ); ?>" />
	<div class="products-layout-react-root"></div>
</div>
<?php
	}

	/**
	 * Editor template - static wrapper for React (no Underscore.js variables).
	 * Settings are passed via Elementor model change listener in JS.
	 */
	protected function content_template() {
		?>
<div class="products-layout-wrapper">
	<div class="products-layout-react-root"></div>
</div>
<?php
	}
}
