<?php
/**
 * REST API endpoints for the Mosaic Contents for Elementor plugin.
 *
 * Provides lightweight endpoints for fetching products with search support
 * for scalable selection in the Elementor editor.
 *
 * @package Micemade\MosaicContentsElementor
 * @since 1.0.0
 */

namespace Micemade\MosaicContentsElementor;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * REST API class for Mosaic Contents for Elementor.
 *
 * Registers custom REST endpoints for products or post types that return lightweight data
 * optimized for the Elementor editor async select control.
 *
 * @since 1.0.0
 */
class RestAPI {

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	private const NAMESPACE = 'mc4e/v1';

	/**
	 * Default number of items to return.
	 *
	 * @var int
	 */
	private const DEFAULT_PER_PAGE = 50;

	/**
	 * Initialize the REST API routes.
	 *
	 * @return void
	 */
	public function init(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST API routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		// Products endpoint.
		register_rest_route(
			self::NAMESPACE,
			'/products',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_products' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => $this->get_collection_params(),
			)
		);
		// Post types endpoint.
		register_rest_route(
			self::NAMESPACE,
			'/post-types',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_types' ),
				'permission_callback' => '__return_true', // Public endpoint for post type metadata
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/post-meta',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_meta_values' ),
				// Public: these values are rendered to visitors on the frontend.
				// The callback only ever returns non-protected keys on published
				// posts, and `mc4e_allowed_post_meta_keys` can narrow that further.
				'permission_callback' => '__return_true',
				'args'                => array(
					'post_ids'  => array(
						'description'       => __( 'Comma-separated post IDs.', 'mosaic-contents-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'meta_keys' => array(
						'description'       => __( 'Comma-separated meta keys.', 'mosaic-contents-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		// Available (non-protected) meta keys for a post type.
		register_rest_route(
			self::NAMESPACE,
			'/post-meta-keys',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_meta_keys' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'post_type' => array(
						'description'       => __( 'Post type slug.', 'mosaic-contents-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_key',
					),
					'search'    => array(
						'description'       => __( 'Optional search term to filter meta keys.', 'mosaic-contents-for-elementor' ),
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/taxonomy-terms',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_taxonomy_terms' ),
				'permission_callback' => '__return_true', // Public endpoint for taxonomy terms
				'args'                => array(
					'taxonomy' => array(
						'description'       => __( 'Taxonomy slug.', 'mosaic-contents-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);
	}

	/**
	 * Check if the current user has permission to access the endpoint.
	 *
	 * Validates user capability and rate limits.
	 *
	 * @return bool|WP_Error True if user can access, false or WP_Error otherwise.
	 */
	public function check_permission() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return false;
		}

		// SECURITY: Rate limiting - max 100 requests per minute per user
		if ( ! $this->check_rate_limit() ) {
			return new WP_Error(
				'rest_rate_limit',
				__( 'Too many requests. Please try again later.', 'mosaic-contents-for-elementor' ),
				array( 'status' => 429 )
			);
		}

		return true;
	}

	/**
	 * Check rate limit for current user.
	 *
	 * Uses WordPress transients for rate limiting (fallback to in-memory if unavailable).
	 *
	 * @return bool True if within rate limit, false if exceeded.
	 */
	private function check_rate_limit(): bool {
		$user_id = get_current_user_id();

		if ( ! $user_id ) {
			return false;
		}

		$cache_key     = 'mc4e_api_rate_' . $user_id;
		$limit_per_min = 100;
		$request_count = (int) get_transient( $cache_key );

		if ( $request_count >= $limit_per_min ) {
			return false;
		}

		// Increment and set expiry to 1 minute
		set_transient( $cache_key, $request_count + 1, MINUTE_IN_SECONDS );

		return true;
	}

	/**
	 * Get collection parameters for endpoints.
	 *
	 * @return array Array of parameter definitions.
	 */
	private function get_collection_params(): array {
		return array(
			'search'   => array(
				'description'       => __( 'Search term to filter results.', 'mosaic-contents-for-elementor' ),
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => array( $this, 'validate_search_param' ),
			),
			'per_page' => array(
				'description'       => __( 'Maximum number of items to return.', 'mosaic-contents-for-elementor' ),
				'type'              => 'integer',
				'default'           => self::DEFAULT_PER_PAGE,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
		);
	}

	/**
	 * Validate search parameter for length and format.
	 *
	 * @param string $value The search parameter value.
	 * @return true|WP_Error True if valid, WP_Error otherwise.
	 */
	public function validate_search_param( $value ) {
		if ( empty( $value ) ) {
			return true; // Empty is valid (optional parameter)
		}

		$length = strlen( $value );

		if ( $length < 2 ) {
			return new WP_Error(
				'invalid_search_length',
				__( 'Search term must be at least 2 characters.', 'mosaic-contents-for-elementor' ),
				array( 'status' => 400 )
			);
		}

		if ( $length > 100 ) {
			return new WP_Error(
				'search_too_long',
				__( 'Search term must not exceed 100 characters.', 'mosaic-contents-for-elementor' ),
				array( 'status' => 400 )
			);
		}

		return true;
	}

	/**
	 * Get products for selection.
	 *
	 * Returns lightweight product data: value (id), label (title), and mediaId (featured image).
	 * Format matches react-select option format for direct consumption.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error on failure.
	 */
	public function get_products( WP_REST_Request $request ) {
		$search   = $request->get_param( 'search' );
		$per_page = $request->get_param( 'per_page' ) ?? self::DEFAULT_PER_PAGE;

		// Check if WooCommerce is active.
		if ( ! function_exists( 'wc_get_products' ) ) {
			return new WP_Error(
				'woocommerce_not_active',
				__( 'WooCommerce is not active.', 'mosaic-contents-for-elementor' ),
				array( 'status' => 400 )
			);
		}

		$args = array(
			'limit'   => $per_page,
			'status'  => 'publish',
			'orderby' => 'date',
			'order'   => 'DESC',
			'return'  => 'ids',
		);

		// Add search parameter if provided.
		if ( ! empty( $search ) ) {
			$args['s'] = $search;
		}

		$product_ids = wc_get_products( $args );

		$products = array_map(
			function ( int $id ): array {
				return array(
					'value'   => $id,
					'label'   => get_the_title( $id ),
					'mediaId' => (int) get_post_thumbnail_id( $id ),
				);
			},
			$product_ids
		);

		return rest_ensure_response( $products );
	}

	/**
	 * Get all public REST-enabled post types.
	 *
	 * @return WP_REST_Response
	 */
	public function get_post_types(): WP_REST_Response {
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

		return rest_ensure_response( $data );
	}

	/**
	 * Get terms for a taxonomy as select options.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_taxonomy_terms( WP_REST_Request $request ): WP_REST_Response {
		$taxonomy = (string) $request->get_param( 'taxonomy' );
		$options  = array();

		if ( empty( $taxonomy ) || ! taxonomy_exists( $taxonomy ) ) {
			return rest_ensure_response( $options );
		}

		$taxonomy_obj = get_taxonomy( $taxonomy );
		if ( ! $taxonomy_obj || empty( $taxonomy_obj->public ) || empty( $taxonomy_obj->show_in_rest ) ) {
			return rest_ensure_response( $options );
		}

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => false,
			)
		);

		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return rest_ensure_response( $options );
		}

		foreach ( $terms as $term ) {
			$key             = $taxonomy . ':' . $term->term_id;
			$options[ $key ] = sprintf( '%1$s: %2$s', $taxonomy, $term->name );
		}

		return rest_ensure_response( $options );
	}

	/**
	 * Get distinct non-protected meta keys used by a post type, as select options.
	 *
	 * SECURITY: Only non-protected meta keys (no leading "_" / internal keys) are
	 * returned; the result can be narrowed/extended via the `mc4e_post_meta_keys`
	 * filter. Requires `edit_posts` (see check_permission()).
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Array of { value, label } options.
	 */
	public function get_post_meta_keys( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$post_type = (string) $request->get_param( 'post_type' );
		$search    = (string) $request->get_param( 'search' );

		if ( empty( $post_type ) || ! post_type_exists( $post_type ) ) {
			return rest_ensure_response( array() );
		}

		// Distinct meta keys attached to published posts of this type.
		$keys = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT pm.meta_key
				 FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE p.post_type = %s AND p.post_status = 'publish'
				 ORDER BY pm.meta_key ASC",
				$post_type
			)
		);

		$keys = array_filter(
			(array) $keys,
			static function ( $key ) {
				return ! empty( $key ) && ! is_protected_meta( $key, 'post' );
			}
		);

		/**
		 * Filter the list of selectable meta keys for a post type.
		 *
		 * @param string[] $keys      Non-protected meta keys.
		 * @param string   $post_type Post type slug.
		 */
		$keys = apply_filters( 'mc4e_post_meta_keys', array_values( $keys ), $post_type );

		if ( '' !== $search ) {
			$needle = strtolower( $search );
			$keys   = array_values(
				array_filter(
					$keys,
					static function ( $key ) use ( $needle ) {
						return false !== strpos( strtolower( (string) $key ), $needle );
					}
				)
			);
		}

		$options = array_map(
			static function ( $key ) {
				return array(
					'value' => $key,
					'label' => $key,
				);
			},
			$keys
		);

		return rest_ensure_response( $options );
	}

	/**
	 * Get selected post meta values for a set of posts.
	 *
	 * SECURITY: Only non-protected meta keys are returned (guarded by `edit_posts`
	 * + rate limiting); the set can be further restricted/extended with the
	 * `mc4e_allowed_post_meta_keys` filter.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_post_meta_values( WP_REST_Request $request ): WP_REST_Response {
		$post_ids = array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'post_ids' ) ) ) );
		// Case-preserving sanitize (meta keys can contain uppercase).
		$meta_keys = array_filter(
			array_map(
				static function ( $key ) {
					return preg_replace( '/[^A-Za-z0-9_\-]/', '', trim( (string) $key ) );
				},
				explode( ',', (string) $request->get_param( 'meta_keys' ) )
			)
		);

		// Only expose non-protected meta keys (drop leading "_"/internal keys).
		$meta_keys = array_values(
			array_filter(
				$meta_keys,
				static function ( $key ) {
					return ! is_protected_meta( $key, 'post' );
				}
			)
		);

		/**
		 * Optional additional allowlist. Return a non-empty array to restrict the
		 * exposable keys to that set; return an empty array (default) to allow all
		 * non-protected keys.
		 *
		 * @filter mc4e_allowed_post_meta_keys
		 */
		$allowed_meta_keys = apply_filters( 'mc4e_allowed_post_meta_keys', array() );
		if ( ! empty( $allowed_meta_keys ) ) {
			$meta_keys = array_intersect( $meta_keys, $allowed_meta_keys );
		}

		if ( empty( $meta_keys ) ) {
			return rest_ensure_response( array() );
		}

		$payload = array();

		foreach ( $post_ids as $post_id ) {
			$payload[ $post_id ] = array();

			if ( 'publish' !== get_post_status( $post_id ) ) {
				continue;
			}

			foreach ( $meta_keys as $meta_key ) {
				$value                            = get_post_meta( $post_id, $meta_key, true );
				$payload[ $post_id ][ $meta_key ] = is_scalar( $value ) ? (string) $value : '';
			}
		}

		return rest_ensure_response( $payload );
	}
}
