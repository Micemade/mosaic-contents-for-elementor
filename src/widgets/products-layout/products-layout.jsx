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
import ProductImage from '../../shared/components/ProductImage.jsx';
import RatingStars from '../../shared/components/RatingStars.jsx';
import AddToCartButton from '../../shared/components/AddToCartButton.jsx';
import ItemControls from '../../shared/components/ItemControls.jsx';
import GridHelper from '../../shared/components/GridHelper.jsx';
import Pagination from '../../shared/components/Pagination.jsx';

// Utilities and data.
import { decode } from '../../shared/utils/generalUtils.js';
import { parseElementOrdering } from '../../shared/utils/elementOrdering.js';
import { updateElementorSetting, getActiveBreakpointNames } from '../../core/elementor-utils';
import { addItemToLayout, removeItemFromLayout } from '../../shared/utils/addItem.js';
import { getLayout } from '../../shared/utils/layoutUtils.js';
import { LRUCache, createCache } from '../../shared/utils/LRUCache.js';
import { useCssVariables, useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';
import { getVisibleLayout, mergeVisibleIntoFullLayout } from '../../shared/utils/visibleLayout.js';

import './products-layout.scss';

// Sanitize HTML content.
const Sanitizer = DOMPurify.sanitize;

// Cache: LRU in editor, plain object on frontend.
const productsCache = createCache();

/**
 * Fetch products from WooCommerce Store API.
 *
 * Uses /wc/store/v1/products endpoint (public, no auth required).
 * Pattern adapted from mosaic-product-layouts apiFetchQuery.
 *
 * @param {Object} querySettings - Query parameters from Elementor controls.
 * @returns {Promise<Object>} Product result with items and pagination metadata.
 */
async function fetchProducts(querySettings) {
	const { layoutItemLimit, mpl4e_orderby, mpl4e_order, mpl4e_category, mpl4e_on_sale, mpl4e_featured, mpl4e_page = 1 } = querySettings;

	// Build query parameters
	const params = new URLSearchParams();

	params.append('page', String(Math.max(1, Number(mpl4e_page) || 1)));
	if (layoutItemLimit) params.append('per_page', layoutItemLimit);
	if (mpl4e_orderby) params.append('orderby', mpl4e_orderby);
	if (mpl4e_order) params.append('order', mpl4e_order);

	// Handle multiple categories (array or comma-separated string)
	if (mpl4e_category) {
		if (Array.isArray(mpl4e_category) && mpl4e_category.length > 0) {
			// WC Store API accepts comma-separated category IDs
			params.append('category', mpl4e_category.join(','));
		} else if (typeof mpl4e_category === 'string' && mpl4e_category) {
			params.append('category', mpl4e_category);
		}
	}

	if (mpl4e_on_sale) params.append('on_sale', 'true');
	if (mpl4e_featured) params.append('featured', 'true');

	// Specify fields to return (optimizes response size)
	params.append(
		'_fields',
		'id,name,short_description,price_html,images,permalink,add_to_cart,type,average_rating,review_count,on_sale,categories,brands'
	);

	const response = await fetch(`/wp-json/wc/store/v1/products?${params.toString()}`);

	if (!response.ok) {
		throw new Error(`WC Store API error: ${response.status}`);
	}

	const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
	const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

	const data = await response.json();

	// Convert snake_case keys to camelCase (matches mosaic-product-layouts pattern)
	const items = data.map((item) => {
		return Object.keys(item).reduce((acc, key) => {
			const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) =>
				letter.toUpperCase()
			);
			acc[camelCaseKey] = item[key];
			return acc;
		}, {});
	});

	return { items, total, totalPages };
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
 * @param {string} props.mode - 'display' (frontend) or 'edit' (editor).
 */
const ProductsLayoutWidget = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {

	// Determine if we're in edit mode (from prop, not runtime detection)
	const isEditMode = mode === 'edit';

	const [products, setProducts] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 1 });

	// Generate CSS custom properties from responsive settings
	const cssVariables = useCssVariables(widgetData);

	// Map flex justify-content alignment values → text-align equivalents for .product-elements.
	// flex-start → left, flex-end → right, center → center.
	const alignTextVars = useMemo(() => {
		const vars = {};
		const alignSetting = widgetData?.mpl4e_product_align;
		if (alignSetting && typeof alignSetting === 'object') {
			const flexToTextAlign = { 'flex-start': 'left', 'flex-end': 'right', 'center': 'center' };
			getActiveBreakpointNames().forEach(bp => {
				const mapped = flexToTextAlign[alignSetting[bp]];
				if (mapped) {
					vars[`--mpl4e-product-align-text-${bp}`] = mapped;
				}
			});
		}
		return vars;
	}, [widgetData?.mpl4e_product_align]);

	// Extract settings with defaults
	const layoutId = widgetData?.mpl4e_layout || 'layout-1';
	const customLayoutData = widgetData?.mpl4e_custom_layout || '';
	const productLayout = widgetData?.mpl4e_product_layout || 'vertical';
	const saleBadgePosition = widgetData?.mpl4e_sale_badge_position || { x: 10, y: 10 };
	const featuredImageSize = widgetData?.mpl4e_featured_image_size || 'automatic';
	const featuredImagePosition = widgetData?.mpl4e_featured_image_position || { x: 50, y: 50 };
	const featuredImageFit = widgetData?.mpl4e_image_fit || 'cover';
	const helperType = widgetData?.mpl4e_helper_grid || 'none';
	const enablePagination = widgetData?.mpl4e_enable_pagination || false;
	const normalizedCategory = useMemo(() => {
		if (Array.isArray(widgetData?.mpl4e_category)) {
			return widgetData.mpl4e_category.join(',');
		}

		return widgetData?.mpl4e_category || '';
	}, [widgetData?.mpl4e_category]);

	// Element ordering from repeater control
	const elementOrdering = useMemo(
		() => parseElementOrdering(widgetData?.mpl4e_element_ordering, [
			{ element_label: 'Title', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Price', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Rating', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Add to Cart', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Categories', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Brands', visible_desktop: 'no', visible_tablet: 'no', visible_mobile: 'no' },
		]),
		[widgetData?.mpl4e_element_ordering]
	);

	// Grid settings from Elementor controls
	const gridSettings = useGridSettings(widgetData, 'mpl4e_items_margin', 'mpl4e_row_height');
	// Track Elementor's device mode switcher for the grid helper column calculation.
	const deviceType = useElementorDevice();

	// Get layout from predefined layouts (layout is source of truth for grid structure)
	// If custom_layout exists, parse and use it; otherwise use predefined layout
	const layoutData = useMemo(() => {
		if (customLayoutData) {
			try {
				const parsed = JSON.parse(customLayoutData);
				return parsed;
			} catch (error) {
				console.error('Failed to parse custom layout:', error);
				return getLayout(layoutId);
			}
		}

		return getLayout(layoutId);
	}, [layoutId, customLayoutData]);

	const layoutItemCount = Math.max(1, layoutData?.mobile?.length || 0);

	// Memoize query settings to prevent unnecessary re-fetches
	const querySettings = useMemo(
		() => ({
			layoutItemLimit: layoutItemCount,
			mpl4e_orderby: widgetData?.mpl4e_orderby || 'date',
			mpl4e_order: widgetData?.mpl4e_order || 'desc',
			mpl4e_category: normalizedCategory,
			mpl4e_on_sale: widgetData?.mpl4e_on_sale || false,
			mpl4e_featured: widgetData?.mpl4e_featured || false,
			mpl4e_page: enablePagination ? currentPage : 1,
		}),
		[
			layoutItemCount,
			widgetData?.mpl4e_orderby,
			widgetData?.mpl4e_order,
			normalizedCategory,
			widgetData?.mpl4e_on_sale,
			widgetData?.mpl4e_featured,
			enablePagination,
			currentPage,
		]
	);

	useEffect(() => {
		setCurrentPage(1);
	}, [
		layoutItemCount,
		widgetData?.mpl4e_orderby,
		widgetData?.mpl4e_order,
		normalizedCategory,
		widgetData?.mpl4e_on_sale,
		widgetData?.mpl4e_featured,
		enablePagination,
	]);


	// Visible layout: temporarily hide slots that have no matching product.
	// The full layoutData is preserved and hidden items are restored automatically
	// when the query returns more results.
	const visibleLayoutData = useMemo(
		() => getVisibleLayout(layoutData, products.length),
		[layoutData, products.length]
	);

	// Prepare products data with layout item assignments
	// Maps products to visible layout items: { ...product, i: 'item-0' }
	const productsData = useMemo(() => {
		return prepareProductsData(products, visibleLayoutData.mobile);
	}, [products, visibleLayoutData.mobile]);

	useEffect(() => {
		const loadProducts = async () => {
			// Create cache key from query settings
			const cacheKey = JSON.stringify(querySettings);
			
			// Check cache first (supports both LRU cache and plain object)
			const cachedData = productsCache instanceof LRUCache 
				? productsCache.get(cacheKey)
				: productsCache[cacheKey];
			
			if (cachedData) {
				if (Array.isArray(cachedData)) {
				// Backward-compatibility for old cache shape.
					setProducts(cachedData);
					setPaginationMeta({ total: cachedData.length, totalPages: 1 });
				} else {
					setProducts(cachedData.items || []);
					setPaginationMeta({
						total: cachedData.total || 0,
						totalPages: cachedData.totalPages || 1,
					});
				}
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
				
				const result = await fetchProducts(querySettings);
				
				// Store in cache (supports both LRU cache and plain object)
				if (productsCache instanceof LRUCache) {
					productsCache.set(cacheKey, result);
				} else {
					productsCache[cacheKey] = result;
				}
				
				setProducts(result.items || []);
				setPaginationMeta({ total: result.total || 0, totalPages: result.totalPages || 1 });
			} catch (err) {
				console.error('Error fetching products:', err);
				setError('Failed to fetch products. Please try again later.');
				setPaginationMeta({ total: 0, totalPages: 1 });
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

		// react-grid-layout only reports visible items. Merge those changes back
		// into the full layout so hidden items are not lost.
		const baseLayout = existingCustomLayout.mobile?.length ? existingCustomLayout : layoutData;
		const merged = mergeVisibleIntoFullLayout(baseLayout, newLayouts);

		const customLayout = {
			...merged,
			zindex: existingCustomLayout.zindex || layoutData.zindex || {}
		};

		updateElementorSetting('products-layout', widgetId, 'mpl4e_custom_layout', JSON.stringify(customLayout));
	};

	const selectWidget = () => {
		if (!isEditMode || !widgetId) return;

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

	// Handle adding a new grid item (editor only)
	const handleAddItem = () => {
		if (!isEditMode || !widgetId) return;

		const gridColumns = {
			desktop: gridSettings.columns.desktop,
			tablet: gridSettings.columns.tablet,
			mobile: gridSettings.columns.mobile
		};

		// Use current layoutData (either from custom layout or predefined layout)
		// This ensures predefined layout items are preserved when adding new items
		const currentLayout = customLayoutData || JSON.stringify(layoutData);
		const { newLayoutJson } = addItemToLayout(currentLayout, gridColumns);
		updateElementorSetting('products-layout', widgetId, 'mpl4e_custom_layout', newLayoutJson);
	};

	// Handle removing a grid item (editor only)
	const handleRemoveItem = (itemId) => {
		if (!isEditMode || !widgetId) return;

		// Prevent removing if only one item left
		if (layoutData.mobile.length <= 1) {
			return;
		}

		// Use current layoutData (either from custom layout or predefined layout)
		const currentLayout = customLayoutData || JSON.stringify(layoutData);
		const newLayoutJson = removeItemFromLayout(currentLayout, itemId);
		updateElementorSetting('products-layout', widgetId, 'mpl4e_custom_layout', newLayoutJson);
	};

	if (isLoading) {
		return (
			<div className="products-layout">
				<p className="layout-loading">Loading products...</p>
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
		<><div
			className="products-layout mosaic-product-layouts-widgets micemade-widgets"
			data-widget-id={widgetId}
			style={{ ...cssVariables, ...alignTextVars }}
		>
			{isFetching && (
				<p className="layout-loading">Fetching products...</p>
			)}
			<GridLayout
			layouts={visibleLayoutData}
			columns={gridSettings.columns}
			itemsMargin={gridSettings.itemsMargin}
			rowHeight={gridSettings.rowHeight}
			allowOverlap={widgetData?.mpl4e_allow_overlap || false}
			compactionType={widgetData?.mpl4e_compaction_type || 'vertical'}
			context={isEditMode ? 'edit' : 'frontend'}
			isDraggable={isEditMode}
			isResizable={isEditMode}
			onLayoutChange={isEditMode ? handleLayoutChange : undefined}
			selectWidget={selectWidget}
			draggableCancel=".mpl4e-item-controls"
		>
			{/* Map over visible layout items only — items without a matching product are hidden */}
			{visibleLayoutData.mobile.map((layoutItem) => {
					const matchedProduct = productsData.find((p) => p.i === layoutItem.i);
					const zIndex = layoutData.zindex?.[layoutItem.i] || 0;

					// Skip empty items (no product assigned)
					if (!matchedProduct || matchedProduct.empty) {
						return (
							<div
								key={layoutItem.i}
								className="product-item product-item--empty"
							>
								{/* Editor-only item controls */}
								{isEditMode && (
									<ItemControls
										settingKey={`mpl4e_custom_layout`}
										itemId={layoutItem.i}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetId={widgetId}
										widgetType='products-layout'
										onRemove={handleRemoveItem}
									/>
								)}
								<div className="item-wrapper empty">
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
							{/* Editor-only item controls */}
							{isEditMode && (
								<ItemControls
									settingKey={`mpl4e_custom_layout`}
									itemId={layoutItem.i}
									layoutData={layoutData}
									customLayoutData={customLayoutData}
									widgetId={widgetId}
									widgetType='products-layout'
									onRemove={handleRemoveItem}
								/>
							)}
							{matchedProduct.onSale && (
								<div
									className='sale-badge-wrapper'
									style={{
										left: `${saleBadgePosition.x}%`,
										top: `${saleBadgePosition.y}%`,
									}}
								>
									<span className="product-badge sale-badge rounded">Sale</span>
								</div>
							)}

							<div className={`item-wrapper ${productLayout}`}>

								<figure className="product-image product-featured-image gradient-preloader">
									<ProductImage
										productId={matchedProduct.id}
										name={matchedProduct.name}
										images={matchedProduct.images}
										featuredImageSize={featuredImageSize}
										style={{
											'object-position': `${featuredImagePosition.x}% ${featuredImagePosition.y}%`,
											'object-fit': featuredImageFit,
										}}
									/>

								</figure>

								<div className='flex-wrapper'>
									<div className="product-info product-elements">

										{elementOrdering.map((el) => {
											const elClasses = el.hideClasses ? ` ${el.hideClasses}` : '';
											switch (el.key) {
												case 'title':
													return (
														<h3 key={el.key} className={`name${elClasses}`}>
															<a href={matchedProduct.permalink}>{decode(matchedProduct.name)}</a>
														</h3>
													);
												case 'price':
													return matchedProduct.priceHtml ? (
														<div
															key={el.key}
															className={`price${elClasses}`}
															dangerouslySetInnerHTML={{ __html: Sanitizer(matchedProduct.priceHtml) }}
														/>
													) : null;
												case 'rating':
													return matchedProduct.averageRating && matchedProduct.averageRating !== '0' ? (
														<div key={el.key} className={`rating-wrapper${elClasses}`}>
															<RatingStars rating={Number(matchedProduct.averageRating)} reviewCount={matchedProduct.reviewCount} />
														</div>
													) : null;
												case 'add_to_cart':
													return (
														<div key={el.key} className={`add-to-cart-wrapper${elClasses}`}>
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
													);
												case 'categories':
													return matchedProduct.categories && matchedProduct.categories.length > 0 ? (
														<div key={el.key} className={`taxonomy categories${elClasses}`}>
															{matchedProduct.categories.flatMap((cat, index) => [
																...(index > 0 ? [', '] : []),
																<a
																	key={cat.id}
																	href={cat.link || '#'}
																	className="tax-link"
																>
																	{decode(cat.name)}
																</a>
															])}
														</div>
													) : null;
												case 'brands':
													return matchedProduct.brands && matchedProduct.brands.length > 0 ? (
														<div key={el.key} className={`taxonomy brands${elClasses}`}>
															{matchedProduct.brands.flatMap((brand, index) => [
																...(index > 0 ? [', '] : []),
																<a
																	key={brand.id}
																	href={brand.link || '#'}
																	className="tax-link"
																>
																	{decode(brand.name)}
																</a>
															])}

														</div>
													) : null;
												default:
													return null;
											}
										})}

									</div>
								</div>

							</div>
						</div>
					);
				})}
			</GridLayout>



			{/* Editor-only floating toolbar */}
			{isEditMode && (
				<>
					<div className="mpl4e-editor-toolbar">
						<button
							type="button"
							className="mpl4e-toolbar-btn mpl4e-add-item-btn"
							onClick={handleAddItem}
							title="Add Item"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<line x1="12" y1="5" x2="12" y2="19"></line>
								<line x1="5" y1="12" x2="19" y2="12"></line>
							</svg>
							<span>Add Item</span>
						</button>
					</div>

					<GridHelper gridSettings={gridSettings} device={deviceType} cols={gridSettings.columns} type={helperType} />
				</>
			)}
		</div>

			{enablePagination && paginationMeta.totalPages > 1 && (
				<Pagination
					currentPage={currentPage}
					totalPages={paginationMeta.totalPages}
					total={paginationMeta.total}
					itemsPerLayout={layoutItemCount}
					onPageChange={setCurrentPage}
				/>
			)}
		</>
	);
};

export default ProductsLayoutWidget;
