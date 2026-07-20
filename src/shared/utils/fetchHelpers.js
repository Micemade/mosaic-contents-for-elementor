/**
 * Get the WordPress REST API root URL, guaranteed to end with a slash.
 *
 * Prefers the plugin-localized root (window.MC4E.restRoot), then wp-api's
 * wpApiSettings.root, then a sensible default.
 *
 * @return {string} REST root URL ending with a slash.
 */
export const getRestRoot = () => {
	const localizedRoot = window?.MC4E?.restRoot;
	const wpApiRoot = window?.wpApiSettings?.root;
	const root = localizedRoot || wpApiRoot || '/wp-json/';

	return root.endsWith('/') ? root : `${root}/`;
};

// WP core post types whose REST base differs from the slug. Extended at
// runtime from the /mc4e/v1/post-types endpoint (see resolvePostTypeRestBase).
const postTypeRestBaseCache = new Map([
	['post', 'posts'],
	['page', 'pages'],
	['attachment', 'media'],
]);

/**
 * Resolve a post type's REST base (e.g. "post" -> "posts").
 *
 * Results are cached process-wide; unknown types are looked up once via the
 * plugin's /mc4e/v1/post-types endpoint. Falls back to the post type slug.
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

	try {
		const response = await fetch(`${getRestRoot()}mc4e/v1/post-types`);
		if (response.ok) {
			const postTypes = await response.json();
			if (Array.isArray(postTypes)) {
				postTypes.forEach((typeObj) => {
					if (typeObj?.name && typeObj?.rest_base) {
						postTypeRestBaseCache.set(typeObj.name, typeObj.rest_base);
					}
				});
			}
		}
	} catch (error) {
		console.warn('Failed to resolve post type REST base; falling back to post type slug.', error);
	}

	return postTypeRestBaseCache.get(postType) || postType;
};

/**
 * Get WordPress REST nonce exposed by plugin localization.
 *
 * @return {string}
 */
export const getRestNonce = () =>
	window.MC4E?.restNonce || window.parent?.MC4E?.restNonce || '';

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
