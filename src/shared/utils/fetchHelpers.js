/**
 * Get the WordPress REST API root URL, guaranteed to end with a slash.
 *
 * Prefers the plugin-localized root (window.MICEMADE_MC4E.restRoot), then wp-api's
 * wpApiSettings.root, then a sensible default.
 *
 * @return {string} REST root URL ending with a slash.
 */
export const getRestRoot = () => {
	const localizedRoot = window?.MICEMADE_MC4E?.restRoot;
	const wpApiRoot = window?.wpApiSettings?.root;
	const root = localizedRoot || wpApiRoot || '/wp-json/';

	return root.endsWith('/') ? root : `${root}/`;
};

// WP core post types whose REST base differs from the slug. Extended at
// runtime from the /micemade_mc4e/v1/post-types endpoint (see resolvePostTypeRestBase).
const postTypeRestBaseCache = new Map([
	['post', 'posts'],
	['page', 'pages'],
	['attachment', 'media'],
]);

// WP core taxonomies whose REST base differs from the slug. Extended at runtime
// from the same endpoint (see resolveTaxonomyRestBase).
const taxonomyRestBaseCache = new Map([
	['category', 'categories'],
	['post_tag', 'tags'],
]);

let postTypesRequest = null;

/**
 * Fetch the post type metadata once and fill both REST base caches.
 *
 * Concurrent callers share a single in-flight request.
 *
 * @return {Promise<void>} Resolves once both caches have been populated.
 */
const primeRestBaseCaches = () => {
	if (!postTypesRequest) {
		postTypesRequest = fetch(`${getRestRoot()}micemade_mc4e/v1/post-types`)
			.then((response) => (response.ok ? response.json() : null))
			.then((postTypes) => {
				if (!Array.isArray(postTypes)) {
					return;
				}

				postTypes.forEach((typeObj) => {
					if (typeObj?.name && typeObj?.rest_base) {
						postTypeRestBaseCache.set(typeObj.name, typeObj.rest_base);
					}

					const taxonomyRestBases = typeObj?.taxonomy_rest_bases;
					if (taxonomyRestBases && typeof taxonomyRestBases === 'object') {
						Object.entries(taxonomyRestBases).forEach(([taxonomy, restBase]) => {
							if (taxonomy && restBase) {
								taxonomyRestBaseCache.set(taxonomy, restBase);
							}
						});
					}
				});
			})
			.catch((error) => {
				console.warn('Failed to resolve REST bases; falling back to slugs.', error);
				// Allow a later call to retry.
				postTypesRequest = null;
			});
	}

	return postTypesRequest;
};

/**
 * Resolve a post type's REST base (e.g. "post" -> "posts").
 *
 * Results are cached process-wide; unknown types are looked up once via the
 * plugin's /micemade_mc4e/v1/post-types endpoint. Falls back to the post type slug.
 *
 * @param {string} postType
 * @return {Promise<string>} The post type's REST base, or the slug as fallback.
 */
export const resolvePostTypeRestBase = async (postType) => {
	if (!postType) {
		return 'posts';
	}

	if (postTypeRestBaseCache.has(postType)) {
		return postTypeRestBaseCache.get(postType);
	}

	await primeRestBaseCaches();

	return postTypeRestBaseCache.get(postType) || postType;
};

/**
 * Resolve a taxonomy's REST base (e.g. "category" -> "categories").
 *
 * The wp/v2 posts controller registers its taxonomy filter query args under the
 * taxonomy REST base, not the slug, so filtering by "category" or "post_tag" is
 * silently ignored. Custom taxonomies usually share slug and REST base, which is
 * why they appear to work without this mapping.
 *
 * @param {string} taxonomy
 * @return {Promise<string>} The taxonomy's REST base, or the slug as fallback.
 */
export const resolveTaxonomyRestBase = async (taxonomy) => {
	if (!taxonomy) {
		return '';
	}

	if (taxonomyRestBaseCache.has(taxonomy)) {
		return taxonomyRestBaseCache.get(taxonomy);
	}

	await primeRestBaseCaches();

	return taxonomyRestBaseCache.get(taxonomy) || taxonomy;
};

/**
 * Get WordPress REST nonce exposed by plugin localization.
 *
 * @return {string}
 */
export const getRestNonce = () =>
	window.MICEMADE_MC4E?.restNonce || window.parent?.MICEMADE_MC4E?.restNonce || '';

/**
 * Build REST nonce headers object.
 *
 * @return {Object}
 */
export const getRestNonceHeaders = () => {
	const nonce = getRestNonce();
	return nonce ? { 'X-WP-Nonce': nonce } : {};
};

/**
 * Parse JSON response and throw a readable error for failed requests.
 *
 * @param {Response} response
 * @param {string}   fallbackMessage
 * @return {Promise<*>}
 */
export const parseJsonOrThrow = async (response, fallbackMessage) => {
	if (!response.ok) {
		const errorJson = await response.json().catch(() => ({}));
		const message = errorJson?.message || fallbackMessage;
		throw new Error(message);
	}

	return response.json();
};
