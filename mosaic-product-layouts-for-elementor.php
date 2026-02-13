<?php
/**
 * Plugin Name: Mosiac Product Layouts for Elementor
 * Plugin URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Author: Micemade
 * Author URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Description: A set of Elementor widgets to supercharge your WooCommerce online store with ReactJs.
 * Version: 0.1.0
 * License: 1.0.0
 * License URL: http://www.gnu.org/licenses/gpl-2.0.txt
 * text-domain: mosaic-product-layouts-for-elementor
 * Elementor tested up to: 3.43.1
 * Elementor Pro tested up to: 3.1.0
 */
namespace Micemade\MosaicProductLayoutsElementor;

use Micemade\MosaicProductLayoutsElementor\Widgets\ProductsLayout;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class MosaicProductLayoutsElementor {

	const VERSION                   = '0.1.0';
	const ELEMENTOR_MINIMUM_VERSION = '3.0.0';
	const PHP_MINIMUM_VERSION       = '7.0';

	private static $_instance = null;

	public function __construct() {
		add_action( 'init', array( $this, 'i18n' ) );
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
	}

	public function i18n() {
		load_plugin_textdomain( 'mosaic-product-layouts-for-elementor' );
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
	}

	/**
	 * Enqueue scripts for Elementor editor.
	 */
	public function enqueue_editor_scripts() {
		// Enqueue React and ReactDOM for editor
		wp_enqueue_script( 'react' );
		wp_enqueue_script( 'react-dom' );

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

		// Require the widget class.
		require_once __DIR__ . '/widgets/products-layout.php';

		// Register widget with elementor.
		$widgets_manager->register( new ProductsLayout() );

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
	}

	public function admin_notice_missing_elementor() {
		if ( isset( $_GET['activate'] ) ) {
			unset( $_GET['activate'] );
		}

		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor */
			esc_html__( '"%1$s" requires "%2$s" to be installed and activated.', 'mosaic-product-layouts-for-elementor' ),
			'<strong>' . esc_html__( 'Mosiac Product Layouts for Elementor', 'mosaic-product-layouts-for-elementor' ) . '</strong>',
			'<strong>' . esc_html__( 'Elementor', 'mosaic-product-layouts-for-elementor' ) . '</strong>'
		);

		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}
}

MosaicProductLayoutsElementor::get_instance();
