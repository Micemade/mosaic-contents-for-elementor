/**
 * WordPress and React Dependencies.
 */

import { useState, useEffect } from 'react';

/**
 * Get the WordPress REST API base URL.
 * Uses wpApiSettings if available (set by wp-api script), otherwise falls back to /wp-json/.
 */
const getApiRoot = () => {
	if (typeof window.wpApiSettings !== 'undefined' && window.wpApiSettings.root) {
		return window.wpApiSettings.root;
	}
	return '/wp-json/';
};

export const getFeaturedImage = (productId, featuredImageSize) => {

	const [loadingFeaturedImg, setLoadingFeaturedImg] = useState(true);
	const [featuredImage, setFeaturedImage] = useState(null);

	useEffect(() => {

		if (!productId || typeof productId === "undefined") return;

		// If "featuredImageSize" is not set (is 'automatic'), get image source url from registered sizes.
		async function fetchFeaturedImage() {
			try {
				setLoadingFeaturedImg(true);
				const apiRoot = getApiRoot();
				const response = await fetch(`${apiRoot}wp/v2/product/${productId}?_embed`);

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

	}, [productId, featuredImageSize]);

	return { loadingFeaturedImg, featuredImage };
};
