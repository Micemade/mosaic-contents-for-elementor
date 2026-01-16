<?php
/**
 * Plugin Name: Mosiac Product Layouts for Elementor
 * Plugin URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Author: Micemade
 * Author URI: https://github.com/Micemade/mosaic-product-layouts-for-elementor
 * Description: A set of Elementor widgets to supercharge your WooCommerce online store with ReactJs.
 * Version: 1.0.0
 * License: 1.0.0
 * License URL: http://www.gnu.org/licenses/gpl-2.0.txt
 * text-domain: mosaic-product-layouts-for-elementor
 */
namespace Micemade\MosaicProductLayoutsElementor;

use Micemade\MosaicProductLayoutsElementor\Widgets\ProductsLayout;
use Micemade\MosaicProductLayoutsElementor\Widgets\Widget_2;

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
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ), 100 );
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

	public function init_controls() {

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
		
		// Check if current page uses Elementor
		$post_id = get_the_ID();
		if ( ! $post_id || ! \Elementor\Plugin::$instance->db->is_built_with_elementor( $post_id ) ) {
			return;
		}
		
		// Enqueue WordPress's React and ReactDOM
		wp_enqueue_script( 'react' );
		wp_enqueue_script( 'react-dom' );
		
		wp_enqueue_script(
			'mpl4e-js',
			plugin_dir_url( __FILE__ ) . 'assets/js/main.js',
			array( 'jquery', 'elementor-frontend', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'mpl4e-css',
			plugin_dir_url( __FILE__ ) . 'assets/css/style.css',
			array(),
			'1.0.0'
		);
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
