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
import ZIndexControls from '../../shared/components/ZIndexControls.jsx';

// Utilities and data.
import { decode } from '../../shared/utils/generalUtils.js';
import { updateElementorSetting } from '../../core/elementor-utils';
import { addItemToLayout, removeItemFromLayout } from '../../shared/utils/addItem.js';
import { getLayout } from '../../shared/utils/layoutUtils.js';
import { LRUCache, createCache } from '../../shared/utils/LRUCache.js';
import { useCssVariables, useGridSettings } from '../../shared/utils/hooks.js';

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

	// Convert snake_case keys to camelCase
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
 * Category Image Component.
 *
 * Renders category thumbnail from Store API data.
 *
 * @param {Object} props
 * @param {string} props.name - Category name (for alt text)
 * @param {Object|null} props.image - Image object from Store API { src, thumbnail }
 * @param {Object} props.style - CSS styles for img element
 */
const CategoryImage = ({ name, image, style = {} }) => {
	const placeholderImg = window.MPL4E?.placeholderImg || '';

	if (!image || !image.src) {
		return (
			<img
				src={placeholderImg}
				alt={name || 'Category'}
				loading="lazy"
				style={style}
			/>
		);
	}

	return (
		<img
			src={image.thumbnail || image.src}
			alt={name || 'Category'}
			loading="lazy"
			style={style}
		/>
	);
};

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

	/**
	 * Generate CSS custom properties from responsive settings
	 */
	const cssVariables = useCssVariables(widgetData);

	// Extract settings with defaults
	const layoutId = widgetData?.mpl4e_cat_layout || 'layout-1';
	const customLayoutData = widgetData?.mpl4e_cat_custom_layout || '';
	const cardLayout = widgetData?.mpl4e_cat_card_layout || 'vertical';
	const showCount = widgetData?.mpl4e_cat_show_count ?? true;
	const showDescription = widgetData?.mpl4e_cat_show_description ?? false;
	const imageFit = widgetData?.mpl4e_cat_image_fit || 'cover';
	const imagePosition = widgetData?.mpl4e_cat_image_position || { x: 50, y: 50 };

	// Grid settings
	const gridSettings = useGridSettings(widgetData, 'mpl4e_cat_items_margin', 'mpl4e_cat_row_height');

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

	// Prepare categories data with layout item assignments
	const categoriesData = useMemo(() => {
		return prepareCategoriesData(categories, layoutData.mobile);
	}, [categories, layoutData.mobile]);

	// Fetch categories
	useEffect(() => {
		const loadCategories = async () => {
			const cacheKey = JSON.stringify(querySettings);

			const cachedData = categoriesCache instanceof LRUCache
				? categoriesCache.get(cacheKey)
				: categoriesCache[cacheKey];

			if (cachedData) {
				setCategories(cachedData);
				setIsLoading(false);
				setIsFetching(false);
				setError(null);
				return;
			}

			try {
				if (categories.length === 0) {
					setIsLoading(true);
				} else {
					setIsFetching(true);
				}
				setError(null);

				const data = await fetchCategories(querySettings);

				if (categoriesCache instanceof LRUCache) {
					categoriesCache.set(cacheKey, data);
				} else {
					categoriesCache[cacheKey] = data;
				}

				setCategories(data);
			} catch (err) {
				console.error('Error fetching categories:', err);
				setError('Failed to fetch categories. Please try again later.');
			} finally {
				setIsLoading(false);
				setIsFetching(false);
			}
		};

		loadCategories();
	}, [querySettings]);

	// Handle layout changes in editor (drag/resize)
	const handleLayoutChange = (newLayouts) => {
		if (typeof elementor === 'undefined' || !widgetId) return;

		let existingCustomLayout = {};
		if (customLayoutData) {
			try {
				existingCustomLayout = JSON.parse(customLayoutData);
			} catch (error) {
				console.error('Failed to parse existing custom layout:', error);
			}
		}

		const customLayout = {
			desktop: newLayouts.desktop || existingCustomLayout.desktop || layoutData.desktop,
			tablet: newLayouts.tablet || existingCustomLayout.tablet || layoutData.tablet,
			mobile: newLayouts.mobile || existingCustomLayout.mobile || layoutData.mobile,
			zindex: existingCustomLayout.zindex || layoutData.zindex || {}
		};

		updateElementorSetting('categories-layout', widgetId, 'mpl4e_cat_custom_layout', JSON.stringify(customLayout));
	};

	const selectWidget = () => {
		if (!isEditMode || !widgetId) return;

		try {
			const $widgetEl = jQuery(
				`.categories-layout[data-widget-id="${widgetId}"]`
			).closest('[data-id]');

			if ($widgetEl && $widgetEl.length) {
				$widgetEl.trigger('click');
			}
		} catch (err) {
			console.error('Error selecting widget:', err);
		}
	};

	const handleAddItem = () => {
		if (!isEditMode || !widgetId) return;

		const gridColumns = {
			desktop: gridSettings.columns.desktop,
			tablet: gridSettings.columns.tablet,
			mobile: gridSettings.columns.mobile
		};

		const currentLayout = customLayoutData || JSON.stringify(layoutData);
		const { newLayoutJson } = addItemToLayout(currentLayout, gridColumns);
		updateElementorSetting('categories-layout', widgetId, 'mpl4e_cat_custom_layout', newLayoutJson);
	};

	const handleRemoveItem = (itemId) => {
		if (!isEditMode || !widgetId) return;

		if (layoutData.mobile.length <= 1) {
			return;
		}

		const currentLayout = customLayoutData || JSON.stringify(layoutData);
		const newLayoutJson = removeItemFromLayout(currentLayout, itemId);
		updateElementorSetting('categories-layout', widgetId, 'mpl4e_cat_custom_layout', newLayoutJson);
	};

	if (isLoading) {
		return (
			<div className="categories-layout">
				<p className="categories-layout-loading">Loading categories...</p>
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
			className="categories-layout mosaic-categories-layout micemade-widgets"
			data-widget-id={widgetId}
			style={cssVariables}
		>
			{isFetching && (
				<p className="categories-layout-loading">Fetching categories...</p>
			)}
			<GridLayout
				layouts={layoutData}
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
				{layoutData.mobile.map((layoutItem) => {
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
									<div className="mpl4e-item-controls">
										<ZIndexControls
											itemId={layoutItem.i}
											layoutData={layoutData}
											customLayoutData={customLayoutData}
											widgetType="categories-layout"
											widgetId={widgetId}
											settingKey="mpl4e_cat_custom_layout"
											updateFn={updateElementorSetting}
										/>
										{layoutData.mobile.length > 1 && (
											<button
												type="button"
												className="mpl4e-remove-item-btn"
												onMouseDownCapture={(e) => {
													e.stopPropagation();
													handleRemoveItem(layoutItem.i);
												}}
												title="Remove Layout Item"
											>
												<i className="eicon-close" aria-hidden="true" />
											</button>
										)}
									</div>
								)}
								<div className="category-wrapper empty">
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
								<div className="mpl4e-item-controls">
									<ZIndexControls
										itemId={layoutItem.i}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetType="categories-layout"
										widgetId={widgetId}
										settingKey="mpl4e_cat_custom_layout"
										updateFn={updateElementorSetting}
									/>
									{layoutData.mobile.length > 1 && (
										<button
											type="button"
											className="mpl4e-remove-item-btn"
											onMouseDownCapture={(e) => {
												e.stopPropagation();
												handleRemoveItem(layoutItem.i);
											}}
											title="Remove Layout Item"
										>
											<i className="eicon-close" aria-hidden="true" />
										</button>
									)}
								</div>
							)}

							<div className={`category-wrapper ${cardLayout}`}>
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
										<h3 className="name">
											<a href={matchedCategory.permalink}>
												{decode(matchedCategory.name)}
											</a>
										</h3>

										{showCount && matchedCategory.count !== undefined && (
											<span className="cat-count">
												{matchedCategory.count} {matchedCategory.count === 1 ? 'product' : 'products'}
											</span>
										)}

										{showDescription && matchedCategory.description && (
											<div
												className="cat-description"
												dangerouslySetInnerHTML={{ __html: Sanitizer(matchedCategory.description) }}
											/>
										)}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</GridLayout>

			{isEditMode && (
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
			)}
		</div>
	);
};

export default CategoriesLayoutWidget;
