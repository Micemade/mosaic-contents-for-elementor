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
