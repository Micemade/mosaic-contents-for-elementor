<?php
/**
 * REST API endpoints for the Mosaic Product Layouts for Elementor plugin.
 *
 * Provides lightweight endpoints for fetching products with search support
 * for scalable selection in the Elementor editor.
 *
 * @package Micemade\MosaicProductLayoutsElementor
 * @since 1.0.0
 */

namespace Micemade\MosaicProductLayoutsElementor;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * REST API class for Mosaic Product Layouts for Elementor.
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
	private const NAMESPACE = 'mpl4e/v1';

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

		// Product category image assignment endpoint.
		register_rest_route(
			self::NAMESPACE,
			'/categories/(?P<id>\d+)/image',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'set_category_image' ),
				'permission_callback' => array( $this, 'check_category_image_permission' ),
				'args'                => array(
					'id'           => array(
						'description'       => __( 'Product category term ID.', 'mosaic-product-layouts-for-elementor' ),
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'attachmentId' => array(
						'description'       => __( 'Attachment ID to assign (0 to remove).', 'mosaic-product-layouts-for-elementor' ),
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
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
	 * Check if the current user can update product category images.
	 *
	 * @return bool True if user can manage product categories.
	 */
	public function check_category_image_permission(): bool {
		$taxonomy = get_taxonomy( 'product_cat' );
		if ( ! $taxonomy ) {
			return false;
		}

		$manage_terms_cap = $taxonomy->cap->manage_terms ?? 'manage_categories';

		return current_user_can( $manage_terms_cap ) || current_user_can( 'manage_woocommerce' );
	}

	/**
	 * Get collection parameters for endpoints.
	 *
	 * @return array Array of parameter definitions.
	 */
	private function get_collection_params(): array {
		return array(
			'search'   => array(
				'description'       => __( 'Search term to filter results.', 'mosaic-product-layouts-for-elementor' ),
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'per_page' => array(
				'description'       => __( 'Maximum number of items to return.', 'mosaic-product-layouts-for-elementor' ),
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
				__( 'WooCommerce is not active.', 'mosaic-product-layouts-for-elementor' ),
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
	 * Set or remove product category image.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function set_category_image( WP_REST_Request $request ) {
		$category_id   = absint( $request->get_param( 'id' ) );
		$attachment_id = absint( $request->get_param( 'attachmentId' ) );

		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return new WP_Error(
				'product_cat_missing',
				__( 'Product category taxonomy is not available.', 'mosaic-product-layouts-for-elementor' ),
				array( 'status' => 400 )
			);
		}

		$term = get_term( $category_id, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error(
				'category_not_found',
				__( 'Product category not found.', 'mosaic-product-layouts-for-elementor' ),
				array( 'status' => 404 )
			);
		}

		if ( $attachment_id > 0 ) {
			$attachment = get_post( $attachment_id );
			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				return new WP_Error(
					'invalid_attachment',
					__( 'Attachment not found.', 'mosaic-product-layouts-for-elementor' ),
					array( 'status' => 400 )
				);
			}

			$mime_type = get_post_mime_type( $attachment_id );
			if ( ! $mime_type || 0 !== strpos( $mime_type, 'image/' ) ) {
				return new WP_Error(
					'invalid_attachment_type',
					__( 'Attachment must be an image.', 'mosaic-product-layouts-for-elementor' ),
					array( 'status' => 400 )
				);
			}

			update_term_meta( $category_id, 'thumbnail_id', $attachment_id );
		} else {
			delete_term_meta( $category_id, 'thumbnail_id' );
		}

		clean_term_cache( $category_id, 'product_cat' );

		$updated_attachment_id = absint( get_term_meta( $category_id, 'thumbnail_id', true ) );

		return rest_ensure_response(
			array(
				'id'    => $category_id,
				'name'  => $term->name,
				'image' => $this->get_attachment_image_payload( $updated_attachment_id ),
			)
		);
	}

	/**
	 * Build image payload from attachment ID.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return array|null
	 */
	private function get_attachment_image_payload( int $attachment_id ): ?array {
		if ( $attachment_id <= 0 ) {
			return null;
		}

		$src       = wp_get_attachment_image_url( $attachment_id, 'full' );
		$thumbnail = wp_get_attachment_image_url( $attachment_id, 'thumbnail' ) ?: $src;

		if ( ! $src ) {
			return null;
		}

		return array(
			'id'        => $attachment_id,
			'src'       => $src,
			'thumbnail' => $thumbnail,
			'alt'       => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ) ?: '',
		);
	}
}
