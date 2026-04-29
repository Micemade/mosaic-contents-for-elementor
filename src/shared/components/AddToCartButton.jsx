/**
 * AddToCartButton Component
 *
 * Renders a WooCommerce-compatible add-to-cart button using React state
 * and the WC Store API for cart operations. This approach works independently
 * of WooCommerce's block infrastructure.
 *
 * Uses WC Store API: POST /wc/store/v1/cart/add-item
 *
 * @module AddToCartButton
 * @see https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/src/StoreApi/docs/cart.md
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './AddToCartButton.scss';

/**
 * Get the WC Store API nonce from the page
 * Priority: 1) Our localized script, 2) WC Blocks middleware, 3) wcSettings
 */
const getStoreApiNonce = () => {
	// Our plugin's localized nonce (primary source)
	if (window.MC4E?.storeApiNonce) {
		return window.MC4E.storeApiNonce;
	}
	// WooCommerce Blocks middleware config
	if (window.wcBlocksMiddlewareConfig?.storeApiNonce) {
		return window.wcBlocksMiddlewareConfig.storeApiNonce;
	}
	// wcSettings (alternative location)
	if (window.wcSettings?.admin?.storeApiNonce) {
		return window.wcSettings.admin.storeApiNonce;
	}
	if (window.wcSettings?.storeApiNonce) {
		return window.wcSettings.storeApiNonce;
	}
	return '';
};

/**
 * Add item to cart using WC Store API
 *
 * @param {number} productId - Product ID to add
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} Cart response or error
 */
const addToCart = async (productId, quantity = 1) => {
	const nonce = getStoreApiNonce();

	// Build headers - WC Store API uses 'Nonce' header (not 'X-WC-Store-API-Nonce')
	const headers = {
		'Content-Type': 'application/json',
	};

	// Add nonce if available
	if (nonce) {
		headers['Nonce'] = nonce;
	}

	const response = await fetch('/wp-json/wc/store/v1/cart/add-item', {
		method: 'POST',
		headers,
		credentials: 'same-origin',
		body: JSON.stringify({
			id: productId,
			quantity: quantity,
		}),
	});

	// Handle nonce refresh - WC Store API returns new nonce in response header
	const newNonce = response.headers.get('Nonce');
	if (newNonce && window.wcBlocksMiddlewareConfig) {
		window.wcBlocksMiddlewareConfig.storeApiNonce = newNonce;
	}

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || 'Failed to add item to cart');
	}

	return response.json();
};

/**
 * Trigger WooCommerce cart fragments update
 * This updates the mini-cart and other cart widgets
 */
const triggerCartUpdate = () => {
	// Trigger WooCommerce's added_to_cart event
	if (window.jQuery) {
		window.jQuery(document.body).trigger('added_to_cart');
	}

	// Dispatch custom event for other listeners
	document.body.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart'));
};

/**
 * AddToCartButton Component
 *
 * Renders an add-to-cart button with AJAX functionality using the WC Store API.
 * Handles loading states, success feedback, and cart synchronization.
 *
 * @param {Object} props - Component properties
 * @param {Object} props.product - Product data from WC Store API
 * @param {number} props.product.id - Product ID
 * @param {string} props.product.name - Product name
 * @param {string} props.product.type - Product type (simple, variable, etc.)
 * @param {string} props.product.sku - Product SKU
 * @param {Object} props.product.addToCart - Add to cart data from API
 * @param {string} props.className - Additional CSS classes
 */
const AddToCartButton = ({
	product,
	className = '',
}) => {
	const [status, setStatus] = useState('idle'); // idle, loading, added, error
	const [errorMessage, setErrorMessage] = useState('');
	const cartUrl = window.MC4E?.cartUrl || '/cart/';

	if (!product || !product.id) {
		return null;
	}

	const {
		id: productId,
		name: productName,
		type: productType = 'simple',
		sku: productSku = '',
		addToCart: addToCartData = {},
		isInStock = true,
		isPurchasable = true,
	} = product;

	// Get add to cart text and URL from product data
	const defaultAddToCartText = addToCartData?.text || 'Add to cart';
	const addToCartUrl = addToCartData?.url || `?add-to-cart=${productId}`;
	const addToCartDescription = addToCartData?.description || `Add "${productName}" to your cart`;

	// Determine button text based on status
	const getButtonText = () => {
		switch (status) {
			case 'loading':
				return 'Adding...';
			case 'added':
				return 'Added!';
			case 'error':
				return 'Error';
			default:
				return defaultAddToCartText;
		}
	};

	// Handle add to cart click
	const handleAddToCart = useCallback(async (e) => {
		e.preventDefault();

		// Don't process if already loading or just added
		if (status === 'loading') {
			return;
		}

		setStatus('loading');
		setErrorMessage('');

		try {
			await addToCart(productId, 1);
			setStatus('added');
			triggerCartUpdate();

			// Reset to idle after 2 seconds
			setTimeout(() => {
				setStatus('idle');
			}, 2000);
		} catch (error) {
			console.error('Add to cart error:', error);
			setStatus('error');
			setErrorMessage(error.message);

			// Reset to idle after 3 seconds
			setTimeout(() => {
				setStatus('idle');
				setErrorMessage('');
			}, 3000);
		}
	}, [productId, status]);

	// Check if product is purchasable (simple products can use AJAX)
	const isSimpleProduct = productType === 'simple' && isPurchasable && isInStock;

	// Button classes following WooCommerce's pattern
	const buttonClasses = [
		'wp-block-button__link',
		'wp-element-button',
		'wc-block-components-product-button__button',
		'add_to_cart_button',
		isSimpleProduct ? 'ajax_add_to_cart' : '',
		`product_type_${productType}`,
		status === 'loading' ? 'loading' : '',
		status === 'added' ? 'added' : '',
		className,
	].filter(Boolean).join(' ');

	// Wrapper classes
	const wrapperClasses = [
		'wp-block-button',
		'wc-block-components-product-button',
		'mosaic-add-to-cart-button',
		`mosaic-add-to-cart--${status}`,
	].filter(Boolean).join(' ');

	// For variable/grouped products, link to product page
	if (!isSimpleProduct) {
		return (
			<div className={wrapperClasses}>
				<a
					href={product.permalink || addToCartUrl}
					className={buttonClasses}
					aria-label={addToCartDescription}
					rel="nofollow"
				>
					<span>{defaultAddToCartText}</span>
				</a>
			</div>
		);
	}

	// For simple products, use AJAX add to cart
	return (
		<div className={wrapperClasses}>
			<button
				className={buttonClasses}
				type="button"
				disabled={status === 'loading'}
				data-product_id={productId}
				data-product_sku={productSku}
				aria-label={addToCartDescription}
				onClick={handleAddToCart}
			>
				<span className="mosaic-add-to-cart__text">
					{getButtonText()}
				</span>
				{status === 'loading' && (
					<span className="mosaic-add-to-cart__spinner" aria-hidden="true" />
				)}
			</button>

			{status === 'added' && (
				<a
					href={cartUrl}
					className="added_to_cart wc_forward"
					title="View cart"
				>
					View cart
				</a>
			)}

			{status === 'error' && errorMessage && (
				<span className="mosaic-add-to-cart__error" role="alert">
					{errorMessage}
				</span>
			)}
		</div>
	);
};

AddToCartButton.propTypes = {
	product: PropTypes.shape({
		id: PropTypes.number.isRequired,
		name: PropTypes.string,
		type: PropTypes.string,
		sku: PropTypes.string,
		permalink: PropTypes.string,
		addToCart: PropTypes.shape({
			text: PropTypes.string,
			url: PropTypes.string,
			description: PropTypes.string,
		}),
	}).isRequired,
	className: PropTypes.string,
};

export default AddToCartButton;
