/**
 * Convert object keys from snake_case to camelCase.
 *
 * @param {Object} input
 * @return {Object}
 */
export const mapKeysToCamelCase = (input = {}) => {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return {};
	}

	return Object.keys(input).reduce((acc, key) => {
		const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
		acc[camelCaseKey] = input[key];
		return acc;
	}, {});
};
