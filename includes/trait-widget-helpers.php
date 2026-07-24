<?php
/**
 * Shared helpers for Mosaic Elementor widgets.
 *
 * Provides settings loading, breakpoints, image sizes, range config,
 * sanitization, render(), and content_template() used identically
 * by different widgets. Each widget class uses this trait to avoid code duplication.
 *
 * @package Micemade\MosaicContentsElementor
 */

namespace Micemade\MosaicContentsElementor;

use Elementor\Controls_Manager;

/**
 * Trait WidgetHelpers
 *
 * Reusable methods shared across all Mosaic Elementor widgets.
 * Each class using this trait MUST implement Elementor\Widget_Base::get_name().
 */
trait WidgetHelpers {

	/**
	 * Cached settings definitions from JSON, keyed by widget name.
	 *
	 * @var array
	 */
	private static $settings_cache = array();

	/**
	 * Cached style preset options keyed by widget name.
	 *
	 * @var array
	 */
	private static $style_preset_options_cache = array();

	/**
	 * Get range configuration for slider controls.
	 *
	 * @return array
	 */
	protected static function get_range() {
		return array(
			'px'  => array(
				'min'  => 0,
				'max'  => 100,
				'step' => 1,
			),
			'em'  => array(
				'min'  => 0,
				'max'  => 10,
				'step' => 0.1,
			),
			'rem' => array(
				'min'  => 0,
				'max'  => 10,
				'step' => 0.1,
			),
			'vw'  => array(
				'min'  => 0,
				'max'  => 10,
				'step' => 0.1,
			),
			'vh'  => array(
				'min'  => 0,
				'max'  => 10,
				'step' => 0.1,
			),
			'%'   => array(
				'min'  => 0,
				'max'  => 100,
				'step' => 1,
			),
		);
	}

	/**
	 * Get active Elementor breakpoints.
	 *
	 * @return array Array of breakpoint names (e.g., ['desktop', 'tablet', 'mobile']).
	 */
	protected static function get_active_breakpoints() {
		if ( class_exists( '\Elementor\Plugin' ) ) {
			$breakpoints_manager = \Elementor\Plugin::$instance->breakpoints;
			if ( $breakpoints_manager ) {
				$active_breakpoints = $breakpoints_manager->get_active_breakpoints();
				$breakpoint_keys    = array_keys( $active_breakpoints );
				$breakpoint_keys    = array_reverse( $breakpoint_keys );
				array_unshift( $breakpoint_keys, 'desktop' );
				return $breakpoint_keys;
			}
		}
		return array( 'desktop', 'tablet', 'mobile' );
	}

	/**
	 * Register element ordering repeater controls.
	 *
	 * Creates a repeater-based control for sorting widget elements (title, price, etc.)
	 * with per-breakpoint visibility switchers. Elements can be reordered via drag-and-drop,
	 * but cannot be added, removed, or duplicated.
	 *
	 * @param string $control_key   Setting key for the repeater (e.g. 'mc4e_element_ordering').
	 * @param string $section_label Section label in the panel.
	 * @param array  $elements      Default element list, each with 'element_label' key.
	 */
	protected function register_element_ordering_controls( $control_key, $section_label, $elements ) {
		$this->start_controls_section(
			$control_key . '_section',
			array(
				'label' => $section_label,
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$repeater    = new \Elementor\Repeater();
		$breakpoints = self::get_active_breakpoints();

		// The read-only label control (element name).
		// render_type 'none' prevents Elementor from triggering a full
		// widget re-render — React handles UI updates via JS listeners.
		$repeater->add_control(
			'element_label',
			array(
				'type'        => 'mc4e_sorter_label',
				'render_type' => 'none',
			)
		);

		// Per-breakpoint visibility switchers.
		foreach ( $breakpoints as $bp ) {
			$bp_label = ucfirst( $bp );
			$repeater->add_control(
				'visible_' . $bp,
				array(
					'label'        => sprintf(
						/* translators: %s: breakpoint name (Desktop, Tablet, Mobile) */
						__( '%s visibility', 'mosaic-contents-for-elementor' ),
						$bp_label
					),
					'type'         => Controls_Manager::SWITCHER,
					'label_on'     => __( 'Show', 'mosaic-contents-for-elementor' ),
					'label_off'    => __( 'Hide', 'mosaic-contents-for-elementor' ),
					'return_value' => 'yes',
					'default'      => 'yes',
					'render_type'  => 'none',
				)
			);
		}

		$this->add_control(
			$control_key,
			array(
				'label'        => __( 'Element Order', 'mosaic-contents-for-elementor' ),
				'type'         => Controls_Manager::REPEATER,
				'fields'       => $repeater->get_controls(),
				'render_type'  => 'none',
				'item_actions' => array(
					'duplicate' => false,
					'add'       => false,
					'remove'    => false,
				),
				'default'      => $elements,
				'title_field'  => '{{{ element_label }}}',
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Get settings definitions from JSON file.
	 *
	 * @param string $widget_name Widget name (e.g. 'content-layout').
	 * @return array Settings definitions with defaults and types.
	 */
	protected static function get_settings_definitions( $widget_name ) {
		if ( ! isset( self::$settings_cache[ $widget_name ] ) ) {
			$json_file = plugin_dir_path( __DIR__ ) . "widgets/{$widget_name}/react-settings.json";
			if ( file_exists( $json_file ) ) {
				$json_content                         = file_get_contents( $json_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				self::$settings_cache[ $widget_name ] = json_decode( $json_content, true );
			} else {
				self::$settings_cache[ $widget_name ] = array();
			}
		}
		return self::$settings_cache[ $widget_name ];
	}

	/**
	 * Get visual style preset options for a widget.
	 *
	 * @param string $widget_name Widget slug matching src/widgets/{widget_name}.
	 * @return array
	 */
	protected function get_style_preset_options( $widget_name ) {
		if ( isset( self::$style_preset_options_cache[ $widget_name ] ) ) {
			return self::$style_preset_options_cache[ $widget_name ];
		}

		$presets_file = plugin_dir_path( __DIR__ ) . "assets/presets/{$widget_name}/style-presets.json";

		if ( ! is_readable( $presets_file ) ) {
			self::$style_preset_options_cache[ $widget_name ] = array();
			return self::$style_preset_options_cache[ $widget_name ];
		}

		if ( function_exists( 'wp_json_file_decode' ) ) {
			$decoded_presets = wp_json_file_decode( $presets_file, array( 'associative' => true ) );
		} else {
			$raw_presets = file_get_contents( $presets_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			if ( false === $raw_presets ) {
				self::$style_preset_options_cache[ $widget_name ] = array();
				return self::$style_preset_options_cache[ $widget_name ];
			}

			$decoded_presets = json_decode( $raw_presets, true );
		}

		if ( ! is_array( $decoded_presets ) ) {
			self::$style_preset_options_cache[ $widget_name ] = array();
			return self::$style_preset_options_cache[ $widget_name ];
		}

		$image_base_url = plugins_url( 'assets/admin/images/style-presets/', defined( 'MICEMADE_MC4E_PLUGIN_FILE' ) ? MICEMADE_MC4E_PLUGIN_FILE : dirname( __DIR__ ) . '/mosaic-contents-for-elementor.php' );
		$options        = array();

		foreach ( $decoded_presets as $preset ) {
			if ( empty( $preset['id'] ) || empty( $preset['label'] ) ) {
				continue;
			}

			$preset_id = (string) $preset['id'];
			if ( 1 !== preg_match( '/^[a-z0-9-]+$/', $preset_id ) ) {
				continue;
			}

			$options[ $preset_id ] = array(
				'title' => sanitize_text_field( $preset['label'] ),
				'image' => esc_url( $image_base_url . $preset_id . '.svg' ),
			);
		}

		self::$style_preset_options_cache[ $widget_name ] = $options;

		return self::$style_preset_options_cache[ $widget_name ];
	}

	/**
	 * Read layout presets from JSON and return as id => label options.
	 *
	 * @return array Associative array of layout_id => label.
	 */
	protected function get_layout_options() {
		$json_path = MICEMADE_MC4E_PLUGIN_DIR . 'assets/presets/layouts.json';
		$layouts   = wp_json_file_decode( $json_path, array( 'associative' => true ) );

		if ( empty( $layouts ) || ! is_array( $layouts ) ) {
			return array( 'default' => __( 'Default', 'mosaic-contents-for-elementor' ) );
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
	 * Get all settings with defaults applied.
	 *
	 * Reads settings definitions for the current widget and resolves every
	 * value from Elementor settings, handling boolean, number, responsive,
	 * and string types.
	 *
	 * @return array Settings array ready for JSON encoding.
	 */
	protected function get_widget_settings() {
		$definitions = self::get_settings_definitions( $this->get_name() );
		$result      = array();

		foreach ( $definitions as $key => $definition ) {
			$default = $definition['default'];
			$type    = $definition['type'];

			$raw_value = $this->sanitize_setting( $key, $default );

			if ( $type === 'boolean' ) {
				$result[ $key ] = 'yes' === $raw_value;
			} elseif ( $type === 'number' ) {
				$result[ $key ] = $raw_value;
			} elseif ( $type === 'responsive' ) {
				$breakpoints      = self::get_active_breakpoints();
				$responsive_value = array();

				foreach ( $breakpoints as $index => $breakpoint ) {
					$breakpoint_default_key = $breakpoint . '_default';
					$breakpoint_default     = isset( $definition[ $breakpoint_default_key ] )
						? $definition[ $breakpoint_default_key ]
						: $definition['default'];

					if ( $index === 0 ) {
						$value                           = $this->sanitize_setting( $key, $breakpoint_default );
						$responsive_value[ $breakpoint ] = $value;
					} else {
						$value                           = $this->sanitize_setting( $key . '_' . $breakpoint, $breakpoint_default );
						$responsive_value[ $breakpoint ] = $value;
					}
				}

				$result[ $key ] = $responsive_value;
			} else {
				$result[ $key ] = $raw_value;
			}
		}

		return $result;
	}

	/**
	 * Get registered image sizes for select control.
	 *
	 * @return array Associative array of size_name => label.
	 */
	protected function get_image_sizes() {
		$sizes = array(
			'automatic' => __( 'Automatic', 'mosaic-contents-for-elementor' ),
		);

		$registered_sizes = wp_get_registered_image_subsizes();

		if ( ! empty( $registered_sizes ) ) {
			foreach ( $registered_sizes as $name => $size ) {
				$label          = ucwords( str_replace( array( '-', '_' ), ' ', $name ) );
				$dimensions     = $size['width'] . 'x' . $size['height'];
				$sizes[ $name ] = sprintf( '%s (%s)', $label, $dimensions );
			}
		}

		return $sizes;
	}

	/**
	 * Sanitize a setting value with fallback to default.
	 *
	 * @param string $setting Setting key.
	 * @param mixed  $default Default value.
	 * @return mixed
	 */
	protected function sanitize_setting( $setting, $default ) {
		$settings = $this->get_settings_for_display();
		if ( isset( $settings[ $setting ] ) ) {
			return $settings[ $setting ];
		}
		return $default;
	}

	/**
	 * Get default element visibility settings.
	 *
	 * @param string $element_label Label for the element (e.g. 'Title').
	 * @param array  $devices       Array of booleans for [desktop, widescreen, tablet, mobile_extra, mobile].
	 * @return array Associative array of visibility settings for all breakpoints.
	 */
	protected function default_elements_visibility( $element_label, $devices = array() ) {

		return array(
			'element_label'        => $element_label,
			'visible_desktop'      => $devices[0] ? 'yes' : 'no',
			'visible_widescreen'   => $devices[1] ? 'yes' : 'no',
			'visible_tablet'       => $devices[2] ? 'yes' : 'no',
			'visible_mobile_extra' => $devices[3] ? 'yes' : 'no',
			'visible_mobile'       => $devices[4] ? 'yes' : 'no',
		);
	}

	/**
	 * Render widget on frontend.
	 *
	 * Outputs a wrapper div with a hidden input containing JSON-encoded
	 * settings for React to hydrate.
	 */
	protected function render() {
		$widget_settings = $this->get_widget_settings();
		$json_data       = wp_json_encode( $widget_settings );
		$widget_id       = $this->get_id();
		$widget_name     = $this->get_name();
		?>
<div id="mc4e-<?php echo esc_attr( $widget_id ); ?>" class="<?php echo esc_attr( $widget_name ); ?>-wrapper"
	data-widget-id="<?php echo esc_attr( $widget_id ); ?>">
	<input type="hidden" class="elementor-settings-data" value="<?php echo esc_attr( $json_data ); ?>" />
	<div class="<?php echo esc_attr( $widget_name ); ?>-react-root mc4e-react-root"></div>
</div>
		<?php
	}

	/**
	 * Editor template — dynamic wrapper for React with widget ID and settings.
	 *
	 * Generates a Backbone/Underscore template that builds a JS settings
	 * object from Elementor model data, JSON-stringifies it, and passes it
	 * to the React root via a hidden input.
	 */
	protected function content_template() {
		$widget_name = $this->get_name();
		$definitions = self::get_settings_definitions( $widget_name );
		$js_settings = array();

		foreach ( $definitions as $key => $definition ) {
			$default = $definition['default'];
			$type    = $definition['type'];

			if ( $type === 'boolean' ) {
				$js_settings[] = "\t{$key}: settings.{$key} === 'yes'";
			} elseif ( $type === 'number' ) {
				if ( is_array( $default ) ) {
					$default_json  = wp_json_encode( $default );
					$js_settings[] = "\t{$key}: settings.{$key} || {$default_json}";
				} else {
					$js_settings[] = "\t{$key}: settings.{$key} || {$default}";
				}
			} elseif ( $type === 'object' ) {
				$default_json  = wp_json_encode( $default );
				$js_settings[] = "\t{$key}: settings.{$key} || {$default_json}";
			} elseif ( $type === 'responsive' ) {
				$breakpoints       = self::get_active_breakpoints();
				$responsive_values = array();
				foreach ( $breakpoints as $index => $breakpoint ) {
					$breakpoint_default_key = $breakpoint . '_default';
					$breakpoint_default     = isset( $definition[ $breakpoint_default_key ] )
						? $definition[ $breakpoint_default_key ]
						: $definition['default'];
					$default_json           = is_array( $breakpoint_default ) ? wp_json_encode( $breakpoint_default ) : "'{$breakpoint_default}'";

					if ( $index === 0 ) {
						$responsive_values[] = "{$breakpoint}: settings.{$key} || {$default_json}";
					} else {
						$responsive_values[] = "{$breakpoint}: settings.{$key}_{$breakpoint} || {$default_json}";
					}
				}
				$js_settings[] = "\t{$key}: { " . implode( ', ', $responsive_values ) . ' }';
			} elseif ( $type === 'array' ) {
				$default_json  = wp_json_encode( $default );
				$js_settings[] = "\t{$key}: settings.{$key} || {$default_json}";
			} else {
				// SECURITY FIX: Use wp_json_encode for proper JavaScript escaping instead of addslashes
				$default_json  = wp_json_encode( (string) $definition['default'] );
				$js_settings[] = "\t{$key}: settings.{$key} || {$default_json}";
			}
		}

		$js_settings_code = implode( ",\n", $js_settings );
		?>
<# const widgetId=view.model.id; const data={
		<?php echo $js_settings_code; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> }; const
	jsonData=JSON.stringify(data); #>
	<div id="mc4e-{{ widgetId }}" class="<?php echo esc_attr( $widget_name ); ?>-wrapper"
		data-widget-id="{{ widgetId }}">
		<input type="hidden" class="elementor-settings-data" value="{{ jsonData }}" />
		<div class="<?php echo esc_attr( $widget_name ); ?>-react-root mc4e-react-root"></div>
	</div>
		<?php
	}
}
