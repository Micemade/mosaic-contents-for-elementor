import { getCacheEntry, setCacheEntry } from './LRUCache';

/**
 * Load data with cache and standard loading/fetching state handling.
 *
 * @param {Object} options
 * @param {Object} options.cache
 * @param {string} options.cacheKey
 * @param {Function} options.fetcher
 * @param {Function} options.onCacheHit
 * @param {Function} options.onSuccess
 * @param {Function} options.onError
 * @param {Function} options.setIsLoading
 * @param {Function} options.setIsFetching
 * @param {boolean} options.hasExistingData
 * @returns {Promise<void>}
 */
export const loadCachedData = async ({
	cache,
	cacheKey,
	fetcher,
	onCacheHit,
	onSuccess,
	onError,
	setIsLoading,
	setIsFetching,
	hasExistingData,
}) => {
	const cachedData = getCacheEntry(cache, cacheKey);
	if (typeof cachedData !== 'undefined') {
		onCacheHit(cachedData);
		setIsLoading(false);
		setIsFetching(false);
		return;
	}

	if (!hasExistingData) {
		setIsLoading(true);
	} else {
		setIsFetching(true);
	}

	try {
		const result = await fetcher();
		setCacheEntry(cache, cacheKey, result);
		onSuccess(result);
	} catch (error) {
		onError(error);
	} finally {
		setIsLoading(false);
		setIsFetching(false);
	}
};
