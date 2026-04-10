/**
 * Categories Layout Widget Component.
 *
 * Renders WooCommerce product categories in a responsive grid using react-grid-layout.
 * Layout items are the primary structure, categories are assigned to them.
 * Uses WC Store API /wc/store/v1/products/categories endpoint (public, no auth required).
 *
 * @module CategoriesLayoutWidget
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
import ItemControls from '../../shared/components/ItemControls.jsx';
import GridHelper from '../../shared/components/GridHelper.jsx';
import CategoryImage from './CategoryImage.jsx';

// Utilities and data.
import { decode } from '../../shared/utils/generalUtils.js';
import { parseElementOrdering } from '../../shared/utils/elementOrdering.js';
import { mapKeysToCamelCase } from '../../shared/utils/transformationUtils.js';
import { getBreakpointTextAlignVars } from '../../shared/utils/alignmentUtils.js';
import { applyLayoutChange, selectElementorWidget, addGridItem, removeGridItem } from '../../shared/utils/layoutEditing.js';
import { getLayout } from '../../shared/utils/layoutUtils.js';
import { createCache, getCacheEntry, setCacheEntry } from '../../shared/utils/LRUCache.js';
import { loadCachedData } from '../../shared/utils/dataLoading.js';
import { useCssVariables, useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';
import { getVisibleLayout } from '../../shared/utils/visibleLayout.js';
import CategoryImageModal from './CategoryImageModal.jsx';

import './categories-layout.scss';

const Sanitizer = DOMPurify.sanitize;

// Cache: LRU in editor, plain object on frontend.
const categoriesCache = createCache();

/**
 * Fetch product categories from WooCommerce Store API.
 *
 * Uses /wc/store/v1/products/categories endpoint (public, no auth required).
 *
 * @param {Object} querySettings - Query parameters from Elementor controls.
 * @returns {Promise<Array>} Array of category objects.
 */
async function fetchCategories(querySettings) {
	const {
		mpl4e_cat_per_page,
		mpl4e_cat_orderby,
		mpl4e_cat_order,
		mpl4e_cat_hide_empty,
		mpl4e_cat_parent,
		mpl4e_cat_include,
	} = querySettings;

	const params = new URLSearchParams();

	// When include is specified, it takes priority — fetch only those categories.
	const includeIds = Array.isArray(mpl4e_cat_include) && mpl4e_cat_include.length > 0
		? mpl4e_cat_include
		: null;

	if (includeIds) {
		params.append('include', includeIds.join(','));
		// per_page should accommodate all included IDs
		params.append('per_page', Math.max(includeIds.length, mpl4e_cat_per_page || 10));
	} else {
		if (mpl4e_cat_per_page) params.append('per_page', mpl4e_cat_per_page);
	}

	if (mpl4e_cat_orderby) params.append('orderby', mpl4e_cat_orderby);
	if (mpl4e_cat_order) params.append('order', mpl4e_cat_order);
	if (mpl4e_cat_hide_empty) params.append('hide_empty', 'true');
	if (!includeIds && mpl4e_cat_parent) params.append('parent', mpl4e_cat_parent);

	const response = await fetch(`/wp-json/wc/store/v1/products/categories?${params.toString()}`);

	if (!response.ok) {
		throw new Error(`WC Store API error: ${response.status}`);
	}

	const data = await response.json();

	return data.map((item) => mapKeysToCamelCase(item));
}

/**
 * Prepare categories data with layout item assignments.
 *
 * @param {Array} categories - Array of fetched categories
 * @param {Array} layoutItems - Layout items from Mobile breakpoint (source of truth)
 * @returns {Array} Categories with 'i' property matching layout item IDs
 */
function prepareCategoriesData(categories, layoutItems) {
	return layoutItems.map((layoutItem, index) => {
		const category = categories[index] || null;
		if (category) {
			return { ...category, i: layoutItem.i };
		}
		return { i: layoutItem.i, empty: true };
	});
}

/**
 * Categories Layout Widget Component.
 *
 * @param {Object} props
 * @param {Object} props.widgetData - Settings from Elementor controls.
 * @param {string} props.widgetId - Unique widget instance ID.
 * @param {string} props.mode - 'display' (frontend) or 'edit' (editor).
 */
const CategoriesLayoutWidget = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {

	const isEditMode = mode === 'edit';

	const [categories, setCategories] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(false);
	const [error, setError] = useState(null);
	const [imageModalCategory, setImageModalCategory] = useState(null);

	/**
	 * Generate CSS custom properties from responsive settings
	 */
	const cssVariables = useCssVariables(widgetData);

	// Map flex justify-content alignment values → text-align equivalents for .category-elements.
	// flex-start → left, flex-end → right, center → center.
	const alignTextVars = useMemo(() => {
		return getBreakpointTextAlignVars(widgetData?.mpl4e_cat_align, '--mpl4e-cat-align-text-');
	}, [widgetData?.mpl4e_cat_align]);

	// Extract settings with defaults
	const layoutId = widgetData?.mpl4e_cat_layout || 'layout-1';
	const customLayoutData = widgetData?.mpl4e_cat_custom_layout || '';
	const cardLayout = widgetData?.mpl4e_cat_card_layout || 'vertical';
	const imageFit = widgetData?.mpl4e_cat_image_fit || 'cover';
	const imagePosition = widgetData?.mpl4e_cat_image_position || { x: 50, y: 50 };
	const helperType = widgetData?.mpl4e_helper_grid || 'none';


	// Element ordering from repeater control
	const elementOrdering = useMemo(
		() => parseElementOrdering(widgetData?.mpl4e_cat_element_ordering, [
			{ element_label: 'Title', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Count', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
			{ element_label: 'Description', visible_desktop: 'yes', visible_tablet: 'yes', visible_mobile: 'yes' },
		]),
		[widgetData?.mpl4e_cat_element_ordering]
	);

	// Grid settings
	const gridSettings = useGridSettings(widgetData, 'mpl4e_cat_items_margin', 'mpl4e_cat_row_height');
	// Track Elementor's device mode switcher for the grid helper column calculation.
	const deviceType = useElementorDevice();

	// Memoize query settings
	const querySettings = useMemo(
		() => ({
			mpl4e_cat_per_page: widgetData?.mpl4e_cat_per_page || 10,
			mpl4e_cat_orderby: widgetData?.mpl4e_cat_orderby || 'name',
			mpl4e_cat_order: widgetData?.mpl4e_cat_order || 'asc',
			mpl4e_cat_hide_empty: widgetData?.mpl4e_cat_hide_empty ?? true,
			mpl4e_cat_parent: widgetData?.mpl4e_cat_parent || '',
			mpl4e_cat_include: widgetData?.mpl4e_cat_include || [],
		}),
		[
			widgetData?.mpl4e_cat_per_page,
			widgetData?.mpl4e_cat_orderby,
			widgetData?.mpl4e_cat_order,
			widgetData?.mpl4e_cat_hide_empty,
			widgetData?.mpl4e_cat_parent,
			JSON.stringify(widgetData?.mpl4e_cat_include),
		]
	);

	// Get layout data
	const layoutData = useMemo(() => {
		if (customLayoutData) {
			try {
				return JSON.parse(customLayoutData);
			} catch (error) {
				console.error('Failed to parse custom layout:', error);
				return getLayout(layoutId, querySettings.mpl4e_cat_per_page);
			}
		}
		return getLayout(layoutId, querySettings.mpl4e_cat_per_page);
	}, [layoutId, customLayoutData, querySettings.mpl4e_cat_per_page]);

	// Visible layout: temporarily hide slots that have no matching category.
	// The full layoutData is preserved; hidden items are restored automatically
	// when the query returns more results.
	const visibleLayoutData = useMemo(
		() => getVisibleLayout(layoutData, categories.length),
		[layoutData, categories.length]
	);

	// Prepare categories data with layout item assignments
	const categoriesData = useMemo(() => {
		return prepareCategoriesData(categories, visibleLayoutData.mobile);
	}, [categories, visibleLayoutData.mobile]);

	// Fetch categories
	useEffect(() => {
		const loadCategories = async () => {
			const cacheKey = JSON.stringify(querySettings);

			setError(null);

			await loadCachedData({
				cache: categoriesCache,
				cacheKey,
				fetcher: () => fetchCategories(querySettings),
				onCacheHit: (cachedData) => {
					setCategories(cachedData);
				},
				onSuccess: (data) => {
					setCategories(data);
				},
				onError: (err) => {
					console.error('Error fetching categories:', err);
					setError('Failed to fetch categories. Please try again later.');
				},
				setIsLoading,
				setIsFetching,
				hasExistingData: categories.length > 0,
			});
		};

		loadCategories();
	}, [querySettings]);

	// Handle layout changes in editor (drag/resize)
	const handleLayoutChange = (newLayouts) => {
		applyLayoutChange({
			widgetType: 'categories-layout',
			widgetId,
			settingKey: 'mpl4e_cat_custom_layout',
			customLayoutData,
			layoutData,
			newLayouts,
		});
	};

	const selectWidget = () => {
		selectElementorWidget({ isEditMode, widgetId, widgetClass: 'categories-layout' });
	};

	const handleAddItem = () => {
		addGridItem({
			isEditMode,
			widgetType: 'categories-layout',
			widgetId,
			settingKey: 'mpl4e_cat_custom_layout',
			customLayoutData,
			layoutData,
			gridColumns: {
				desktop: gridSettings.columns.desktop,
				tablet: gridSettings.columns.tablet,
				mobile: gridSettings.columns.mobile,
			},
		});
	};

	const handleRemoveItem = (itemId) => {
		removeGridItem({
			isEditMode,
			widgetType: 'categories-layout',
			widgetId,
			settingKey: 'mpl4e_cat_custom_layout',
			customLayoutData,
			layoutData,
			itemId,
		});
	};

	const handleOpenImageModal = (category) => {
		if (!isEditMode || !category?.id) return;
		setImageModalCategory(category);
	};

	const handleImageSaved = (result) => {
		const categoryId = result?.id;
		if (!categoryId) {
			setImageModalCategory(null);
			return;
		}

		const nextImage = result?.image || null;
		setCategories((prev) => prev.map((category) => (
			category.id === categoryId
				? { ...category, image: nextImage }
				: category
		)));

		const cacheKey = JSON.stringify(querySettings);
		const cachedData = getCacheEntry(categoriesCache, cacheKey);
		if (Array.isArray(cachedData)) {
			setCacheEntry(
				categoriesCache,
				cacheKey,
				cachedData.map((category) => (
					category.id === categoryId
						? { ...category, image: nextImage }
						: category
				))
			);
		}

		setImageModalCategory(null);
	};

	if (isLoading) {
		return (
			<div className="categories-layout">
				<p className="layout-loading">Loading categories...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="categories-layout">
				<p className="categories-layout-error">{error}</p>
			</div>
		);
	}

	if (categories.length === 0) {
		return (
			<div className="categories-layout">
				<p className="categories-layout-empty">No categories found.</p>
			</div>
		);
	}

	return (
		<div
			className="categories-layout mosaic-product-layouts-widgets micemade-widgets"
			data-widget-id={widgetId}
			style={{ ...cssVariables, ...alignTextVars }}
		>
			{isFetching && (
				<p className="layout-loading">Fetching categories...</p>
			)}
			<GridLayout
			layouts={visibleLayoutData}
			columns={gridSettings.columns}
			itemsMargin={gridSettings.itemsMargin}
			rowHeight={gridSettings.rowHeight}
			allowOverlap={widgetData?.mpl4e_cat_allow_overlap || false}
			compactionType={widgetData?.mpl4e_cat_compaction_type || 'vertical'}
			context={isEditMode ? 'edit' : 'frontend'}
			isDraggable={isEditMode}
			isResizable={isEditMode}
			onLayoutChange={isEditMode ? handleLayoutChange : undefined}
			selectWidget={selectWidget}
				draggableCancel=".mpl4e-item-controls"
		>
			{/* Map over visible layout items only — items without a matching category are hidden */}
			{visibleLayoutData.mobile.map((layoutItem) => {
					const matchedCategory = categoriesData.find((c) => c.i === layoutItem.i);
					const zIndex = layoutData.zindex?.[layoutItem.i] || 0;

					if (!matchedCategory || matchedCategory.empty) {
						return (
							<div
								key={layoutItem.i}
								className="category-item category-item--empty"
							>
								{/* Editor-only item controls */}
								{isEditMode && (
									<ItemControls
										settingKey={`mpl4e_cat_custom_layout`}
										itemId={layoutItem.i}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetId={widgetId}
										widgetType='categories-layout'
										onRemove={handleRemoveItem}
									/>
								)}
								<div className="item-wrapper empty">
									<p>No category</p>
								</div>
							</div>
						);
					}

					return (
						<div
							key={layoutItem.i}
							className="category-item"
							style={{ zIndex }}
						>
							{/* Editor-only item controls */}
							{isEditMode && (
								<ItemControls
									settingKey={`mpl4e_cat_custom_layout`}
									itemId={layoutItem.i}
									layoutData={layoutData}
									customLayoutData={customLayoutData}
									widgetId={widgetId}
									widgetType='categories-layout'
									onManage={() => handleOpenImageModal(matchedCategory)}
									manageTitle="Manage category image"
									onRemove={handleRemoveItem}
								/>
							)}

							<div className={`item-wrapper ${cardLayout}`}>
								<figure className="category-image gradient-preloader">
									<CategoryImage
										name={matchedCategory.name}
										image={matchedCategory.image}
										style={{
											'objectPosition': `${imagePosition.x}% ${imagePosition.y}%`,
											'objectFit': imageFit,
										}}
									/>
								</figure>

								<div className="flex-wrapper">
									<div className="category-info category-elements">

										{elementOrdering.map((el) => {
											const elClasses = el.hideClasses ? ` ${el.hideClasses}` : '';
											switch (el.key) {
												case 'title':
													return (
														<h3 key={el.key} className={`name${elClasses}`}>
															<a href={matchedCategory.permalink}>
																{decode(matchedCategory.name)}
															</a>
														</h3>
													);
												case 'count':
													return matchedCategory.count !== undefined ? (
														<span key={el.key} className={`cat-count${elClasses}`}>
															{matchedCategory.count} {matchedCategory.count === 1 ? 'product' : 'products'}
														</span>
													) : null;
												case 'description':
													return matchedCategory.description ? (
														<div
															key={el.key}
															className={`cat-description${elClasses}`}
															dangerouslySetInnerHTML={{ __html: Sanitizer(matchedCategory.description) }}
														/>
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

			<CategoryImageModal
				isOpen={Boolean(imageModalCategory)}
				category={imageModalCategory}
				onClose={() => setImageModalCategory(null)}
				onSaved={handleImageSaved}
			/>

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
	);
};

export default CategoriesLayoutWidget;
