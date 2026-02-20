<?php
/**
 * Shared helpers for Mosaic Elementor widgets.
 *
 * Provides settings loading, breakpoints, image sizes, range config,
 * sanitization, render(), and content_template() used identically
 * by ProductsLayout, CategoriesLayout, and SingleProductLayout.
 *
 * @package Micemade\MosaicProductLayoutsElementor
 */

namespace Micemade\MosaicProductLayoutsElementor;

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
	 * Get settings definitions from JSON file.
	 *
	 * @param string $widget_name Widget name (e.g. 'products-layout').
	 * @return array Settings definitions with defaults and types.
	 */
	protected static function get_settings_definitions( $widget_name ) {
		if ( ! isset( self::$settings_cache[ $widget_name ] ) ) {
			$json_file = plugin_dir_path( __DIR__ ) . "src/widgets/{$widget_name}/utils/{$widget_name}-settings.json";
			if ( file_exists( $json_file ) ) {
				$json_content = file_get_contents( $json_file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				self::$settings_cache[ $widget_name ] = json_decode( $json_content, true );
			} else {
				self::$settings_cache[ $widget_name ] = array();
			}
		}
		return self::$settings_cache[ $widget_name ];
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
			'automatic' => __( 'Automatic (from Store API)', 'mosaic-product-layouts-for-elementor' ),
		);

		$registered_sizes = wp_get_registered_image_subsizes();

		if ( ! empty( $registered_sizes ) ) {
			foreach ( $registered_sizes as $name => $size ) {
				$label      = ucwords( str_replace( array( '-', '_' ), ' ', $name ) );
				$dimensions = $size['width'] . 'x' . $size['height'];
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
	 * Render widget on frontend.
	 *
	 * Outputs a wrapper div with a hidden input containing JSON-encoded
	 * settings for React to hydrate.
	 */
	protected function render() {
		$query_settings = $this->get_widget_settings();
		$json_data      = wp_json_encode( $query_settings );
		$widget_id      = $this->get_id();
		$widget_name    = $this->get_name();
		?>
<div class="<?php echo esc_attr( $widget_name ); ?>-wrapper" data-widget-id="<?php echo esc_attr( $widget_id ); ?>">
	<input type="hidden" class="elementor-settings-data" value="<?php echo esc_attr( $json_data ); ?>" />
	<div class="<?php echo esc_attr( $widget_name ); ?>-react-root"></div>
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
					$default_json = is_array( $breakpoint_default ) ? wp_json_encode( $breakpoint_default ) : "'{$breakpoint_default}'";

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
				$default_escaped = addslashes( (string) $definition['default'] );
				$js_settings[]   = "\t{$key}: settings.{$key} || '{$default_escaped}'";
			}
		}

		$js_settings_code = implode( ",\n", $js_settings );
		?>
<# const widgetId=view.model.id; const data={
	<?php echo $js_settings_code; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> }; const
	jsonData=JSON.stringify(data); #>
	<div class="<?php echo esc_attr( $widget_name ); ?>-wrapper" data-widget-id="{{ widgetId }}">
		<input type="hidden" class="elementor-settings-data" value="{{ jsonData }}" />
		<div class="<?php echo esc_attr( $widget_name ); ?>-react-root"></div>
	</div>
	<?php
	}
}
