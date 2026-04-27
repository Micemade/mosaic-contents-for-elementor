/**
 * WordPress and React Dependencies.
 */

import { useState, useEffect } from 'react';

/**
 * Get the WordPress REST API base URL.
 * Uses wpApiSettings if available (set by wp-api script), otherwise falls back to /wp-json/.
 */
const getApiRoot = () => {
	if (typeof window.ML4E !== 'undefined' && window.ML4E.restRoot) {
		return window.ML4E.restRoot;
	}

	if (typeof window.wpApiSettings !== 'undefined' && window.wpApiSettings.root) {
		return window.wpApiSettings.root;
	}
	return '/wp-json/';
};

const postTypeRestBaseCache = new Map([
	['post', 'posts'],
	['page', 'pages'],
	['attachment', 'media'],
]);

const resolvePostTypeRestBase = async (postType) => {
	if (!postType) {
		return 'posts';
	}

	if (postTypeRestBaseCache.has(postType)) {
		return postTypeRestBaseCache.get(postType);
	}

	try {
		const apiRoot = getApiRoot();
		const response = await fetch(`${apiRoot}ml4e/v1/post-types`);
		if (response.ok) {
			const types = await response.json();
			if (Array.isArray(types)) {
				types.forEach((type) => {
					if (type?.name && type?.rest_base) {
						postTypeRestBaseCache.set(type.name, type.rest_base);
					}
				});
			}
		}
	} catch (error) {
		console.warn('Failed to resolve post type REST base for featured image lookup:', error);
	}

	return postTypeRestBaseCache.get(postType) || postType;
};

export const getFeaturedImage = (productId, featuredImageSize, postType = 'post') => {

	const [loadingFeaturedImg, setLoadingFeaturedImg] = useState(true);
	const [featuredImage, setFeaturedImage] = useState(null);

	useEffect(() => {

		if (!productId || typeof productId === "undefined") return;

		// If "featuredImageSize" is not set (is 'automatic'), get image source url from registered sizes.
		async function fetchFeaturedImage() {
			try {
				setLoadingFeaturedImg(true);
				const apiRoot = getApiRoot();
				const restBase = await resolvePostTypeRestBase(postType);
				const response = await fetch(`${apiRoot}wp/v2/${encodeURIComponent(restBase)}/${productId}?_embed`);

				if (!response.ok) {
					throw new Error(`WP REST API error: ${response.status}`);
				}

				const data = await response.json();

				if (
					featuredImageSize !== "automatic" &&
					typeof data._embedded?.['wp:featuredmedia'] !== 'undefined'
				) {
					const featuredImg = data._embedded['wp:featuredmedia'][0]?.media_details?.sizes?.[featuredImageSize]?.source_url;
					setFeaturedImage(featuredImg || null);
				}
				setLoadingFeaturedImg(false);
			} catch (error) {
				console.error("Error fetching featured image size source url via WP Rest API:", error);
				setLoadingFeaturedImg(false);
			}

		};
		fetchFeaturedImage();

	}, [productId, featuredImageSize, postType]);

	return { loadingFeaturedImg, featuredImage };
};
