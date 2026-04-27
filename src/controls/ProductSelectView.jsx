/**
 * Product Select Control - React Component
 *
 * Async select component for searching and selecting WooCommerce products.
 * Uses React Select's AsyncSelect with a custom REST endpoint.
 *
 * - Initial load: 50 most recent products
 * - Async search: Fires after 2+ characters with 300ms debounce
 *
 * @package Micemade\MosaicProductLayoutsElementor\Controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncSelect from 'react-select/async';

// ── WP globals available in editor panel context ──────────────────────────
const apiFetch = wp.apiFetch;
const { __ } = wp.i18n;

/**
 * REST API endpoint for products.
 *
 * @type {string}
 */
const PRODUCTS_ENDPOINT = '/ml4e/v1/products';

/**
 * Default number of products to load initially.
 *
 * @type {number}
 */
const PER_PAGE = 50;

/**
 * Debounce delay in milliseconds.
 *
 * @type {number}
 */
const DEBOUNCE_DELAY = 300;

/**
 * Minimum characters required before search triggers.
 *
 * @type {number}
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * ProductSelectView component.
 *
 * Renders an async React Select for choosing a WooCommerce product.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.initialValue   Initial product ID (from Elementor control value).
 * @param {Function} props.onChange        Callback when selection changes. Receives product ID string.
 * @returns {React.Element} The rendered component.
 */
const ProductSelectView = ({ initialValue, onChange }) => {

	const [defaultOptions, setDefaultOptions] = useState([]);
	const [selectedOption, setSelectedOption] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const debounceTimerRef = useRef(null);

	/**
	 * Fetch the initial set of products on mount.
	 */
	useEffect(() => {
		const fetchInitialProducts = async () => {
			try {
				setIsLoading(true);
				const response = await apiFetch({
					path: `${PRODUCTS_ENDPOINT}?per_page=${PER_PAGE}`,
				});
				setDefaultOptions(response);

				// If we have an initial value, find it in the response or fetch it specifically.
				if (initialValue) {
					const productId = parseInt(initialValue, 10);
					const found = response.find((opt) => opt.value === productId);
					if (found) {
						setSelectedOption(found);
					} else if (productId > 0) {
						// Product not in first 50 — fetch it by search.
						try {
							const searchResponse = await apiFetch({
								path: `${PRODUCTS_ENDPOINT}?search=${productId}&per_page=1`,
							});
							// Also try fetching by searching for the post title via wp/v2.
							// Fallback: create a minimal option with just the ID as label.
							const titleResponse = await apiFetch({
								path: `/wp/v2/product/${productId}?_fields=id,title`,
							});
							if (titleResponse && titleResponse.title) {
								setSelectedOption({
									value: productId,
									label:
										titleResponse.title.rendered ||
										titleResponse.title,
									mediaId: 0,
								});
							} else if (searchResponse.length > 0) {
								const match = searchResponse.find(
									(opt) => opt.value === productId
								);
								if (match) {
									setSelectedOption(match);
								}
							}
						} catch {
							// If individual product fetch fails, set a basic option.
							setSelectedOption({
								value: productId,
								label: `Product #${productId}`,
								mediaId: 0,
							});
						}
					}
				}
			} catch (error) {
				console.error('ML4E: Failed to fetch initial products:', error);
				setDefaultOptions([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchInitialProducts();

		// Cleanup debounce timer on unmount.
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	/**
	 * Load options based on search input with debouncing.
	 * Used by react-select's async mode.
	 *
	 * @param {string} inputValue Search input value.
	 * @returns {Promise<Array>} Promise resolving to array of options.
	 */
	const loadOptions = useCallback(
		(inputValue) => {
			return new Promise((resolve) => {
				// Clear existing timer.
				if (debounceTimerRef.current) {
					clearTimeout(debounceTimerRef.current);
				}

				// Return default options if input is too short.
				if (!inputValue || inputValue.length < MIN_SEARCH_LENGTH) {
					resolve(defaultOptions);
					return;
				}

				// Debounce the search.
				debounceTimerRef.current = setTimeout(async () => {
					try {
						const response = await apiFetch({
							path: `${PRODUCTS_ENDPOINT}?search=${encodeURIComponent(inputValue)}&per_page=${PER_PAGE}`,
						});
						resolve(response);
					} catch (error) {
						console.error('ML4E: Product search failed:', error);
						resolve([]);
					}
				}, DEBOUNCE_DELAY);
			});
		},
		[defaultOptions]
	);

	/**
	 * Handle selection change.
	 *
	 * @param {Object|null} option Selected option object or null.
	 */
	const handleChange = useCallback(
		(option) => {
			setSelectedOption(option);
			// Pass the product ID (as string) to Elementor, or empty string if cleared.
			onChange(option ? String(option.value) : '');
		},
		[onChange]
	);

	/**
	 * No options message for react-select.
	 *
	 * @param {Object} params             Parameters from react-select.
	 * @param {string} params.inputValue  Current input value.
	 * @returns {string} Message when no options are found.
	 */
	const noOptionsMessage = useCallback(({ inputValue }) => {
		if (!inputValue || inputValue.length < MIN_SEARCH_LENGTH) {
			return __('Type to search…', 'mosaic-layouts-for-elementor');
		}
		return __('No products found', 'mosaic-layouts-for-elementor');
	}, []);

	/**
	 * Loading message for react-select.
	 *
	 * @returns {string} Loading message.
	 */
	const loadingMessage = useCallback(
		() => __('Searching…', 'mosaic-layouts-for-elementor'),
		[]
	);

	/**
	 * Custom format for option labels — shows product thumbnail + name.
	 *
	 * @param {Object} option Option data { value, label, mediaId }.
	 * @returns {React.Element} Formatted label.
	 */
	const formatOptionLabel = useCallback((option) => {
		return (
			<div className="ml4e-product-option">
				<span className="ml4e-product-option__label">{option.label}</span>
				<span className="ml4e-product-option__id">#{option.value}</span>
			</div>
		);
	}, []);

	return (
		<div className="ml4e-product-select-wrapper">
			<AsyncSelect
				classNamePrefix="ml4e-ps"
				closeMenuOnSelect={true}
				defaultOptions={defaultOptions}
				loadOptions={loadOptions}
				noOptionsMessage={noOptionsMessage}
				loadingMessage={loadingMessage}
				value={selectedOption}
				onChange={handleChange}
				isMulti={false}
				isSearchable={true}
				isClearable={true}
				isLoading={isLoading}
				placeholder={__(
					'Select or type to search…',
					'mosaic-layouts-for-elementor'
				)}
				cacheOptions={false}
				formatOptionLabel={formatOptionLabel}
				menuPortalTarget={document.body}
				styles={{
					menuPortal: (base) => ({ ...base, zIndex: 100000 }),
					control: (base) => ({
						...base,
						minHeight: '36px',
						fontSize: '12px',
					}),
					option: (base) => ({
						...base,
						fontSize: '12px',
						padding: '6px 10px',
					}),
					placeholder: (base) => ({
						...base,
						fontSize: '12px',
					}),
				}}
			/>
		</div>
	);
};

export default ProductSelectView;
