<?php
/**
 * Plugin Name: Mosaic Contents for Elementor
 * Plugin URI: https://wordpress.org/plugins/mosaic-contents-for-elementor/
 * Author: Micemade
 * Author URI: https://micemade.com
 * Description: A set of Elementor widgets for building general-purpose content layouts.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * License: GPLv2 or later
 * License URL: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: mosaic-contents-for-elementor
 * Requires Plugins: elementor
 * Elementor tested up to: 4.1.4
 * Elementor Pro tested up to: 4.2.0
 */

namespace Micemade\MosaicContentsElementor;

use Micemade\MosaicContentsElementor\Widgets\ContentLayout;
use Micemade\MosaicContentsElementor\Widgets\WidgetsLayout;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MICEMADE_MC4E_VERSION' ) ) {
	define( 'MICEMADE_MC4E_VERSION', '0.1.0' );
}

if ( ! defined( 'MICEMADE_MC4E_PLUGIN_FILE' ) ) {
	define( 'MICEMADE_MC4E_PLUGIN_FILE', __FILE__ );
}

if ( ! defined( 'MICEMADE_MC4E_PLUGIN_DIR' ) ) {
	define( 'MICEMADE_MC4E_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'MICEMADE_MC4E_PLUGIN_URL' ) ) {
	define( 'MICEMADE_MC4E_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
}

/**
 * Main plugin class for Mosaic Contents for Elementor.
 *
 * Bootstraps the plugin: registers Elementor widgets, controls and category,
 * enqueues editor/preview/frontend assets, wires up settings and the custom
 * REST API, and performs environment (PHP/Elementor) checks.
 *
 * @since 0.1.0
 */
final class MosaicContentsElementor {

	/**
	 * Minimum Elementor version required to run the plugin.
	 *
	 * @var string
	 */
	const ELEMENTOR_MINIMUM_VERSION = '3.0.0';

	/**
	 * Minimum PHP version required to run the plugin.
	 *
	 * @var string
	 */
	const PHP_MINIMUM_VERSION = '8.0';

	/**
	 * Singleton instance of the plugin.
	 *
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * Constructor.
	 *
	 * Registers all WordPress and Elementor hooks and initializes the REST API.
	 */
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

		// SECURITY: Add security headers
		add_action( 'wp_headers', array( $this, 'add_security_headers' ) );

		// Initialize custom REST API endpoints.
		$this->init_rest_api();
	}

	/**
	 * Initialize the plugin after all plugins are loaded.
	 *
	 * Verifies the PHP and Elementor version requirements, showing an admin
	 * notice and bailing out when a requirement is not met.
	 *
	 * @return void
	 */
	public function init_plugin() {
		// Check if Elementor is installed and activated
		if ( ! did_action( 'elementor/loaded' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_missing_elementor' ) );
			return;
		}

		if ( version_compare( PHP_VERSION, self::PHP_MINIMUM_VERSION, '<' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_minimum_php_version' ) );
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
	 * Add security headers to prevent XSS and clickjacking attacks.
	 *
	 * @param array $headers The headers array.
	 * @return array Modified headers array.
	 */
	public function add_security_headers( $headers ) {
		// Prevent browsers from MIME-sniffing the content type
		$headers['X-Content-Type-Options'] = 'nosniff';

		// Prevent clickjacking attacks
		$headers['X-Frame-Options'] = 'SAMEORIGIN';

		// Remove version information
		if ( isset( $headers['X-Powered-By'] ) ) {
			unset( $headers['X-Powered-By'] );
		}

		return $headers;
	}

	/**
	 * Register custom Elementor controls.
	 *
	 * @param \Elementor\Controls_Manager $controls_manager Elementor controls manager.
	 * @return void
	 */
	public function init_controls( $controls_manager ) {
		// Require the focal point control class.
		require_once __DIR__ . '/controls/focal-point.php';

		// Register the focal point control.
		$controls_manager->register( new \Micemade\MosaicContentsElementor\Controls\Focal_Point() );

		// Require and register the saved setups control.
		require_once __DIR__ . '/controls/saved-setups.php';
		$controls_manager->register( new \Micemade\MosaicContentsElementor\Controls\Saved_Setups() );

		// Require and register the element sorting control.
		require_once __DIR__ . '/controls/element-sorting.php';
		$controls_manager->register( new \Micemade\MosaicContentsElementor\Controls\Element_Sorting() );
	}

	/**
	 * Enqueue scripts and styles for the Elementor editor panel.
	 *
	 * @return void
	 */
	public function enqueue_editor_scripts() {
		// Enqueue React and ReactDOM for editor
		$this->maybe_enqueue_react();
	}

	/**
	 * Enqueue scripts and styles for the Elementor editor preview (iframe).
	 *
	 * Loads the full-featured editor script with drag/resize, add/remove items
	 * and settings sync, plus the REST runtime configuration.
	 *
	 * @return void
	 */
	public function enqueue_preview_scripts() {
		// Enqueue WordPress's React and ReactDOM
		$this->maybe_enqueue_react();
		wp_enqueue_media();

		// Editor script (full functionality)
		wp_enqueue_script(
			'micemade_mc4e-editor-js',
			plugin_dir_url( __FILE__ ) . 'assets/admin/js/main-editor.js',
			array( 'jquery', 'elementor-frontend', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'micemade_mc4e-editor-css',
			plugin_dir_url( __FILE__ ) . 'assets/admin/css/main-editor.css',
			array(),
			'1.0.0'
		);

		$this->enqueue_rest_config();
	}

	/**
	 * Check if React and ReactDOM are enqueued, and enqueue them if not.
	 *
	 * @return void
	 */
	private function maybe_enqueue_react() {
		if ( ! wp_script_is( 'react', 'enqueued' ) ) {
			wp_enqueue_script( 'react' );
		}
		if ( ! wp_script_is( 'react-dom', 'enqueued' ) ) {
			wp_enqueue_script( 'react-dom' );
		}
	}

	/**
	 * Register the plugin's Elementor widgets.
	 *
	 * @param \Elementor\Widgets_Manager $widgets_manager Elementor widgets manager.
	 * @return void
	 */
	public function init_widgets( $widgets_manager ) {

		// Require shared trait and widget classes.
		require_once __DIR__ . '/includes/trait-widget-helpers.php';

		// Require widget classes.
		require_once __DIR__ . '/widgets/content-layout/content-layout.php';
		require_once __DIR__ . '/widgets/widgets-layout/widgets-layout.php';

		// Register widgets with elementor.
		$widgets_manager->register( new ContentLayout() );
		$widgets_manager->register( new WidgetsLayout() );
	}

	/**
	 * Retrieve the singleton instance of the plugin.
	 *
	 * @return self The single plugin instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Register the "Mosaic Contents" widget category in Elementor.
	 *
	 * @param \Elementor\Elements_Manager $elements_manager Elementor elements manager.
	 * @return void
	 */
	public function create_new_category( $elements_manager ) {

		$elements_manager->add_category(
			'micemade-mosaic-contents-for-elementor',
			array(
				'title' => __( 'Mosaic Contents', 'mosaic-contents-for-elementor' ),
				'icon'  => 'fa fa-plug',
			)
		);
	}

	/**
	 * Enqueue the lightweight frontend script and styles.
	 *
	 * Only loads on non-preview pages that are actually built with Elementor,
	 * then attaches the REST runtime configuration.
	 *
	 * @return void
	 */
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
		if ( ! $post_id || ! \Elementor\Plugin::$instance->documents->get( $post_id )->is_built_with_elementor() ) {
			return;
		}

		// Enqueue WordPress's React and ReactDOM
		$this->maybe_enqueue_react();

		// Frontend-only script (lightweight, no editor features)
		wp_enqueue_script(
			'micemade_mc4e-frontend-js',
			plugin_dir_url( __FILE__ ) . 'assets/js/main-frontend.js',
			array( 'jquery', 'elementor-frontend', 'react', 'react-dom' ),
			'1.0.0',
			true
		);

		wp_enqueue_style(
			'micemade_mc4e-css',
			plugin_dir_url( __FILE__ ) . 'assets/css/main-frontend.css',
			array(),
			'1.0.0'
		);

		$this->enqueue_rest_config();
	}

	/**
	 * Localize runtime data required by widget scripts.
	 *
	 * @return void
	 */
	private function enqueue_rest_config() {
		$localize_data = array(
			'restRoot'       => esc_url_raw( rest_url() ),
			'restNonce'      => wp_create_nonce( 'wp_rest' ),
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'placeholderImg' => plugins_url( 'assets/images/woocommerce-placeholder-300x300.png', __FILE__ ),
			// SECURITY FIX: Include Store API nonce for reliable cart operations
			'storeApiNonce'  => wp_create_nonce( 'wc_store_api' ),
		);

		wp_localize_script( 'micemade_mc4e-frontend-js', 'MICEMADE_MC4E', $localize_data );
		wp_localize_script( 'micemade_mc4e-editor-js', 'MICEMADE_MC4E', $localize_data );
	}

	/**
	 * Register plugin settings for saved setups.
	 *
	 * Registers WP option 'mc4e_content_layout_setups' with show_in_rest
	 * so it can be read/written via wp.apiFetch({ path: '/wp/v2/settings' }).
	 *
	 * @return void
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

		register_setting( 'options', 'mc4e_content_layout_setups', $setting_args );
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

	/**
	 * Display an admin notice when Elementor is not installed or activated.
	 *
	 * @return void
	 */
	public function admin_notice_missing_elementor() {
		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor */
			__( '"%1$s" requires "%2$s" to be installed and activated.', 'mosaic-contents-for-elementor' ),
			'<strong>' . __( 'Mosaic Contents for Elementor', 'mosaic-contents-for-elementor' ) . '</strong>',
			'<strong>' . __( 'Elementor', 'mosaic-contents-for-elementor' ) . '</strong>'
		);

		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', wp_kses_post( $message ) );
	}

	/**
	 * Display an admin notice when the installed PHP version is too low.
	 *
	 * @return void
	 */
	public function admin_notice_minimum_php_version() {
		$message = sprintf(
			/* translators: 1: Plugin name 2: PHP 3: Required PHP version */
			__( '"%1$s" requires "%2$s" version %3$s or greater.', 'mosaic-contents-for-elementor' ),
			'<strong>' . __( 'Mosaic Contents for Elementor', 'mosaic-contents-for-elementor' ) . '</strong>',
			'<strong>' . __( 'PHP', 'mosaic-contents-for-elementor' ) . '</strong>',
			self::PHP_MINIMUM_VERSION
		);

		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', wp_kses_post( $message ) );
	}

	/**
	 * Display an admin notice when the installed Elementor version is too low.
	 *
	 * @return void
	 */
	public function admin_notice_minimum_elementor_version() {
		$message = sprintf(
			/* translators: 1: Plugin name 2: Elementor 3: Required Elementor version */
			__( '"%1$s" requires "%2$s" version %3$s or greater.', 'mosaic-contents-for-elementor' ),
			'<strong>' . __( 'Mosaic Contents for Elementor', 'mosaic-contents-for-elementor' ) . '</strong>',
			'<strong>' . __( 'Elementor', 'mosaic-contents-for-elementor' ) . '</strong>',
			self::ELEMENTOR_MINIMUM_VERSION
		);

		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', wp_kses_post( $message ) );
	}
}

// Boot the plugin.
MosaicContentsElementor::get_instance();
