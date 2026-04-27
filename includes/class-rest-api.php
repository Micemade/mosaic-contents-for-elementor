<?php
/**
 * REST API endpoints for the Mosaic Layouts for Elementor plugin.
 *
 * Provides lightweight endpoints for fetching products with search support
 * for scalable selection in the Elementor editor.
 *
 * @package Micemade\MosaicLayoutsElementor
 * @since 1.0.0
 */

namespace Micemade\MosaicLayoutsElementor;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * REST API class for Mosaic Layouts for Elementor.
 *
 * Registers custom REST endpoints for products that return lightweight data
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
	private const NAMESPACE = 'ml4e/v1';

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

		register_rest_route(
			self::NAMESPACE,
			'/post-types',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_types' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/post-meta',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_meta_values' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'post_ids' => array(
						'description'       => __( 'Comma-separated post IDs.', 'mosaic-layouts-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'meta_keys' => array(
						'description'       => __( 'Comma-separated meta keys.', 'mosaic-layouts-for-elementor' ),
						'type'              => 'string',
						'required'          => true,
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
				'permission_callback' => '__return_true',
				'args'                => array(
					'taxonomy' => array(
						'description'       => __( 'Taxonomy slug.', 'mosaic-layouts-for-elementor' ),
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
	 * @return bool True if user can edit posts, false otherwise.
	 */
	public function check_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Get collection parameters for endpoints.
	 *
	 * @return array Array of parameter definitions.
	 */
	private function get_collection_params(): array {
		return array(
			'search'   => array(
				'description'       => __( 'Search term to filter results.', 'mosaic-layouts-for-elementor' ),
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'per_page' => array(
				'description'       => __( 'Maximum number of items to return.', 'mosaic-layouts-for-elementor' ),
				'type'              => 'integer',
				'default'           => self::DEFAULT_PER_PAGE,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
		);
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
				__( 'WooCommerce is not active.', 'mosaic-layouts-for-elementor' ),
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
					'mediaId' => get_post_thumbnail_id( $id ) ?: 0,
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
				'public'       => true,
				'publicly_queryable' => true,
				'show_in_rest' => true,
			),
			'objects'
		);

		$data = array();

		foreach ( $post_types as $post_type ) {
			$post_type_taxonomies = get_object_taxonomies( $post_type->name, 'objects' );
			$taxonomies           = array();
			$taxonomy_labels      = array();
			$taxonomy_rest_bases  = array();

			foreach ( $post_type_taxonomies as $taxonomy ) {
				if ( empty( $taxonomy->public ) || empty( $taxonomy->show_in_rest ) ) {
					continue;
				}

				$taxonomies[]                            = $taxonomy->name;
				$taxonomy_labels[ $taxonomy->name ] = $taxonomy->label;
				$taxonomy_rest_bases[ $taxonomy->name ] = ! empty( $taxonomy->rest_base ) ? $taxonomy->rest_base : $taxonomy->name;
			}

			$data[] = array(
				'name'       => $post_type->name,
				'label'      => $post_type->label,
				'rest_base'  => $post_type->rest_base ?: $post_type->name,
				'taxonomies' => array_values( $taxonomies ),
				'taxonomy_labels' => $taxonomy_labels,
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
	 * Get selected post meta values for a set of posts.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_post_meta_values( WP_REST_Request $request ): WP_REST_Response {
		$post_ids  = array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'post_ids' ) ) ) );
		$meta_keys = array_filter( array_map( 'sanitize_key', explode( ',', (string) $request->get_param( 'meta_keys' ) ) ) );

		$payload = array();

		foreach ( $post_ids as $post_id ) {
			$payload[ $post_id ] = array();

			if ( 'publish' !== get_post_status( $post_id ) ) {
				continue;
			}

			foreach ( $meta_keys as $meta_key ) {
				$value = get_post_meta( $post_id, $meta_key, true );
				$payload[ $post_id ][ $meta_key ] = is_scalar( $value ) ? (string) $value : '';
			}
		}

		return rest_ensure_response( $payload );
	}
}
