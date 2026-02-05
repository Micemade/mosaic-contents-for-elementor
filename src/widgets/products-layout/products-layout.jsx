/**
 * Products Layout Widget Component.
 *
 * Renders WooCommerce products in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, products are assigned to them.
 * Pattern follows mosaic-product-layouts: map over layout items, find matching product.
 *
 * @module ProductsLayoutWidget
 */

/*
 * External dependencies.
 */
import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';

/*
 * Internal dependencies.
 */
// Components.
import GridLayout from '../../shared/components/GridLayout.jsx';
import ProductImage from './components/ProductImage.jsx';
import RatingStars from './components/RatingStars.jsx';
import AddToCartButton from './components/AddToCartButton.jsx';

// Utilities and data.
import Layouts from '../../shared/layouts.json';
import { decode } from '../../shared/utils/generalUtils.js';
import { updateElementorSetting, isElementorEditor, getActiveBreakpoints } from '../../core/elementor-utils';

import './products-layout.scss';

// Sanitize HTML content.
const Sanitizer = DOMPurify.sanitize;

// LRU Cache class for Elementor editor (limits memory usage)
class LRUCache {
	constructor(maxSize = 20) {
		this.maxSize = maxSize;
		this.cache = new Map(); // Map maintains insertion order
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
		// Remove if exists (will re-add at end)
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}
		
		// Add to end (most recent)
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

// Detect if we're in Elementor editor mode
const isEditorMode = isElementorEditor;

// Use LRU cache in editor (prevents memory issues during long editing sessions)
// Use simple object in frontend (no remounts, less memory pressure)
const productsCache = isEditorMode() ? new LRUCache(20) : {};

/**
 * Fetch products from WooCommerce Store API.
 *
 * Uses /wc/store/v1/products endpoint (public, no auth required).
 * Pattern adapted from mosaic-product-layouts apiFetchQuery.
 *
 * @param {Object} querySettings - Query parameters from Elementor controls.
 * @returns {Promise<Array>} Array of product objects with camelCase keys.
 */
async function fetchProducts(querySettings) {
	const { per_page, orderby, order, category, on_sale, featured } = querySettings;

	// Build query parameters
	const params = new URLSearchParams();

	if (per_page) params.append('per_page', per_page);
	if (orderby) params.append('orderby', orderby);
	if (order) params.append('order', order);
	if (category) params.append('category', category);
	if (on_sale) params.append('on_sale', 'true');
	if (featured) params.append('featured', 'true');

	// Specify fields to return (optimizes response size)
	params.append(
		'_fields',
		'id,name,short_description,price_html,images,permalink,add_to_cart,type,average_rating,review_count,on_sale'
	);

	const response = await fetch(`/wp-json/wc/store/v1/products?${params.toString()}`);

	if (!response.ok) {
		throw new Error(`WC Store API error: ${response.status}`);
	}

	const data = await response.json();

	// Convert snake_case keys to camelCase (matches mosaic-product-layouts pattern)
	return data.map((item) => {
		return Object.keys(item).reduce((acc, key) => {
			const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) =>
				letter.toUpperCase()
			);
			acc[camelCaseKey] = item[key];
			return acc;
		}, {});
	});
}

/**
 * Get layout from predefined layouts.
 *
 * Parses the layout JSON and converts PascalCase breakpoint keys to lowercase.
 * Layout item IDs (item-0, item-1, etc.) are preserved for product mapping.
 *
 * @param {string} layoutId - ID of the layout to use (e.g., 'layout-1')
 * @param {number} itemCount - Number of items in the layout (for fallback selection)
 * @returns {Object} Parsed layouts object with desktop, tablet, mobile arrays
 */
function getLayout(layoutId = 'layout-1', itemCount = 3) {
	// Find layout by ID
	let layoutData = Layouts.find((l) => l.id === layoutId);

	// Fallback: find layout matching item count
	if (!layoutData) {
		if (itemCount <= 3) {
			layoutData = Layouts.find((l) => l.id === 'layout-1');
		} else if (itemCount <= 4) {
			layoutData = Layouts.find((l) => l.id === 'layout-10');
		} else {
			layoutData = Layouts.find((l) => l.id === 'layout-10');
		}
	}

	if (!layoutData) {
		return { desktop: [], tablet: [], mobile: [], zindex: {} };
	}

	// Parse the JSON value
	const parsed = JSON.parse(layoutData.value);
	const zindex = layoutData.zindex ? JSON.parse(layoutData.zindex) : {};

	// Convert PascalCase to lowercase for Elementor breakpoints
	return {
		desktop: parsed.Desktop || [],
		tablet: parsed.Tablet || [],
		mobile: parsed.Mobile || [],
		zindex,
	};
}

/**
 * Prepare products data with layout item assignments.
 *
 * Assigns each product to a layout item ID (item-0, item-1, etc.)
 * following the mosaic-product-layouts pattern where layout items
 * are the primary structure and products are mapped to them.
 *
 * @param {Array} products - Array of fetched products
 * @param {Array} layoutItems - Layout items from Mobile breakpoint (source of truth)
 * @returns {Array} Products with 'i' property matching layout item IDs
 */
function prepareProductsData(products, layoutItems) {
	return layoutItems.map((layoutItem, index) => {
		const product = products[index] || null;
		if (product) {
			return { ...product, i: layoutItem.i };
		}
		return { i: layoutItem.i, empty: true };
	});
}

/**
 * Products Layout Widget Component.
 *
 * Renders WooCommerce products in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, products are assigned to them.
 * Pattern follows mosaic-product-layouts: map over layout items, find matching product.
 *
 * @param {Object} props
 * @param {Object} props.widgetData - Settings from Elementor controls.
 * @param {string} props.widgetId - Unique widget instance ID.
 */
const ProductsLayoutWidget = ({ widgetData = {}, widgetId = null }) => {

	const [products, setProducts] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState(null);

	/**
	 * Generate CSS custom properties from responsive settings
	 * These will be scoped to this widget instance only
	 * Memoized to react to widgetData changes
	 */
	const cssVariables = useMemo(() => {
		const vars = {};
		const breakpoints = getActiveBreakpoints();

		// Iterate through all settings in widgetData
		Object.keys(widgetData).forEach(settingKey => {
			const settingValue = widgetData[settingKey];

			// Check if this is a responsive setting (has breakpoint properties)
			if (settingValue && typeof settingValue === 'object' && !Array.isArray(settingValue)) {
				// Check if it has breakpoint keys
				const hasBreakpoints = breakpoints.some(bp => settingValue.hasOwnProperty(bp));

				if (hasBreakpoints) {
					// Generate CSS variables for each breakpoint
					breakpoints.forEach(breakpoint => {
						const value = settingValue[breakpoint];

						if (value !== undefined && value !== null) {
							const varName = `--${settingKey.replace(/_/g, '-')}-${breakpoint}`;

							// Handle different value types
							if (typeof value === 'object' && value.size !== undefined) {
								// Elementor slider format: { size: 26, unit: 'px' }
								vars[varName] = `${value.size}${value.unit || 'px'}`;
							} else if (typeof value === 'string' || typeof value === 'number') {
								// Plain value
								vars[varName] = value;
							}
						}
					});
				}
			} else if (typeof settingValue === 'string' || typeof settingValue === 'number') {
				// Handle non-responsive CSS values (colors, etc.)
				// Only process settings that look like CSS values
				if (settingKey.includes('color') || settingKey.includes('background') ||
					settingKey.includes('border') || settingKey.includes('shadow')) {
					const varName = `--${settingKey.replace(/_/g, '-')}`;
					vars[varName] = settingValue;
				}
			}
		});

		return vars;
	}, [widgetData]);

	// Extract settings with defaults
	const layoutId = widgetData?.layout || 'layout-1';
	const customLayoutData = widgetData?.custom_layout || '';
	const productLayout = widgetData?.product_layout || 'vertical';
	const ratingSize = widgetData?.rating_size || 1;


	// Grid settings from Elementor controls
	const gridSettings = useMemo(
		() => ({
			columns: {
				desktop: 48, // react-grid-layout default columns
				tablet: 24,
				mobile: 12,
			},
			itemsMargin: widgetData?.items_margin?.size || 15,
			rowHeight: widgetData?.row_height?.size || 10,
		}),
		[widgetData?.items_margin, widgetData?.row_height]
	);

	// Memoize query settings to prevent unnecessary re-fetches
	const querySettings = useMemo(
		() => ({
			per_page: widgetData?.per_page || 10,
			orderby: widgetData?.orderby || 'date',
			order: widgetData?.order || 'desc',
			category: widgetData?.category || '',
			on_sale: widgetData?.on_sale || false,
			featured: widgetData?.featured || false,
		}),
		[
			widgetData?.per_page,
			widgetData?.orderby,
			widgetData?.order,
			widgetData?.category,
			widgetData?.on_sale,
			widgetData?.featured,
		]
	);

	// Get layout from predefined layouts (layout is source of truth for grid structure)
	// If custom_layout exists, parse and use it; otherwise use predefined layout
	const layoutData = useMemo(() => {
		if (customLayoutData) {
			try {
				const parsed = JSON.parse(customLayoutData);
				return parsed;
			} catch (error) {
				console.error('Failed to parse custom layout:', error);
				return getLayout(layoutId, querySettings.per_page);
			}
		}
		return getLayout(layoutId, querySettings.per_page);
	}, [layoutId, customLayoutData, querySettings.per_page]);

	// Prepare products data with layout item assignments
	// Maps products to layout items: { ...product, i: 'item-0' }
	const productsData = useMemo(() => {
		return prepareProductsData(products, layoutData.mobile);
	}, [products, layoutData.mobile]);

	useEffect(() => {
		const loadProducts = async () => {
			// Create cache key from query settings
			const cacheKey = JSON.stringify(querySettings);
			
			// Check cache first (supports both LRU cache and plain object)
			const cachedData = productsCache instanceof LRUCache 
				? productsCache.get(cacheKey)
				: productsCache[cacheKey];
			
			if (cachedData) {
				setProducts(cachedData);
				setIsLoading(false);
				setIsFetching(false);
				setError(null);
				return;
			}
			
			try {
				// Only show full loading on initial load (no products yet)
				// Otherwise just show fetching indicator
				if (products.length === 0) {
					setIsLoading(true);
				} else {
					setIsFetching(true);
				}
				setError(null);
				
				const data = await fetchProducts(querySettings);
				
				// Store in cache (supports both LRU cache and plain object)
				if (productsCache instanceof LRUCache) {
					productsCache.set(cacheKey, data);
				} else {
					productsCache[cacheKey] = data;
				}
				
				setProducts(data);
			} catch (err) {
				console.error('Error fetching products:', err);
				setError('Failed to fetch products. Please try again later.');
			} finally {
				setIsLoading(false);
				setIsFetching(false);
			}
		};

		loadProducts();
	}, [querySettings]);

	// Handle layout changes in editor (drag/resize)
	const handleLayoutChange = (newLayouts) => {
		// Only update in Elementor editor mode
		if (typeof elementor === 'undefined' || !widgetId) return;

		// Get custom layout data to preserve unchanged breakpoints
		let existingCustomLayout = {};
		if (customLayoutData) {
			try {
				existingCustomLayout = JSON.parse(customLayoutData);
			} catch (error) {
				console.error('Failed to parse existing custom layout:', error);
			}
		}

		// Merge new layouts with existing, preserving zindex
		const customLayout = {
			desktop: newLayouts.desktop || existingCustomLayout.desktop || layoutData.desktop,
			tablet: newLayouts.tablet || existingCustomLayout.tablet || layoutData.tablet,
			mobile: newLayouts.mobile || existingCustomLayout.mobile || layoutData.mobile,
			zindex: existingCustomLayout.zindex || layoutData.zindex || {}
		};

		// Update Elementor setting using utility function
		// Widget type is 'products-layout' for this component
		updateElementorSetting('products-layout', widgetId, 'custom_layout', JSON.stringify(customLayout));

	};

	const selectWidget = () => {
		if (!isElementorEditor() || !widgetId) return;

		try {
			// Find the editor view at selection time
			const $widgetEl = jQuery(
				`.products-layout[data-widget-id="${widgetId}"]`
			).closest('[data-id]');

			// Trigger a click on the editor widget element to cause selection
			if ($widgetEl && $widgetEl.length) {
				$widgetEl.trigger('click');
			}
		} catch (err) {
			console.error('Error selecting widget:', err);
		}
	};

	if (isLoading) {
		return (
			<div className="products-layout">
				<p className="products-layout-loading">Loading products...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="products-layout">
				<p className="products-layout-error">{error}</p>
			</div>
		);
	}

	if (products.length === 0) {
		return (
			<div className="products-layout">
				<p className="products-layout-empty">No products found.</p>
			</div>
		);
	}

	return (
		<div
			className="products-layout mosaic-products-layout"
			data-widget-id={widgetId}
			style={cssVariables}
		>
			{isFetching && (
				<p className="products-layout-loading">Loading products...</p>
			)}
			<GridLayout
				layouts={layoutData}
				columns={gridSettings.columns}
				itemsMargin={gridSettings.itemsMargin}
				rowHeight={gridSettings.rowHeight}
				allowOverlap={widgetData?.allow_overlap || false}
				compactionType={widgetData?.compaction_type || 'vertical'}
				context="frontend"
				onLayoutChange={handleLayoutChange}
				selectWidget={selectWidget}
			>
				{/* Map over layout items (Mobile is source of truth), find matching product */}
				{layoutData.mobile.map((layoutItem) => {
					const matchedProduct = productsData.find((p) => p.i === layoutItem.i);
					const zIndex = layoutData.zindex?.[layoutItem.i] || 0;

					// Skip empty items (no product assigned)
					if (!matchedProduct || matchedProduct.empty) {
						return (
							<div key={layoutItem.i} className="product-item product-item--empty">
								<div className="product-info">
									<p>No product</p>
								</div>
							</div>
						);
					}

					return (
						<div
							key={layoutItem.i}
							className="product-item"
							style={{ zIndex }}
						>
							<div className={`product-wrapper ${productLayout}`}>

								<figure className="product-image product-featured-image">
									<a href={matchedProduct.permalink}>
										<ProductImage
											productId={matchedProduct.id}
											name={matchedProduct.name}
											images={matchedProduct.images}
											featuredImageSize="automatic"
										/>
									</a>

								</figure>

								<div className='flex-wrapper'>
									<div className="product-info product-elements">

										<h3 className="name">
											<a href={matchedProduct.permalink}>{decode(matchedProduct.name)}</a>
										</h3>

										{matchedProduct.priceHtml && (
											<div
												className="price"
												dangerouslySetInnerHTML={{ __html: Sanitizer(matchedProduct.priceHtml) }}
											/>
										)}
										{matchedProduct.averageRating && matchedProduct.averageRating !== '0' && (

											<div className={`rating-wrapper`}>
												<RatingStars rating={Number(matchedProduct.averageRating)} reviewCount={matchedProduct.reviewCount} />
											</div>

										)}

										{/* Add to Cart Button using WooCommerce Interactivity API */}
										<div className="add-to-cart-wrapper">
											<AddToCartButton
												product={{
													id: matchedProduct.id,
													name: matchedProduct.name,
													type: matchedProduct.type || 'simple',
													sku: matchedProduct.sku || '',
													permalink: matchedProduct.permalink,
													addToCart: matchedProduct.addToCart,
												}}
											/>
										</div>

										{matchedProduct.onSale && (
											<div className='sale-badge-wrapper'>
												<span className="product-badge sale-badge rounded">Sale</span>
											</div>
										)}
									</div>
								</div>

							</div>
						</div>
					);
				})}
			</GridLayout>
		</div>
	);
};

export default ProductsLayoutWidget;
