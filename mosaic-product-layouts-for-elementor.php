<?php
/**
 * Plugin Name: Mosiac Product Layouts for Elementor
 * Plugin URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Author: Micemade
 * Author URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Description: A set of Elementor widgets to supercharge your WooCommerce online store with creative layouts.
 * Version: 0.1.0
 * License: GPLv2 or later
 * License URL: http://www.gnu.org/licenses/gpl-2.0.txt
 * text-domain: mosaic-product-layouts-for-elementor
 * Elementor tested up to: 3.43.1
 * Elementor Pro tested up to: 3.1.0
 */

namespace Micemade\MosaicProductLayoutsElementor;

use Micemade\MosaicProductLayoutsElementor\Widgets\ProductsLayout;
use Micemade\MosaicProductLayoutsElementor\Widgets\CategoriesLayout;
use Micemade\MosaicProductLayoutsElementor\Widgets\SingleProductLayout;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MPL4E_VERSION' ) ) {
	define( 'MPL4E_VERSION', '0.1.0' );
}

if ( ! defined( 'MPL4E_PLUGIN_FILE' ) ) {
	define( 'MPL4E_PLUGIN_FILE', __FILE__ );
}

if ( ! defined( 'MPL4E_PLUGIN_DIR' ) ) {
	define( 'MPL4E_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'MPL4E_PLUGIN_URL' ) ) {
	define( 'MPL4E_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
}

final class MosaicProductLayoutsElementor {

	const ELEMENTOR_MINIMUM_VERSION = '3.0.0';
	const PHP_MINIMUM_VERSION       = '7.0';

	private static $_instance = null;

	public function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init_plugin' ) );
		add_action( 'elementor/elements/categories_registered', array( $this, 'create_new_category' ) );
		add_action( 'elementor/widgets/widgets_registered', array( $this, 'init_widgets' ) );
		add_action( 'elementor/controls/register', array( $this, 'init_controls' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ), 100 );
		add_action( 'elementor/editor/after_enqueue_scripts', array( $this, 'enqueue_editor_scripts' ) );
		add_action( 'elementor/preview/enqueue_scripts', array( $this, 'enqueue_preview_scripts' ) );

		// Register plugin settings for saved setups (wp_options via REST API).
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'rest_api_init', array( $this, 'register_settings' ) );

		// Initialize custom REST API endpoints.
		$this->init_rest_api();
	}

	public function init_plugin() {
		if ( version_compare( PHP_VERSION, self::PHP_MINIMUM_VERSION, '<' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_minimum_php_version' ) );
			return;
		}

		// Check if Elementor is installed and activated
		if ( ! did_action( 'elementor/loaded' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_missing_elementor' ) );
			return;
		}

		// Check for required Elementor version
		if ( ! version_compare( ELEMENTOR_VERSION, self::ELEMENTOR_MINIMUM_VERSION, '>=' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_minimum_elementor_version' ) );
			return;
		}

		// check if elementor is installed
		// bring in the widget classes
		// bring in the controls
	}

	/**
	 * Register custom Elementor controls.
	 *
	 * @param \Elementor\Controls_Manager $controls_manager Elementor controls manager.
	 */
	public function init_controls( $controls_manager ) {
		// Require the focal point control class.
		require_once __DIR__ . '/controls/focal-point.php';

		// Register the focal point control.
		$controls_manager->register( new \Micemade\MosaicProductLayoutsElementor\Controls\Focal_Point() );

		// Require and register the saved setups control.
		require_once __DIR__ . '/controls/saved-setups.php';
		$controls_manager->register( new \Micemade\MosaicProductLayoutsElementor\Controls\Saved_Setups() );

		// Require and register the product select control.
		require_once __DIR__ . '/controls/product-select.php';
		$controls_manager->register( new \Micemade\MosaicProductLayoutsElementor\Controls\Product_Select() );

		// Require and register the element sorting control.
		require_once __DIR__ . '/controls/element-sorting.php';
		$controls_manager->register( new \Micemade\MosaicProductLayoutsElementor\Controls\Element_Sorting() );
	}

	/**
	 * Enqueue scripts for Elementor editor.
	 */
	public function enqueue_editor_scripts() {
		// Enqueue React and ReactDOM for editor
		wp_enqueue_script( 'react' );
		wp_enqueue_script( 'react-dom' );

		// Panel-only styles (parent window, not the preview iframe).
		wp_register_style( 'mpl4e-editor-panel', false );
		wp_enqueue_style( 'mpl4e-editor-panel' );
		wp_add_inline_style(
			'mpl4e-editor-panel',
			'.elementor-control-mpl4e_sp_group_styles .elementor-repeater-row-tool.elementor-repeater-tool-duplicate{display:none!important}'
		);

		// The control script is enqueued by the control's enqueue() method
	}

	/**
	 * Enqueue scripts for Elementor editor preview (iframe).
	 * Full-featured script with drag/resize, add/remove items, settings sync.
	 */
	public function enqueue_preview_scripts() {
		// Enqueue WordPress's React and ReactDOM
		wp_enqueue_script( 'react' );
		wp_enqueue_script( 'react-dom' );
		wp_enqueue_media();

		// Editor script (full functionality)
		wp_enqueue_script(
			'mpl4e-editor-js',
			plugin_dir_url( __FILE__ ) . 'assets/admin/js/main-editor.js',
			array( 'jquery', 'elementor-frontend', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'mpl4e-editor-css',
			plugin_dir_url( __FILE__ ) . 'assets/admin/css/main-editor.css',
			array(),
			'1.0.0'
		);

		// Add WooCommerce Store API nonce for editor preview
		$this->enqueue_store_api_nonce();
	}

	public function init_widgets( $widgets_manager ) {

		// Require shared trait and widget classes.
		require_once __DIR__ . '/includes/trait-widget-helpers.php';
		require_once __DIR__ . '/widgets/products-layout.php';
		require_once __DIR__ . '/widgets/categories-layout.php';
		require_once __DIR__ . '/widgets/single-product-layout.php';

		// Register widgets with elementor.
		$widgets_manager->register( new ProductsLayout() );
		$widgets_manager->register( new CategoriesLayout() );
		$widgets_manager->register( new SingleProductLayout() );

	}

	public static function get_instance() {

		if ( null == self::$_instance ) {
			self::$_instance = new self();
		}

		return self::$_instance;

	}

	public function create_new_category( $elements_manager ) {

		$elements_manager->add_category(
			'micemade-widgets',
			array(
				'title' => __( 'Micemade Widgets', 'mosaic-product-layouts-for-elementor' ),
				'icon'  => 'fa fa-plug',
			)
		);

	}

	public function enqueue_scripts() {
		// Only enqueue if Elementor is active and on a page with Elementor content
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return;
		}
		
		// Skip on Elementor preview (editor uses its own script)
		if ( \Elementor\Plugin::$instance->preview->is_preview_mode() ) {
			return;
		}
		
		// Check if current page uses Elementor
		$post_id = get_the_ID();
		if ( ! $post_id || ! \Elementor\Plugin::$instance->db->is_built_with_elementor( $post_id ) ) {
			return;
		}
		
		// Enqueue WordPress's React and ReactDOM
		wp_enqueue_script( 'react' );
		wp_enqueue_script( 'react-dom' );
		
		// Frontend-only script (lightweight, no editor features)
		wp_enqueue_script(
			'mpl4e-frontend-js',
			plugin_dir_url( __FILE__ ) . 'assets/js/main-frontend.js',
			array( 'jquery', 'elementor-frontend', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'mpl4e-css',
			plugin_dir_url( __FILE__ ) . 'assets/css/main-frontend.css',
			array(),
			'1.0.0'
		);

		// Add WooCommerce Store API nonce for AJAX cart operations
		$this->enqueue_store_api_nonce();
	}

	/**
	 * Enqueue WooCommerce Store API nonce for AJAX add-to-cart functionality.
	 * This allows our React components to interact with the WC Store API.
	 */
	private function enqueue_store_api_nonce() {
		// Only proceed if WooCommerce is active
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		// Get the Store API nonce
		$nonce = '';
		if ( class_exists( '\Automattic\WooCommerce\StoreApi\StoreApi' ) ) {
			// WooCommerce 8.3+
			$nonce = wp_create_nonce( 'wc_store_api' );
		} elseif ( function_exists( 'wc_store_api_nonce' ) ) {
			// Fallback for older versions
			$nonce = wc_store_api_nonce();
		} else {
			// Generate nonce manually
			$nonce = wp_create_nonce( 'wc_store_api' );
		}

		$localize_data = array(
			'storeApiNonce'   => $nonce,
			'restNonce'       => wp_create_nonce( 'wp_rest' ),
			'cartUrl'         => wc_get_cart_url(),
			'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
			'placeholderImg'  => plugins_url( 'assets/images/woocommerce-placeholder-300x300.png', __FILE__ ),
		);

		// Localize scripts with Store API configuration
		wp_localize_script( 'mpl4e-frontend-js', 'MPL4E', $localize_data );
		wp_localize_script( 'mpl4e-editor-js', 'MPL4E', $localize_data );

	}

	/**
	 * Register plugin settings for saved setups.
	 *
	 * Registers WP option 'mpl4e_products_layout_setups' with show_in_rest
	 * so it can be read/written via wp.apiFetch({ path: '/wp/v2/settings' }).
	 */
	public function register_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$setting_args = array(
			'type'              => 'string',
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => '',
		);

		register_setting( 'options', 'mpl4e_products_layout_setups', $setting_args );
		register_setting( 'options', 'mpl4e_categories_layout_setups', $setting_args );
		register_setting( 'options', 'mpl4e_single_product_layout_setups', $setting_args );
	}

	/**
	 * Initialize custom REST API endpoints.
	 *
	 * @return void
	 */
	private function init_rest_api() {
		require_once __DIR__ . '/includes/class-rest-api.php';
		$rest_api = new RestAPI();
		$rest_api->init();
	}

	public function admin_notice_missing_elementor() {
		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor */
			__( '"%1$s" requires "%2$s" to be installed and activated.', 'mosaic-product-layouts-for-elementor' ),
			'<strong>' . __( 'Mosaic Product Layouts for Elementor', 'mosaic-product-layouts-for-elementor' ) . '</strong>',
			'<strong>' . __( 'Elementor', 'mosaic-product-layouts-for-elementor' ) . '</strong>'
		);

		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', wp_kses_post( $message ) );
	}
}

MosaicProductLayoutsElementor::get_instance();
