/**
 * WordPress and React Dependencies.
 */

import { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';

const getProduct = (productId) => {
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

export default getProduct;
