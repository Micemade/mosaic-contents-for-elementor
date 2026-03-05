/**
 * Single Product Layout Widget Component.
 *
 * Displays a single WooCommerce product's elements (title, price, image,
 * excerpt, add to cart, rating, sale badge, categories, brands) arranged
 * in a draggable grid layout using react-grid-layout.
 *
 * Ported from the Mosaic Product Layouts Gutenberg "Single Product" block.
 *
 * @module SingleProductLayoutWidget
 */

/*
 * External dependencies.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';

/*
 * Internal dependencies.
 */
import GridLayout from '../../shared/components/GridLayout.jsx';
import ProductImage from '../../shared/components/ProductImage.jsx';
import RatingStars from '../../shared/components/RatingStars.jsx';
import AddToCartButton from '../../shared/components/AddToCartButton.jsx';
import ZIndexControls from '../../shared/components/ZIndexControls.jsx';

import { decode } from '../../shared/utils/generalUtils.js';
import { updateElementorSetting, openPanelSection } from '../../core/elementor-utils';
import { LRUCache, createCache } from '../../shared/utils/LRUCache.js';
import { useGridSettings } from '../../shared/utils/hooks.js';

import singleProductLayouts from './utils/single-product-layouts.json';
import './single-product-layout.scss';

const Sanitizer = DOMPurify.sanitize;

// Cache: LRU in editor, plain object on frontend.
const productCache = createCache();

// ── Element definitions ──────────────────────────────────────────────────
// Maps layout item IDs to product element types.
const ELEMENT_MAP = {
	'item-0': { id: 'title', name: 'Title', section: 'sp_title_style_section' },
	'item-1': { id: 'price', name: 'Price', section: 'sp_price_style_section' },
	'item-2': { id: 'addToCart', name: 'Add to Cart', section: 'sp_addtocart_style_section' },
	'item-3': { id: 'image', name: 'Image', section: 'sp_image_style_section' },
	'item-4': { id: 'excerpt', name: 'Excerpt', section: 'sp_excerpt_style_section' },
	'item-5': { id: 'saleBadge', name: 'Sale Badge', section: 'sp_sale_badge_style_section' },
	'item-6': { id: 'rating', name: 'Rating', section: 'sp_rating_style_section' },
	'item-7': { id: 'categories', name: 'Categories', section: 'sp_categories_style_section' },
	'item-8': { id: 'brands', name: 'Brands', section: 'sp_brands_style_section' },
};

// Derived map of element ID → Elementor Style tab section ID.
// Used by the "Edit element" button to jump directly to the relevant section.
const ELEMENT_SECTION_MAP = Object.fromEntries(
	Object.values(ELEMENT_MAP).map(({ id, section }) => [id, section])
);


// ── Layout helpers ──────────────────────────────────────────────────────
/**
 * Get layout data from predefined layouts or custom layout string.
 *
 * @param {string} layoutId - Layout identifier (e.g., 'default', 'layout-2').
 * @param {string} customLayoutData - JSON string of custom layout, if any.
 * @returns {Object} Layout object with desktop, tablet, mobile, zindex keys.
 */
const getLayout = (layoutId, customLayoutData) => {
	if (customLayoutData) {
		try {
			return JSON.parse(customLayoutData);
		} catch (e) {
			console.error('Failed to parse custom layout:', e);
		}
	}

	const layoutDef = singleProductLayouts.find((l) => l.id === layoutId);
	if (!layoutDef) {
		// Fallback to default.
		const fallback = singleProductLayouts[0];
		return {
			...JSON.parse(fallback.value),
			zindex: JSON.parse(fallback.zindex),
		};
	}

	return {
		...JSON.parse(layoutDef.value),
		zindex: JSON.parse(layoutDef.zindex),
	};
};

// ── API fetch ───────────────────────────────────────────────────────────
/**
 * Fetch a single product from WooCommerce Store API.
 *
 * @param {number|string} productId - WooCommerce product ID.
 * @returns {Promise<Object>} Product data with camelCase keys.
 */
async function fetchProduct(productId) {
	if (!productId) {
		return null;
	}

	const params = new URLSearchParams();
	params.append(
		'_fields',
		'id,name,short_description,price_html,images,permalink,add_to_cart,type,average_rating,review_count,on_sale,categories,brands'
	);

	const response = await fetch(
		`/wp-json/wc/store/v1/products/${productId}?${params.toString()}`
	);

	if (!response.ok) {
		throw new Error(`WC Store API error: ${response.status}`);
	}

	const item = await response.json();

	// Convert snake_case to camelCase.
	return Object.keys(item).reduce((acc, key) => {
		const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) =>
			letter.toUpperCase()
		);
		acc[camelCaseKey] = item[key];
		return acc;
	}, {});
}

// ── Component ───────────────────────────────────────────────────────────

/**
 * Single Product Layout Widget Component.
 *
 * @param {Object} props
 * @param {Object} props.widgetData - Settings from Elementor controls.
 * @param {string} props.widgetId - Unique widget instance ID.
 * @param {string} props.mode - 'display' (frontend) or 'edit' (editor).
 */
const SingleProductLayoutWidget = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {

	const isEditMode = mode === 'edit';

	const [product, setProduct] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	// Track whether we currently have product data displayed.
	// Used to avoid blanking the widget while switching products.
	const hasProductRef = useRef(false);

	const [isElementsDropdownOpen, setIsElementsDropdownOpen] = useState(false);
	const dropdownRef = useRef(null);

	// ── Settings extraction ──────────────────────────────────────────
	const productId = widgetData?.mpl4e_sp_product_id || '';
	const layoutId = widgetData?.mpl4e_sp_layout || 'default';
	const customLayoutData = widgetData?.mpl4e_sp_custom_layout || '';
	const featuredImageSize = widgetData?.mpl4e_sp_featured_image_size || 'automatic';
	const imagePosition = widgetData?.mpl4e_sp_image_position || { x: 50, y: 50 };
	const imageFit = widgetData?.mpl4e_sp_image_fit || 'cover';
	const excerptTruncate = widgetData?.mpl4e_sp_excerpt_truncate ?? true;
	const outlineLabels = widgetData?.mpl4e_sp_helper_outline_labels || 'none';

	// Grid settings using shared hook (columns differ from products widget).
	const gridSettings = useGridSettings(widgetData, 'mpl4e_sp_items_margin', 'mpl4e_sp_row_height');
	// Override columns for single product (higher precision like the Gutenberg block).
	const columns = useMemo(() => ({
		desktop: 56,
		tablet: 48,
		mobile: 36,
	}), []);

	// ── Layout data ──────────────────────────────────────────────────
	const layoutData = useMemo(
		() => getLayout(layoutId, customLayoutData),
		[layoutId, customLayoutData]
	);

	const hiddenItems = useMemo(() => new Set(layoutData.hidden || []), [layoutData.hidden]);
	const visibleLayoutData = useMemo(() => {
		if (!hiddenItems.size) return layoutData;
		const filter = (items) => (items || []).filter((item) => !hiddenItems.has(item.i));
		return {
			desktop: filter(layoutData.desktop),
			tablet: filter(layoutData.tablet),
			mobile: filter(layoutData.mobile),
			zindex: layoutData.zindex || {},
		};
	}, [layoutData, hiddenItems]);

	// ── Fetch product data ───────────────────────────────────────────
	useEffect(() => {
		if (!productId) {
			setIsLoading(false);
			setProduct(null);
			hasProductRef.current = false;
			return;
		}

		const loadProduct = async () => {
			const cacheKey = `sp_${productId}`;

			// Check cache first — swap instantly, no loading flash.
			const cachedData = productCache instanceof LRUCache
				? productCache.get(cacheKey)
				: productCache[cacheKey];

			if (cachedData) {
				setProduct(cachedData);
				setIsLoading(false);
				setError(null);
				hasProductRef.current = true;
				return;
			}

			try {
				// Only show the loading spinner when there is no product
				// currently displayed (initial load). When switching between
				// products the previous product stays visible until the new
				// one arrives, preventing a full widget blank/reload.
				if (!hasProductRef.current) {
					setIsLoading(true);
				}
				setError(null);
				const data = await fetchProduct(productId);

				if (productCache instanceof LRUCache) {
					productCache.set(cacheKey, data);
				} else {
					productCache[cacheKey] = data;
				}

				setProduct(data);
				hasProductRef.current = true;
			} catch (err) {
				console.error('Error fetching product:', err);
				setError('Failed to fetch product. Please try again later.');
			} finally {
				setIsLoading(false);
			}
		};

		loadProduct();
	}, [productId]);

	// ── Close dropdown on outside click ────────────────────────────
	useEffect(() => {
		if (!isElementsDropdownOpen) return;
		const handleClickOutside = (e) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
				setIsElementsDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isElementsDropdownOpen]);

	const handleToggleElement = (itemId) => {
		if (!isEditMode || !widgetId) return;
		const currentHidden = layoutData.hidden ? [...layoutData.hidden] : [];
		const isNowHidden = !currentHidden.includes(itemId);
		const newHidden = isNowHidden
			? [...currentHidden, itemId]
			: currentHidden.filter((id) => id !== itemId);
		let existingCustomLayout = {};
		if (customLayoutData) {
			try { existingCustomLayout = JSON.parse(customLayoutData); } catch (e) { /* noop */ }
		}

		// Ensure all 9 items have position data. If an item is missing from the
		// saved layout (e.g. lost in an older save or imported setup), fall back
		// to its default position so it can reappear correctly when un-hidden.
		const defaultLayoutData = getLayout(layoutId, null);
		const ensureAllItems = (savedArr, defaultArr) => {
			const savedIds = new Set((savedArr || []).map((item) => item.i));
			const missing = (defaultArr || []).filter((item) => !savedIds.has(item.i));
			return [...(savedArr || []), ...missing];
		};

		const fullDesktop = ensureAllItems(existingCustomLayout.desktop || layoutData.desktop, defaultLayoutData.desktop);
		const fullTablet = ensureAllItems(existingCustomLayout.tablet || layoutData.tablet, defaultLayoutData.tablet);
		const fullMobile = ensureAllItems(existingCustomLayout.mobile || layoutData.mobile, defaultLayoutData.mobile);

		updateElementorSetting(
			'single-product-layout',
			widgetId,
			'mpl4e_sp_custom_layout',
			JSON.stringify({
				desktop: fullDesktop,
				tablet: fullTablet,
				mobile: fullMobile,
				zindex: existingCustomLayout.zindex || layoutData.zindex || {},
				hidden: newHidden,
			})
		);
	};

	// ── Layout change handler (editor only) ──────────────────────────
	const handleLayoutChange = (newLayouts) => {
		if (typeof elementor === 'undefined' || !widgetId) return;

		let existingCustomLayout = {};
		if (customLayoutData) {
			try {
				existingCustomLayout = JSON.parse(customLayoutData);
			} catch (e) {
				console.error('Failed to parse existing custom layout:', e);
			}
		}

		// RGL only returns positions for visible (rendered) items. Merge those
		// changes back into the FULL layout so hidden items retain their
		// last known position and can be restored later.
		const mergeIntoFull = (fullArr, changedArr) => {
			if (!changedArr?.length) return fullArr || [];
			const changedById = Object.fromEntries(changedArr.map((item) => [item.i, item]));
			return (fullArr || []).map((item) => changedById[item.i] || item);
		};

		const fullDesktop = existingCustomLayout.desktop || layoutData.desktop;
		const fullTablet = existingCustomLayout.tablet || layoutData.tablet;
		const fullMobile = existingCustomLayout.mobile || layoutData.mobile;

		const customLayout = {
			desktop: mergeIntoFull(fullDesktop, newLayouts.desktop),
			tablet: mergeIntoFull(fullTablet, newLayouts.tablet),
			mobile: mergeIntoFull(fullMobile, newLayouts.mobile),
			zindex: existingCustomLayout.zindex || layoutData.zindex || {},
			hidden: existingCustomLayout.hidden || layoutData.hidden || [],
		};

		updateElementorSetting(
			'single-product-layout',
			widgetId,
			'mpl4e_sp_custom_layout',
			JSON.stringify(customLayout)
		);
	};

	const selectWidget = () => {
		if (!isEditMode || !widgetId) return;
		try {
			const $widgetEl = jQuery(
				`.single-product-layout[data-widget-id="${widgetId}"]`
			).closest('[data-id]');
			if ($widgetEl?.length) {
				$widgetEl.trigger('click');
			}
		} catch (err) {
			console.error('Error selecting widget:', err);
		}
	};

	// ── Render states ────────────────────────────────────────────────
	if (!productId) {
		return (
			<div className="single-product-layout">
				<p className="single-product-layout-empty">
					{isEditMode
						? 'Select a product in the widget settings panel.'
						: 'No product selected.'}
				</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="single-product-layout">
				<p className="single-product-layout-loading">Loading product...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="single-product-layout">
				<p className="single-product-layout-error">{error}</p>
			</div>
		);
	}

	if (!product) {
		return (
			<div className="single-product-layout">
				<p className="single-product-layout-empty">Product not found.</p>
			</div>
		);
	}

	// ── Build grid items from layout ─────────────────────────────────
	// Use visible mobile layout as source of truth (hidden items excluded).
	return (
		<div
			className={`single-product-layout mosaic-single-product-layout micemade-widgets ${outlineLabels && isEditMode ? outlineLabels : ''}`}
			data-widget-id={widgetId}
		>
			<GridLayout
				layouts={visibleLayoutData}
				columns={columns}
				itemsMargin={gridSettings.itemsMargin}
				rowHeight={gridSettings.rowHeight}
				allowOverlap={widgetData?.mpl4e_sp_allow_overlap ?? true}
				compactionType={widgetData?.mpl4e_sp_compaction_type || 'none'}
				context={isEditMode ? 'edit' : 'frontend'}
				isDraggable={isEditMode}
				isResizable={isEditMode}
				onLayoutChange={isEditMode ? handleLayoutChange : undefined}
				selectWidget={selectWidget}
				draggableCancel=".mpl4e-item-controls"
			>
				{visibleLayoutData.mobile.map((layoutItem) => {
					const elementDef = ELEMENT_MAP[layoutItem.i];
					if (!elementDef) return null;

					const zIndex = layoutData.zindex?.[layoutItem.i] || 0;

					return (
						<div
							key={layoutItem.i}
							className={`sp-element ${elementDef.id}`}
							style={{ zIndex }}
							data-label={elementDef.name}
						>
							{renderElement(elementDef.id, product, {
								excerptTruncate,
								featuredImageSize,
								imagePosition,
								imageFit,
							})}
							{isEditMode && (
								<div className="mpl4e-item-controls">
									<ZIndexControls
										itemId={layoutItem.i}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetType="single-product-layout"
										widgetId={widgetId}
										settingKey="mpl4e_sp_custom_layout"
										updateFn={updateElementorSetting}
									/>
									{ELEMENT_SECTION_MAP[elementDef.id] && (
										<button
											className="sp-edit-element-btn"
											title={`Edit ${elementDef.name} style`}
											onMouseDownCapture={(e) => {
												e.stopPropagation();
												e.preventDefault();
												openPanelSection(ELEMENT_SECTION_MAP[elementDef.id]);
											}}
										>
											<i className="eicon-edit" />
										</button>
									)}
								</div>
							)}
						</div>
					);
				})}
			</GridLayout>

			{isEditMode && (
				<div className="mpl4e-editor-toolbar">
					<div className="mpl4e-elements-toggle-wrapper" ref={dropdownRef}>
						<button
							type="button"
							className="mpl4e-toolbar-btn mpl4e-elements-toggle-btn"
							onClick={() => setIsElementsDropdownOpen((prev) => !prev)}
							title="Toggle element visibility"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<line x1="8" y1="6" x2="21" y2="6" />
								<line x1="8" y1="12" x2="21" y2="12" />
								<line x1="8" y1="18" x2="21" y2="18" />
								<line x1="3" y1="6" x2="3.01" y2="6" />
								<line x1="3" y1="12" x2="3.01" y2="12" />
								<line x1="3" y1="18" x2="3.01" y2="18" />
							</svg>
							<span>Elements</span>
						</button>
						{isElementsDropdownOpen && (
							<div className="mpl4e-elements-dropdown">
								{Object.entries(ELEMENT_MAP).map(([itemId, elementDef]) => {
									const isHidden = hiddenItems.has(itemId);
									return (
										<label
											key={itemId}
											className={`mpl4e-element-toggle-item${isHidden ? ' is-hidden' : ''}`}
										>
											<input
												type="checkbox"
												checked={!isHidden}
												onChange={() => handleToggleElement(itemId)}
											/>
											<span>{elementDef.name}</span>
										</label>
									);
								})}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

// ── Element renderer ─────────────────────────────────────────────────────
/**
 * Render a product element by type.
 *
 * @param {string} elementId - Element type identifier.
 * @param {Object} product - Product data from Store API.
 * @param {Object} styles - Element style configs.
 * @returns {JSX.Element|null}
 */
function renderElement(elementId, product, styles) {
	const {
		excerptTruncate,
		featuredImageSize,
		imagePosition,
		imageFit,
	} = styles;

	switch (elementId) {
		case 'title':
			return (
				<header className="elements-wrapper">
					<h4 className="name">
						<a href={product.permalink}>{decode(product.name)}</a>
					</h4>
				</header>
			);

		case 'price':
			return (
				<div className="elements-wrapper price-wrap">
					<div
						className="price"
						dangerouslySetInnerHTML={{
							__html: Sanitizer(product.priceHtml || ''),
						}}
					/>
				</div>
			);

		case 'addToCart':
			return (
				<div className="elements-wrapper addtocart-wrap">
					<div className="add-to-cart-wrapper">
						<AddToCartButton
							product={{
								id: product.id,
								name: product.name,
								type: product.type || 'simple',
								sku: product.sku || '',
								permalink: product.permalink,
								addToCart: product.addToCart,
							}}
						/>
					</div>
				</div>
			);

		case 'image':
			return (
				<figure className="product-featured-image gradient-preloader">
					<ProductImage
						productId={product.id}
						name={product.name}
						images={product.images || []}
						featuredImageSize={featuredImageSize}
						style={{
							'object-position': `${imagePosition.x}% ${imagePosition.y}%`,
							'object-fit': imageFit,
						}}
					/>
				</figure>
			);

		case 'excerpt':
			return (
				<div className="elements-wrapper">
					<div
						className={`excerpt ${excerptTruncate ? 'truncated' : ''}`}
						dangerouslySetInnerHTML={{
							__html: Sanitizer(product.shortDescription || ''),
						}}
					/>
				</div>
			);

		case 'saleBadge':
			if (!product.onSale) return <div className="elements-wrapper empty-element" />;
			return (
				<div className="elements-wrapper sale-badge-wrapper single">
					<span className="product-badge sale-badge rounded">Sale</span>
				</div>
			);

		case 'rating':
			if (!product.averageRating || Number(product.averageRating) === 0) {
				return <div className="elements-wrapper empty-element" />;
			}
			return (
				<div className="elements-wrapper rating-wrapper">
					<RatingStars
						rating={Number(product.averageRating)}
						reviewCount={product.reviewCount}
					/>
				</div>
			);

		case 'categories':
			if (!product.categories?.length) return <div className="elements-wrapper empty-element" />;
			return (
				<div className="elements-wrapper taxonomy categories">
					<div className="categories links">
						{product.categories.flatMap((cat, index) => [
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
				</div>
			);

		case 'brands':
			// Brands depend on a "brands" taxonomy being present.
			if (!product.brands?.length) return <div className="elements-wrapper empty-element" />;
			return (
				<div className="elements-wrapper taxonomy brands">
					<div className="brands links">
						{product.brands.flatMap((brand, index) => [
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
				</div>
			);

		default:
			return null;
	}
}

export default SingleProductLayoutWidget;
