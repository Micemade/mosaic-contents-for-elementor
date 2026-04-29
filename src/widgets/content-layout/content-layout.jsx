/**
 * Content Layout Widget Component.
 *
 * Renders WooCommerce products in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, products are assigned to them.
 * Pattern follows mosaic-product-layouts: map over layout items, find matching product.
 *
 * @module ContentLayoutWidget
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
import ItemControls from '../../shared/components/ItemControls.jsx';
import GridHelper from '../../shared/components/GridHelper.jsx';
import Pagination from '../../shared/components/Pagination.jsx';

// Utilities and data.
import { decode } from '../../shared/utils/generalUtils.js';
import { parseElementOrdering } from '../../shared/utils/elementOrdering.js';
import { getBreakpointTextAlignVars } from '../../shared/utils/alignmentUtils.js';
import { applyLayoutChange, selectElementorWidget, addGridItem, removeGridItem } from '../../shared/utils/layoutEditing.js';
import { getLayout } from '../../shared/utils/layoutUtils.js';
import { createCache } from '../../shared/utils/LRUCache.js';
import { loadCachedData } from '../../shared/utils/dataLoading.js';
import { useCssVariables, useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';
import { getVisibleLayout } from '../../shared/utils/visibleLayout.js';

import './content-layout.scss';

// Sanitize HTML content.
const Sanitizer = DOMPurify.sanitize;

// Cache: LRU in editor, plain object on frontend.
const productsCache = createCache();
const postTypeRouteCache = new Map([
	['post', 'posts'],
	['page', 'pages'],
	['attachment', 'media'],
]);

function getRestRoot() {
	const localizedRoot = window?.MC4E?.restRoot;
	const wpApiRoot = window?.wpApiSettings?.root;
	const fallback = '/wp-json/';

	const root = localizedRoot || wpApiRoot || fallback;
	return root.endsWith('/') ? root : `${root}/`;
}

async function resolvePostTypeRestBase(postType) {
	if (!postType) {
		return 'posts';
	}

	if (postTypeRouteCache.has(postType)) {
		return postTypeRouteCache.get(postType);
	}

	try {
		const response = await fetch(`${getRestRoot()}mc4e/v1/post-types`);
		if (response.ok) {
			const postTypes = await response.json();
			if (Array.isArray(postTypes)) {
				postTypes.forEach((typeObj) => {
					if (typeObj?.name && typeObj?.rest_base) {
						postTypeRouteCache.set(typeObj.name, typeObj.rest_base);
					}
				});
			}
		}
	} catch (error) {
		console.warn('Failed to resolve post type REST base; falling back to post type slug.', error);
	}

	return postTypeRouteCache.get(postType) || postType;
}

/**
 * Fetch posts from WordPress REST API.
 *
 * Uses /wc/store/v1/products endpoint (public, no auth required).
 * Pattern adapted from mosaic-product-layouts apiFetchQuery.
 *
 * @param {Object} querySettings - Query parameters from Elementor controls.
 * @returns {Promise<Object>} Product result with items and pagination metadata.
 */
async function fetchProducts(querySettings) {
	const {
		layoutItemLimit,
		mc4e_post_type,
		mc4e_orderby,
		mc4e_order,
		mc4e_taxonomy,
		mc4e_terms,
		mc4e_sticky,
		mc4e_page = 1,
	} = querySettings;

	// Build query parameters
	const params = new URLSearchParams();

	params.append('page', String(Math.max(1, Number(mc4e_page) || 1)));
	if (layoutItemLimit) params.append('per_page', layoutItemLimit);
	if (mc4e_orderby) params.append('orderby', mc4e_orderby);
	if (mc4e_order) params.append('order', mc4e_order);

	if (Array.isArray(mc4e_terms) && mc4e_terms.length > 0 && mc4e_taxonomy) {
		const termIds = mc4e_terms
			.filter((term) => typeof term === 'string' && term.startsWith(`${mc4e_taxonomy}:`))
			.map((term) => term.split(':')[1])
			.filter(Boolean);

		if (termIds.length) {
			params.append(mc4e_taxonomy, termIds.join(','));
		}
	}

	if (mc4e_sticky) params.append('sticky', 'true');

	params.append('_embed', 'wp:featuredmedia,wp:term');

	const postType = mc4e_post_type || 'post';
	const restBase = await resolvePostTypeRestBase(postType);
	const endpoint = `${getRestRoot()}wp/v2/${encodeURIComponent(restBase)}?${params.toString()}`;
	const response = await fetch(endpoint);

	if (!response.ok) {
		throw new Error(`WordPress REST API error: ${response.status}`);
	}

	const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
	const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

	const data = await response.json();

	const items = data.map((item) => {
		const featured = item?._embedded?.['wp:featuredmedia']?.[0] || null;
		const terms = (item?._embedded?.['wp:term'] || []).flat();

		return {
			id: item.id,
			name: item?.title?.rendered || '',
			shortDescription: item?.excerpt?.rendered || '',
			permalink: item?.link || '#',
			meta: item?.meta || {},
			terms,
			images: featured
				? [
					{
						src: featured?.source_url || '',
						srcset: featured?.media_details?.sizes
							? Object.values(featured.media_details.sizes)
								.map((size) => `${size.source_url} ${size.width}w`)
								.join(', ')
							: '',
						sizes: '(max-width: 1024px) 100vw, 50vw',
					},
				]
				: [],
		};
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
 * Content Layout Widget Component.
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
const ContentLayoutWidget = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {

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
		return getBreakpointTextAlignVars(widgetData?.mc4e_product_align, '--mc4e-product-align-text-');
	}, [widgetData?.mc4e_product_align]);

	// Extract settings with defaults
	const layoutId = widgetData?.mc4e_layout || 'default';
	const customLayoutData = widgetData?.mc4e_custom_layout || '';
	const contentLayoutVariant = widgetData?.mc4e_product_layout || 'vertical';
	const saleBadgePosition = widgetData?.mc4e_sale_badge_position || { x: 10, y: 10 };
	const featuredImageSize = widgetData?.mc4e_featured_image_size || 'automatic';
	const featuredImagePosition = widgetData?.mc4e_featured_image_position || { x: 50, y: 50 };
	const featuredImageFit = widgetData?.mc4e_image_fit || 'cover';
	const helperType = widgetData?.mc4e_helper_grid || 'none';
	const enablePagination = widgetData?.mc4e_enable_pagination || false;
	const selectedTerms = widgetData?.mc4e_terms || [];
	const selectedPostType = widgetData?.mc4e_post_type || 'post';

	// Element ordering from repeater control
	const elementOrdering = useMemo(
		() => parseElementOrdering(widgetData?.mc4e_element_ordering, [
			{ element_label: 'Title', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Excerpt', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Featured Image', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Read More', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Terms', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Post Meta', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
		]),
		[widgetData?.mc4e_element_ordering]
	);

	// Grid settings from Elementor controls
	const gridSettings = useGridSettings(widgetData, 'mc4e_items_margin', 'mc4e_row_height');
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
			mc4e_post_type: widgetData?.mc4e_post_type || 'post',
			mc4e_orderby: widgetData?.mc4e_orderby || 'date',
			mc4e_order: widgetData?.mc4e_order || 'desc',
			mc4e_taxonomy: widgetData?.mc4e_taxonomy || 'category',
			mc4e_terms: selectedTerms,
			mc4e_sticky: widgetData?.mc4e_sticky || false,
			mc4e_page: enablePagination ? currentPage : 1,
		}),
		[
			layoutItemCount,
			widgetData?.mc4e_post_type,
			widgetData?.mc4e_orderby,
			widgetData?.mc4e_order,
			widgetData?.mc4e_taxonomy,
			selectedTerms,
			widgetData?.mc4e_sticky,
			enablePagination,
			currentPage,
		]
	);

	useEffect(() => {
		setCurrentPage(1);
	}, [
		layoutItemCount,
		widgetData?.mc4e_post_type,
		widgetData?.mc4e_orderby,
		widgetData?.mc4e_order,
		widgetData?.mc4e_taxonomy,
		selectedTerms,
		widgetData?.mc4e_sticky,
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

			setError(null);

			await loadCachedData({
				cache: productsCache,
				cacheKey,
				fetcher: () => fetchProducts(querySettings),
				onCacheHit: (cachedData) => {
					if (Array.isArray(cachedData)) {
						// Backward-compatibility for old cache shape.
						setProducts(cachedData);
						setPaginationMeta({ total: cachedData.length, totalPages: 1 });
						return;
					}

					setProducts(cachedData.items || []);
					setPaginationMeta({
						total: cachedData.total || 0,
						totalPages: cachedData.totalPages || 1,
					});
				},
				onSuccess: (result) => {
					setProducts(result.items || []);
					setPaginationMeta({ total: result.total || 0, totalPages: result.totalPages || 1 });
				},
				onError: (err) => {
					console.error('Error fetching content:', err);
					setError('Failed to fetch content.Please try again later.');
					setPaginationMeta({ total: 0, totalPages: 1 });
				},
				setIsLoading,
				setIsFetching,
				hasExistingData: products.length > 0,
			});
		};

		loadProducts();
	}, [querySettings]);

	// Handle layout changes in editor (drag/resize)
	const handleLayoutChange = (newLayouts) => {
		applyLayoutChange({
			widgetType: 'content-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			newLayouts,
		});
	};

	const selectWidget = () => {
		selectElementorWidget({ isEditMode, widgetId, widgetClass: 'content-layout' });
	};

	// Handle adding a new grid item (editor only)
	const handleAddItem = () => {
		addGridItem({
			isEditMode,
			widgetType: 'content-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			gridColumns: {
				desktop: gridSettings.columns.desktop,
				tablet: gridSettings.columns.tablet,
				mobile: gridSettings.columns.mobile,
			},
		});
	};

	// Handle removing a grid item (editor only)
	const handleRemoveItem = (itemId) => {
		removeGridItem({
			isEditMode,
			widgetType: 'content-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			itemId,
		});
	};

	if (isLoading) {
		return (
			<div className="content-layout">
				<p className="layout-loading">Loading content...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="content-layout">
				<p className="content-layout-error">{error}</p>
			</div>
		);
	}

	if (products.length === 0) {
		return (
			<div className="content-layout">
				<p className="content-layout-empty">No content found.</p>
			</div>
		);
	}

	return (
		<>
			<div
				className="content-layout mosaic-content-layouts-widgets mosaic-content-layouts"
				data-widget-id={widgetId}
				style={{ ...cssVariables, ...alignTextVars }}
			>
				{isFetching && (
					<p className="layout-loading">Fetching posts...</p>
				)}
				<GridLayout
					layouts={visibleLayoutData}
					columns={gridSettings.columns}
					itemsMargin={gridSettings.itemsMargin}
					rowHeight={gridSettings.rowHeight}
					allowOverlap={widgetData?.mc4e_allow_overlap || false}
					compactionType={widgetData?.mc4e_compaction_type || 'vertical'}
					context={isEditMode ? 'edit' : 'frontend'}
					isDraggable={isEditMode}
					isResizable={isEditMode}
					onLayoutChange={isEditMode ? handleLayoutChange : undefined}
					selectWidget={selectWidget}
					draggableCancel=".mc4e-item-controls"
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
											settingKey={`mc4e_custom_layout`}
											itemId={layoutItem.i}
											layoutData={layoutData}
											customLayoutData={customLayoutData}
											widgetId={widgetId}
											widgetType='content-layout'
											onRemove={handleRemoveItem}
										/>
									)}
									<div className="item-wrapper empty">
										<p>No content item</p>
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
										settingKey={`mc4e_custom_layout`}
										itemId={layoutItem.i}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetId={widgetId}
										widgetType='content-layout'
										onRemove={handleRemoveItem}
									/>
								)}
								<div className={`item-wrapper ${contentLayoutVariant}`}>

									<figure className="product-image product-featured-image gradient-preloader">
										<ProductImage
											productId={matchedProduct.id}
											postType={selectedPostType}
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
													case 'excerpt':
														return matchedProduct.shortDescription ? (
															<div
																key={el.key}
																	className={`excerpt${elClasses}`}
																	dangerouslySetInnerHTML={{ __html: Sanitizer(matchedProduct.shortDescription) }}
															/>
														) : null;
													case 'read_more':
														return (
															<div key={el.key} className={`read-more-wrapper${elClasses}`}>
																<a className="read-more-link" href={matchedProduct.permalink}>
																	Read More
																</a>
															</div>
														);
													case 'terms':
														return matchedProduct.terms && matchedProduct.terms.length > 0 ? (
															<div key={el.key} className={`taxonomy terms${elClasses}`}>
																{matchedProduct.terms.flatMap((term, index) => [
																	...(index > 0 ? [', '] : []),
																	<a
																		key={`${term.taxonomy}-${term.id}`}
																		href={term.link || '#'}
																		className="tax-link"
																	>
																		{decode(term.name)}
																	</a>
																])}
															</div>
														) : null;
													case 'post_meta': {
														const rows = (widgetData?.mc4e_post_meta || []).filter((metaDef) => {
															const key = metaDef?.meta_key;
															if (!key) return false;
															const value = `${matchedProduct?.meta?.[key] ?? ''}`;
															const condition = metaDef?.meta_condition || 'always';
															const expected = `${metaDef?.meta_condition_value ?? ''}`;

															if (condition === 'not_empty') return value.trim() !== '';
															if (condition === 'equals') return value === expected;
															if (condition === 'not_equals') return value !== expected;
															return true;
														});

														if (!rows.length) return null;

														return (
															<div key={el.key} className={`post-meta${elClasses}`}>
																{rows.map((metaDef) => {
																	const key = metaDef.meta_key;
																	const value = `${matchedProduct?.meta?.[key] ?? ''}`;
																	const label = metaDef?.meta_label || key;

																		return (
																			<div key={key} className="post-meta-row">
																				<span className="post-meta-label">{label}:</span>{' '}
																				<span className="post-meta-value">{metaDef?.meta_prefix || ''}{value}{metaDef?.meta_suffix || ''}</span>
																			</div>
																		);
																	})}
															</div>
														);
													}
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
						<div className="mc4e-editor-toolbar">
							<button
								type="button"
								className="mc4e-toolbar-btn mc4e-add-item-btn"
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

export default ContentLayoutWidget;
