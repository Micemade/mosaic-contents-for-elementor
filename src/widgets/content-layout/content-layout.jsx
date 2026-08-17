/**
 * Content Layout Widget Component.
 *
 * Renders p[ost type items in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, items are assigned to them.
 * Pattern follows mosaic-posttypeitem-layouts: map over layout items, find matching item.
 *
 * @module ContentLayoutWidget
 */

/*
 * External dependencies.
 */
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import DOMPurify from 'dompurify';

/*
 * Internal dependencies.
 */
// Components.
import GridLayout from '../../shared/components/GridLayout.jsx';
import FeaturedImage from '../../shared/components/FeaturedImage.jsx';
import ItemControls from '../../shared/components/ItemControls.jsx';
import GridHelper from '../../shared/components/GridHelper.jsx';
import Pagination from '../../shared/components/Pagination.jsx';

// Utilities and data.
import { decode } from '../../shared/utils/generalUtils.js';
import { parseElementOrdering } from '../../shared/utils/elementOrdering.js';
import { getBreakpointTextAlignVars } from '../../shared/utils/alignmentUtils.js';
import { applyLayoutChange, selectElementorWidget, addGridItem, removeGridItem } from '../../shared/utils/layoutEditing.js';
import { resolveLayoutData } from '../../shared/utils/layoutUtils.js';
import { createCache } from '../../shared/utils/LRUCache.js';
import { loadCachedData } from '../../shared/utils/dataLoading.js';
import { getRestRoot, resolvePostTypeRestBase, resolveTaxonomyRestBase } from '../../shared/utils/fetchHelpers.js';
import { useCssVariables, useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';
import { getVisibleLayout } from '../../shared/utils/visibleLayout.js';

import './content-layout.scss';

// Sanitize HTML content.
//
// DELIBERATE: this costs ~23 KB of the frontend bundle and was reviewed as a
// removal candidate. It stays as defence-in-depth. WordPress escapes
// `title.rendered` and `excerpt.rendered` itself, but both pass through
// filters (`the_title`, `the_excerpt`, `get_the_excerpt`) that any theme or
// plugin on the site can hook, so what wp/v2 returns is not guaranteed to be
// what core produced. The values land in `dangerouslySetInnerHTML`, which
// makes this the last line of defence rather than a redundant one.
//
// Do not drop this without also removing the dangerouslySetInnerHTML usages
// below. Configure DOMPurify with a strict whitelist for safe HTML.
const DOMPurifyConfig = {
	ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'a'],
	ALLOWED_ATTR: ['href', 'target', 'rel'],
	KEEP_CONTENT: true,
};

const Sanitizer = (html) => DOMPurify.sanitize(html, DOMPurifyConfig);

// Cache: LRU in editor, plain object on frontend.
const postTypesCache = createCache();

/**
 * Format a post's ISO date (wp/v2 `date`/`modified`) for display.
 *
 * @param {string} iso    ISO date string.
 * @param {string} format One of 'long' | 'medium' | 'short' | 'numeric'.
 * @returns {string}
 */
function formatPostDate(iso, format = 'long') {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	if (format === 'numeric') return String(iso).slice(0, 10); // YYYY-MM-DD
	const opts =
		format === 'short'
			? { year: 'numeric', month: '2-digit', day: '2-digit' }
			: format === 'medium'
				? { year: 'numeric', month: 'short', day: 'numeric' }
				: { year: 'numeric', month: 'long', day: 'numeric' };
	try {
		return new Intl.DateTimeFormat(undefined, opts).format(d);
	} catch {
		return String(iso).slice(0, 10);
	}
}

/**
 * Fetch posts from WordPress REST API.
 *
 * Uses /wc/store/v1/post_types endpoint (public, no auth required).
 * Pattern adapted from mosaic-posttypeitem-layouts apiFetchQuery.
 *
 * @param {Object} querySettings - Query parameters from Elementor controls.
 * @param {AbortSignal} signal - Abort signal for canceling the request.
 * @returns {Promise<Object>} Items result with items and pagination metadata.
 */
async function fetchPosts(querySettings, signal) {
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
			// wp/v2 registers taxonomy filters under the taxonomy REST base
			// ("categories", "tags"), not the slug.
			const taxonomyRestBase = await resolveTaxonomyRestBase(mc4e_taxonomy);
			params.append(taxonomyRestBase, termIds.join(','));
		}
	}

	if (mc4e_sticky) params.append('sticky', 'true');

	params.append('_embed', 'wp:featuredmedia,wp:term,author');

	const postType = mc4e_post_type || 'post';
	const restBase = await resolvePostTypeRestBase(postType);
	const endpoint = `${getRestRoot()}wp/v2/${encodeURIComponent(restBase)}?${params.toString()}`;
	const response = await fetch(endpoint, { signal });

	if (!response.ok) {
		throw new Error(`WordPress REST API error: ${response.status}`);
	}

	const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
	const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);

	const data = await response.json();

	const items = data.map((item) => {
		const featured = item?._embedded?.['wp:featuredmedia']?.[0] || null;
		const terms = (item?._embedded?.['wp:term'] || []).flat();
		const authorObj = item?._embedded?.author?.[0] || null;

		return {
			id: item.id,
			name: Sanitizer(item?.title?.rendered || ''),
			shortDescription: Sanitizer(item?.excerpt?.rendered || ''),
			permalink: item?.link || '#',
			terms,
			author: authorObj
				? { name: authorObj?.name || '', link: authorObj?.link || '' }
				: null,
			date: item?.date || '',
			modified: item?.modified || '',
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
 * Prepare items data with layout item assignments.
 *
 * Assigns each items to a layout item ID (item-0, item-1, etc.)
 * following the mosaic-posttypeitem-layouts pattern where layout items
 * are the primary structure and items are mapped to them.
 *
 * @param {Array} items - Array of fetched items
 * @param {Array} layoutItems - Layout items from Mobile breakpoint (source of truth)
 * @returns {Array} Items with 'i' property matching layout item IDs
 */
function prepareItemData(items, layoutItems) {
	return layoutItems.map((layoutItem, index) => {
		const item = items[index] || null;
		if (item) {
			return { ...item, i: layoutItem.i };
		}
		return { i: layoutItem.i, empty: true };
	});
}

/**
 * Content Layout Widget Component.
 *
 * Renders post type items in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, items are assigned to them.
 * Pattern follows mosaic-posttypeitem-layouts: map over layout items, find matching item.
 *
 * @param {Object} props
 * @param {Object} props.widgetData - Settings from Elementor controls.
 * @param {string} props.widgetId - Unique widget instance ID.
 * @param {string} props.mode - 'display' (frontend) or 'edit' (editor).
 */
const ContentLayoutWidget = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {

	// Determine if we're in edit mode (from prop, not runtime detection)
	// `__MC4E_EDITOR__` is a build-time constant (false in the frontend bundle),
	// so every `isEditMode &&` guard below folds away at build time and the
	// editor-only component tree it gates — ItemControls, ZIndexControls,
	// GridHelper — never reaches a published page.
	const isEditMode = __MC4E_EDITOR__ && mode === 'edit';

	const abortControllerRef = useRef(null);
	const debounceTimeoutRef = useRef(null);

	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 1 });

	// Debounced page change to prevent rapid API calls
	const debouncedSetCurrentPage = useCallback((page) => {
		if (debounceTimeoutRef.current) {
			clearTimeout(debounceTimeoutRef.current);
		}
		debounceTimeoutRef.current = setTimeout(() => setCurrentPage(page), 100);
	}, []);

	// Generate CSS custom properties from responsive settings
	const cssVariables = useCssVariables(widgetData);

	// Map flex justify-content alignment values → text-align equivalents for .item-elements.
	// flex-start → left, flex-end → right, center → center.
	const alignTextVars = useMemo(() => {
		return getBreakpointTextAlignVars(widgetData?.mc4e_item_align, '--mc4e-posttypeitem-align-text-');
	}, [widgetData?.mc4e_item_align]);

	// ── Settings extraction ──────────────────────────────────────────
	const layoutId = widgetData?.mc4e_layout || 'default';
	const customLayoutData = widgetData?.mc4e_custom_layout || '';
	const contentLayoutVariant = widgetData?.mc4e_item_layout || 'vertical';
	const featuredImageSize = widgetData?.mc4e_image_resolution || 'automatic';
	const featuredImagePosition = widgetData?.mc4e_featured_image_position || { x: 50, y: 50 };
	const featuredImageFit = widgetData?.mc4e_image_fit || 'cover';
	const excerptTruncate = widgetData?.mc4e_excerpt_truncate ?? true;
	const helperType = widgetData?.mc4e_helper_grid || 'none';
	const enablePagination = widgetData?.mc4e_enable_pagination || false;
	const selectedTerms = widgetData?.mc4e_terms || [];
	const selectedPostType = widgetData?.mc4e_post_type || 'post';
	const customButtonClassName = widgetData?.mc4e_custom_button_class || '';
	// Author / date / terms-taxonomy display options.
	const authorPrefix = widgetData?.mc4e_author_prefix ?? 'By ';
	const authorLink = widgetData?.mc4e_author_link || false;
	const dateType = widgetData?.mc4e_date_type || 'published';
	const dateFormat = widgetData?.mc4e_date_format || 'long';
	const termsTaxonomy = widgetData?.mc4e_terms_taxonomy || '';

	// Element ordering from repeater control. The fallback list mirrors the
	// PHP defaults in register_controls() (order and labels) so an empty
	// setting renders identically to a materialized one.
	const elementOrdering = useMemo(
		() => parseElementOrdering(widgetData?.mc4e_element_ordering, [
			{ element_label: 'Terms', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Title', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Excerpt', visible_desktop: 'no', visible_tablet: 'no', visible_mobile: 'no' },
			{ element_label: 'Featured Image', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Read More', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Post Author', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Post Date', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
		]),
		[widgetData?.mc4e_element_ordering]
	);

	// The featured image renders as a structural flex child of .item-wrapper
	// (its position is set by the layout variant), so it sits outside the
	// element-order map below. Pull its visibility classes from the ordering
	// list so its per-breakpoint visibility switchers still apply.
	const featuredImage = useMemo(
		() => elementOrdering.find((el) => el.key === 'featured_image'),
		[elementOrdering]
	);
	const featuredImageHideClasses = featuredImage?.hideClasses || '';

	// Hiding the image only removes it from the flow; the sibling .flex-wrapper
	// keeps the flex-basis the image-size control gave it and leaves a gap. These
	// companion classes let the injected breakpoint stylesheet reclaim the space
	// at exactly the breakpoints where the image is hidden.
	const flexWrapperHideImageClasses = useMemo(
		() => (featuredImage?.hiddenBreakpoints || [])
			.map((bp) => `mosaic-hide-${bp}-image`)
			.join(' '),
		[featuredImage]
	);

	// Grid settings from Elementor controls
	const gridSettings = useGridSettings(widgetData, 'mc4e_items_margin', 'mc4e_row_height');
	// Track Elementor's device mode switcher for the grid helper column calculation.
	const deviceType = useElementorDevice();

	// ── Layout data ──────────────────────────────────────────────────
	// Layout is the source of truth for grid structure. On the frontend PHP has
	// already resolved it into mc4e_resolved_layout; in the editor it is derived
	// from the custom layout or the selected preset. See resolveLayoutData().
	const layoutData = useMemo(
		() => resolveLayoutData(widgetData),
		[widgetData?.mc4e_resolved_layout, layoutId, customLayoutData]
	);

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


	// Visible layout: temporarily hide slots that have no matching items.
	// The full layoutData is preserved and hidden items are restored automatically
	// when the query returns more results.
	const visibleLayoutData = useMemo(
		() => getVisibleLayout(layoutData, items.length),
		[layoutData, items.length]
	);

	// Prepare items data with layout item assignments
	// Maps items to visible layout items: { ...item, i: 'item-0' }
	const itemsData = useMemo(() => {
		return prepareItemData(items, visibleLayoutData.mobile);
	}, [items, visibleLayoutData.mobile]);

	useEffect(() => {
		const loadItems = async () => {
			// Abort previous request
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			// Create new abort controller
			abortControllerRef.current = new AbortController();
			const signal = abortControllerRef.current.signal;

			// Create cache key from query settings
			const cacheKey = JSON.stringify(querySettings);

			setError(null);

			await loadCachedData({
				cache: postTypesCache,
				cacheKey,
				fetcher: () => fetchPosts(querySettings, signal),
				onCacheHit: (cachedData) => {
					if (Array.isArray(cachedData)) {
						// Backward-compatibility for old cache shape.
						setItems(cachedData);
						setPaginationMeta({ total: cachedData.length, totalPages: 1 });
						return;
					}

					setItems(cachedData.items || []);
					setPaginationMeta({
						total: cachedData.total || 0,
						totalPages: cachedData.totalPages || 1,
					});
				},
				onSuccess: (result) => {
					setItems(result.items || []);
					setPaginationMeta({ total: result.total || 0, totalPages: result.totalPages || 1 });
				},
				onError: (err) => {
					if (err.name === 'AbortError') {
						// Request was aborted, ignore
						return;
					}
					console.error('Error fetching content:', err);
					setError('Failed to fetch content.Please try again later.');
					setPaginationMeta({ total: 0, totalPages: 1 });
				},
				setIsLoading,
				setIsFetching,
				hasExistingData: items.length > 0,
			});
		};

		loadItems();

		// Cleanup: abort on unmount or dependency change
		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [querySettings]);

	// Layout mutation handlers. All four exist only to write back to the Elementor
	// model, so they are unreachable on a published page. Guarding the bodies with
	// __MC4E_EDITOR__ lets Rollup drop layoutEditing.js (and its addItem.js /
	// elementor-utils.js dependencies) from the frontend bundle entirely.
	// Enforced by scripts/check-bundles.mjs.

	// Handle layout changes in editor (drag/resize)
	const handleLayoutChange = (newLayouts) => {
		if (!__MC4E_EDITOR__) {
			return;
		}
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
		if (!__MC4E_EDITOR__) {
			return;
		}
		selectElementorWidget({ isEditMode, widgetId, widgetClass: 'content-layout' });
	};

	// Handle adding a new grid item (editor only)
	const handleAddItem = () => {
		if (!__MC4E_EDITOR__) {
			return;
		}
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
		if (!__MC4E_EDITOR__) {
			return;
		}
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

	if (items.length === 0) {
		return (
			<div className="content-layout">
				<p className="content-layout-empty">No content found.</p>
			</div>
		);
	}

	// Button classes following WooCommerce's pattern
	const buttonClasses = [
		'wp-block-button__link',
		'wp-element-button',
		'wc-block-components-posttypeitem-button__button',
		customButtonClassName,
	].filter(Boolean).join(' ');

	return (
		<>
			<div
				className="content-layout mosaic-content-layouts-widgets mosaic-content-layouts"
				data-widget-id={widgetId}
				style={{ ...cssVariables, ...alignTextVars }}
			>

				{isFetching && (
					<p className="layout-loading">Fetching content...</p>
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
					{/* Map over visible layout items only — items without a matching items are hidden */}
					{visibleLayoutData.mobile.map((layoutItem) => {
						const matchedPost = itemsData.find((p) => p.i === layoutItem.i);
						const zIndex = layoutData.zindex?.[layoutItem.i] || 0;

						// Skip empty items (no items assigned)
						if (!matchedPost || matchedPost.empty) {
							return (
								<div
									key={layoutItem.i}
									className="posttypeitem-item posttypeitem-item--empty"
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
								className="posttypeitem-item"
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

									{ /* If no featured image, skip */}
									{matchedPost.images.length > 0 && (
										<figure className={`featured-image posttypeitem-featured-image gradient-preloader${featuredImageHideClasses ? ` ${featuredImageHideClasses}` : ''}`}>
											<FeaturedImage
												postId={matchedPost.id}
												postType={selectedPostType}
												name={matchedPost.name}
												images={matchedPost.images}
												featuredImageSize={featuredImageSize}
												style={{
													'object-position': `${featuredImagePosition.x}% ${featuredImagePosition.y}%`,
													'object-fit': featuredImageFit,
												}}
											/>
										</figure>
									)}


									<div
										className={`flex-wrapper${flexWrapperHideImageClasses ? ` ${flexWrapperHideImageClasses}` : ''}`}
										style={{ ...!matchedPost.images.length && { flexBasis: "100%" } }}
									>
										<div className="item-elements">

											{elementOrdering.map((el) => {
												const elClasses = el.hideClasses ? ` ${el.hideClasses}` : '';
												switch (el.key) {
													case 'title':
														return (
															<h3 key={el.key} className={`name${elClasses}`}>
																<a href={matchedPost.permalink}>{decode(matchedPost.name)}</a>
															</h3>
														);
													case 'excerpt':
														return matchedPost.shortDescription ? (
															<div
																key={el.key}
																className={`excerpt${elClasses} ${excerptTruncate ? 'truncated' : ''}`}
																dangerouslySetInnerHTML={{ __html: Sanitizer(matchedPost.shortDescription) }}
															/>
														) : null;
													case 'read_more':
														return (
															<div
																key={el.key}
																className={`read-more-wrapper${elClasses}`}
															>
																<a className={`read-more-link ${buttonClasses}`} href={matchedPost.permalink}>
																	Read More
																</a>
															</div>
														);
													case 'post_author': {
														if (!matchedPost.author?.name) return null;
														const authorName = decode(matchedPost.author.name);
														return (
															<div key={el.key} className={`post-author${elClasses}`}>
																{authorPrefix && <span className="author-prefix">
																	{`${authorPrefix} `}
																</span>}
																{authorLink && matchedPost.author.link ? (
																	<a href={matchedPost.author.link} className="author-link">{authorName}</a>
																) : (
																	<span className="author-name">{authorName}</span>
																)}
															</div>
														);
													}
													case 'post_date': {
														const iso = dateType === 'modified' ? matchedPost.modified : matchedPost.date;
														const formatted = formatPostDate(iso, dateFormat);
														return formatted ? (
															<div key={el.key} className={`post-date${elClasses}`}>{formatted}</div>
														) : null;
													}
													case 'terms': {
														const visibleTerms = termsTaxonomy
															? (matchedPost.terms || []).filter((t) => t.taxonomy === termsTaxonomy)
															: (matchedPost.terms || []);
														return visibleTerms.length > 0 ? (
															<div key={el.key} className={`taxonomy terms${elClasses}`}>
																{visibleTerms.flatMap((term, index) => [
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
					onPageChange={debouncedSetCurrentPage}
				/>
			)}
		</>
	);
};

export default memo(ContentLayoutWidget);
