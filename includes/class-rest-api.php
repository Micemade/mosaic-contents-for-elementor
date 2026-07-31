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
use WP_Post;

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
	 * Object cache group for this plugin's REST lookups.
	 *
	 * @var string
	 */
	private const CACHE_GROUP = 'mc4e';

	/**
	 * How long cached meta key lookups stay fresh.
	 *
	 * @var int
	 */
	private const CACHE_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * Maximum posts a single /post-meta request may ask about.
	 *
	 * Comfortably above any realistic grid page size, low enough that the public
	 * endpoint cannot be used to dump meta for the whole site in one call.
	 *
	 * @var int
	 */
	private const MAX_META_POSTS = 100;

	/**
	 * Maximum meta keys a single /post-meta request may ask for.
	 *
	 * @var int
	 */
	private const MAX_META_KEYS = 20;

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

		// Post meta values endpoint.
		//
		// Public by design: the widget renders these values on published pages, so
		// visitors must be able to read them. Authorization happens per post inside
		// the callback (see get_post_meta_values()), which only ever returns
		// non-protected meta from posts the caller can already read.
		register_rest_route(
			self::NAMESPACE,
			'/post-meta',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_post_meta_values' ),
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
				'permission_callback' => function ( WP_REST_Request $request ) {
					$post_type = get_post_type_object( (string) $request->get_param( 'post_type' ) );

					// Only public, REST-enabled types are selectable in the editor.
					if ( ! $post_type || empty( $post_type->show_in_rest ) || ! is_post_type_viewable( $post_type ) ) {
						return false;
					}

					// Capability of the requested type, not a blanket `edit_posts`.
					return current_user_can( $post_type->cap->edit_posts );
				},
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
	 * filter. Requires the edit capability of the requested post type, which must
	 * itself be public and REST-enabled (enforced in the permission callback).
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Array of { value, label } options.
	 */
	public function get_post_meta_keys( WP_REST_Request $request ): WP_REST_Response {
		$post_type = (string) $request->get_param( 'post_type' );
		$search    = (string) $request->get_param( 'search' );

		if ( empty( $post_type ) || ! post_type_exists( $post_type ) ) {
			return rest_ensure_response( array() );
		}

		$keys = array_filter(
			$this->query_post_meta_keys( $post_type ),
			static function ( $key ) {
				return ! is_protected_meta( $key, 'post' );
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
	 * Distinct meta keys attached to published posts of a post type.
	 *
	 * Core exposes no API for enumerating meta keys, so a direct query is the
	 * only way to build this list; the result is cached per post type.
	 *
	 * @param string $post_type Post type slug (already validated by the caller).
	 * @return string[] Meta keys, including protected ones.
	 */
	private function query_post_meta_keys( string $post_type ): array {
		$cache_key = 'meta_keys_' . $post_type;
		$cached    = wp_cache_get( $cache_key, self::CACHE_GROUP );

		if ( false !== $cached ) {
			return (array) $cached;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- No core API enumerates meta keys; result is cached below.
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

		$keys = array_values( array_filter( (array) $keys ) );

		wp_cache_set( $cache_key, $keys, self::CACHE_GROUP, self::CACHE_TTL );

		return $keys;
	}

	/**
	 * Whether a post's meta may be disclosed to the current caller.
	 *
	 * Mirrors WP_REST_Posts_Controller::check_read_permission(): a published post
	 * of a publicly viewable type is readable by anyone, and anything else needs
	 * `read_post`. The two must be an OR — for published posts `read_post` maps to
	 * the `read` capability, which logged-out visitors never hold, so requiring it
	 * would hide meta from exactly the visitors the widget renders for.
	 * Password-protected posts stay hidden unless the caller can edit them.
	 *
	 * @param WP_Post $post Post object.
	 * @return bool True when the post's meta may be returned.
	 */
	private function is_post_meta_readable( WP_Post $post ): bool {
		if ( ! is_post_type_viewable( get_post_type_object( $post->post_type ) ) ) {
			return false;
		}

		if ( 'publish' !== $post->post_status && ! current_user_can( 'read_post', $post->ID ) ) {
			return false;
		}

		if ( '' !== $post->post_password && ! current_user_can( 'edit_post', $post->ID ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Get selected post meta values for a set of posts.
	 *
	 * SECURITY: This endpoint is public because the widget renders the values on
	 * published pages. Every post is authorized individually by
	 * is_post_meta_readable(), so drafts, private and password-protected posts
	 * never leak to visitors who may not read them. Only non-protected meta keys
	 * are returned, and the set can be further restricted/extended with the
	 * `mc4e_allowed_post_meta_keys` filter. Request size is capped so the endpoint
	 * cannot be used for bulk extraction.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_post_meta_values( WP_REST_Request $request ): WP_REST_Response {
		$post_ids = array_filter( array_map( 'absint', explode( ',', (string) $request->get_param( 'post_ids' ) ) ) );
		$post_ids = array_slice( array_unique( $post_ids ), 0, self::MAX_META_POSTS );
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

		$meta_keys = array_slice( array_unique( $meta_keys ), 0, self::MAX_META_KEYS );

		if ( empty( $meta_keys ) ) {
			return rest_ensure_response( array() );
		}

		$payload = array();

		foreach ( $post_ids as $post_id ) {
			$payload[ $post_id ] = array();

			$post = get_post( $post_id );

			if ( ! $post instanceof WP_Post || ! $this->is_post_meta_readable( $post ) ) {
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
