/**
 * LRU Cache
 *
 * Simple Least Recently Used cache using Map insertion order.
 * Used in Elementor editor to limit memory during long editing sessions.
 * On the frontend a plain object is used instead (no remounts).
 */

import { isElementorEditor } from '../../core/elementor-utils';

export class LRUCache {
	constructor(maxSize = 20) {
		this.maxSize = maxSize;
		this.cache = new Map();
	}

	get(key) {
		if (!this.cache.has(key)) return undefined;

		// Move to end (most recently used)
		const value = this.cache.get(key);
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key, value) {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}

		this.cache.set(key, value);

		// Evict oldest if over limit
		if (this.cache.size > this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}
	}

	has(key) {
		return this.cache.has(key);
	}
}

/**
 * Create a cache instance appropriate for the current context.
 *
 * - Editor: LRU cache (limits memory during long sessions)
 * - Frontend: plain object (lightweight, no eviction needed)
 *
 * @param {number} [maxSize=20] - Maximum entries for the LRU cache.
 * @returns {LRUCache|Object}
 */
export const createCache = (maxSize = 20) =>
	isElementorEditor() ? new LRUCache(maxSize) : {};

/**
 * Read a cached value from either LRUCache or plain object cache.
 *
 * @param {LRUCache|Object} cache
 * @param {string} key
 * @returns {*}
 */
export const getCacheEntry = (cache, key) =>
	cache instanceof LRUCache ? cache.get(key) : cache[key];

/**
 * Write a cached value to either LRUCache or plain object cache.
 *
 * @param {LRUCache|Object} cache
 * @param {string} key
 * @param {*} value
 * @returns {void}
 */
export const setCacheEntry = (cache, key, value) => {
	if (cache instanceof LRUCache) {
		cache.set(key, value);
		return;
	}

	cache[key] = value;
};
