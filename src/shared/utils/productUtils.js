/**
 * WordPress and React Dependencies.
 */

import { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';

export const getFeaturedImage = (productId, featuredImageSize) => {

	const [loadingImg, setLoadingImg] = useState(true);
	const [featuredImage, setFeaturedImage] = useState(null);

	useEffect(() => {

		if (!productId || typeof productId === "undefined") return;

		// If "featuredImageSize" is not set (is 'automatic'), get image source url from registered sizes.
		async function fetchFeaturedImage() {
			try {
				setLoadingImg(true);
				const response = await apiFetch({
					path: `/wp/v2/product/${productId}?_embed`,
				});

				if (
					typeof featuredImageSize !== "automatic" &&
					typeof response._embedded['wp:featuredmedia'] !== 'undefined'
				) {
					const featuredImage = response._embedded['wp:featuredmedia'][0].media_details.sizes[featuredImageSize]?.source_url;
					setFeaturedImage(featuredImage);
				}
				setLoadingImg(false);
			} catch (error) {
				console.error("Error fetching featured image size source url via WP Rest API:", error);
			}

		};
		fetchFeaturedImage();

	}, [productId, featuredImageSize]);

	return { loadingImg, featuredImage };
};

export const getProduct = (productId) => {
	const [product, setProduct] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {

		if (!productId || typeof productId === "undefined") return;
		async function fetchProduct() {
			try {
				const product = await apiFetch({
					path: `/wc/store/v1/products/${productId}?_fields=id,name,short_description,price_html,images,permalink,add_to_cart,type`,
				});
				setProduct(product);
				setLoading(false);
			} catch (error) {
				console.error("getProduct - WC Store API error:", error);
			}
		}
		fetchProduct();

	}, [productId]);

	return { product, loading };
};
