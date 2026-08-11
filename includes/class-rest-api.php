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
	private const NAMESPACE = 'micemade_mc4e/v1';

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

		// Taxonomy terms endpoint.
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
}
