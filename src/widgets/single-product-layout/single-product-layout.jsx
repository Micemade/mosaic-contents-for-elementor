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
import GridHelper from '../../shared/components/GridHelper.jsx';
import GroupElement from './GroupElement.jsx';

import { decode } from '../../shared/utils/generalUtils.js';
import { mapKeysToCamelCase } from '../../shared/utils/transformationUtils.js';
import { updateElementorSetting, openPanelSection } from '../../core/elementor-utils';
import { addItemToLayout, removeItemFromLayout } from '../../shared/utils/addItem.js';
import { LRUCache, createCache } from '../../shared/utils/LRUCache.js';
import { useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';

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
	'item-9': { id: 'outofstock', name: 'Out of Stock Badge', section: 'sp_outofstock_style_section' },
	'item-10': { id: 'attributes', name: 'Attributes', section: 'sp_attributes_style_section' },
};

// Derived map of element ID → Elementor Style tab section ID.
// Used by the "Edit element" button to jump directly to the relevant section.
const ELEMENT_SECTION_MAP = Object.fromEntries(
	Object.values(ELEMENT_MAP).map(({ id, section }) => [id, section])
);

// ── Group constants ─────────────────────────────────────────────────────
const MAX_GROUPS = 3;
// Elements that cannot be placed inside groups.
const UNGROUPABLE_IDS = new Set(['item-3', 'item-5', 'item-9']); // image, saleBadge, outofstock


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
		'id,name,short_description,price_html,images,permalink,add_to_cart,type,average_rating,review_count,on_sale,categories,brands,is_purchasable,is_in_stock,variations,attributes'
	);

	const response = await fetch(
		`/wp-json/wc/store/v1/products/${productId}?${params.toString()}`
	);

	if (!response.ok) {
		throw new Error(`WC Store API error: ${response.status}`);
	}

	const item = await response.json();

	return mapKeysToCamelCase(item);
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

	const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(null); // groupId or null
	const groupDropdownRef = useRef(null);

	// ── Settings extraction ──────────────────────────────────────────
	const productId = widgetData?.mpl4e_sp_product_id || '';
	const layoutId = widgetData?.mpl4e_sp_layout || 'default';
	const customLayoutData = widgetData?.mpl4e_sp_custom_layout || '';
	const featuredImageSize = widgetData?.mpl4e_sp_featured_image_size || 'automatic';
	const imagePosition = widgetData?.mpl4e_sp_image_position || { x: 50, y: 50 };
	const imageFit = widgetData?.mpl4e_sp_image_fit || 'cover';
	const excerptTruncate = widgetData?.mpl4e_sp_excerpt_truncate ?? true;
	const outlineLabels = widgetData?.mpl4e_sp_helper_outline_labels || 'none';
	const helperType = widgetData?.mpl4e_sp_helper_grid || 'none';
	const groupStyles = useMemo(
		() => (Array.isArray(widgetData?.mpl4e_sp_group_styles) ? widgetData.mpl4e_sp_group_styles : []),
		[widgetData?.mpl4e_sp_group_styles]
	);

	// Grid settings using shared hook (columns differ from products widget).
	const gridSettings = useGridSettings(widgetData, 'mpl4e_sp_items_margin', 'mpl4e_sp_row_height');
	// Track Elementor's device mode switcher for the grid helper column calculation.
	const deviceType = useElementorDevice();
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

	// Track hidden items in editor mode (those that are toggled off but not removed from layout).
	const hiddenItems = useMemo(() => new Set(layoutData.hidden || []), [layoutData.hidden]);

	// ── Group data (derived from layout JSON) ────────────────────────
	const grouped = useMemo(() => layoutData.grouped || {}, [layoutData.grouped]);
	const groupSnapshots = useMemo(() => layoutData.groupSnapshots || {}, [layoutData.groupSnapshots]);

	// Group item IDs present in the layout (e.g. ['group-item-0', 'group-item-1']).
	const groupItemIds = useMemo(() => {
		return (layoutData.mobile || [])
			.map((item) => item.i)
			.filter((id) => id.startsWith('group-item-'));
	}, [layoutData.mobile]);

	// Collect all element IDs that are currently inside any group.
	const allGroupedElementIds = useMemo(() => {
		const set = new Set();
		Object.values(grouped).forEach((members) => members.forEach((id) => set.add(id)));
		return set;
	}, [grouped]);

	// Visible layout: exclude hidden items AND items currently inside a group.
	const visibleLayoutData = useMemo(() => {
		if (!hiddenItems.size && !allGroupedElementIds.size) return layoutData;
		const filter = (items) => (items || []).filter(
			(item) => !hiddenItems.has(item.i) && !allGroupedElementIds.has(item.i)
		);
		return {
			desktop: filter(layoutData.desktop),
			tablet: filter(layoutData.tablet),
			mobile: filter(layoutData.mobile),
			zindex: layoutData.zindex || {},
		};
	}, [layoutData, hiddenItems, allGroupedElementIds]);

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
			if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
				return;
			}
			setIsElementsDropdownOpen(false);
		};
		document.addEventListener('mousedown', handleClickOutside, true);
		return () => document.removeEventListener('mousedown', handleClickOutside, true);
	}, [isElementsDropdownOpen]);

	// Close group member dropdown on any click/mousedown outside it.
	useEffect(() => {
		if (!isGroupDropdownOpen) return;
		const handleClickOutside = (e) => {
			// Keep open if the click is inside the wrapper that holds the
			// toggle button + the dropdown panel.
			if (groupDropdownRef.current && groupDropdownRef.current.contains(e.target)) {
				return;
			}
			setIsGroupDropdownOpen(null);
		};
		// Use capture phase so we fire before RGL's drag handlers or
		// stopPropagation calls swallow the event.
		document.addEventListener('mousedown', handleClickOutside, true);
		return () => document.removeEventListener('mousedown', handleClickOutside, true);
	}, [isGroupDropdownOpen]);

	// ── Reverse sync: repeater panel ↔ grid items ──────────────────
	// Handles two directions:
	// 1. "Add item" in panel → row arrives with empty group_id → create grid item.
	// 2. "x" (remove) in panel → repeater row gone → remove orphaned grid item.
	useEffect(() => {
		if (!isEditMode || !widgetId) return;

		const repeaterGroupIds = new Set(groupStyles.filter((r) => r.group_id).map((r) => r.group_id));
		const unlinkedRows = groupStyles.filter((r) => !r.group_id);

		// ── Remove orphaned grid items (repeater row deleted via panel) ──
		const orphanedGridIds = groupItemIds.filter((id) => !repeaterGroupIds.has(id) && !unlinkedRows.length);
		if (orphanedGridIds.length) {
			let currentLayout = customLayoutData || JSON.stringify(layoutData);
			orphanedGridIds.forEach((groupId) => {
				// Restore grouped children and clean up layout JSON.
				let parsed;
				try { parsed = JSON.parse(currentLayout); } catch { return; }

				const newGrouped = { ...(parsed.grouped || {}) };
				const newSnapshots = { ...(parsed.groupSnapshots || {}) };

				const memberIds = newGrouped[groupId] || [];
				memberIds.forEach((childId) => {
					const snap = newSnapshots[childId];
					if (snap) {
						['desktop', 'tablet', 'mobile'].forEach((bp) => {
							if (snap[bp] && parsed[bp]) {
								const idx = parsed[bp].findIndex((it) => it.i === childId);
								if (idx !== -1) {
									parsed[bp][idx] = { ...parsed[bp][idx], ...snap[bp] };
								}
							}
						});
						delete newSnapshots[childId];
					}
				});

				delete newGrouped[groupId];
				parsed.grouped = Object.keys(newGrouped).length ? newGrouped : undefined;
				parsed.groupSnapshots = Object.keys(newSnapshots).length ? newSnapshots : undefined;

				currentLayout = removeItemFromLayout(JSON.stringify(parsed), groupId);
			});

			updateElementorSetting(
				'single-product-layout', widgetId,
				'mpl4e_sp_custom_layout', currentLayout
			);
			return;
		}

		// ── Add grid items for new repeater rows (empty group_id) ────────
		if (!unlinkedRows.length) return;

		const slotsLeft = MAX_GROUPS - groupItemIds.length;
		if (slotsLeft <= 0) return;

		const rowsToLink = unlinkedRows.slice(0, slotsLeft);
		let currentLayout = customLayoutData || JSON.stringify(layoutData);
		const newGroupIds = [];

		rowsToLink.forEach(() => {
			const { newLayoutJson, newItemId } = addItemToLayout(
				currentLayout,
				columns,
				{ itemPrefix: 'group-item-', maxItems: MAX_GROUPS }
			);
			currentLayout = newLayoutJson;
			newGroupIds.push(newItemId);
		});

		updateElementorSetting(
			'single-product-layout', widgetId,
			'mpl4e_sp_custom_layout', currentLayout
		);

		// Assign group_id + label back to the unlinked Backbone rows.
		if (typeof window.MosaicLayoutsReact !== 'undefined') {
			const mgr = window.MosaicLayoutsReact;
			const model = mgr.getModel('single-product-layout', widgetId);
			const settingsModel = model?.get('settings');
			const repeaterCollection = settingsModel?.get('mpl4e_sp_group_styles');

			if (repeaterCollection) {
				const rows = repeaterCollection.toJSON ? repeaterCollection.toJSON() : [];
				let idx = 0;
				rows.forEach((row, i) => {
					if (!row.group_id && idx < newGroupIds.length) {
						const bModel = repeaterCollection.at(i);
						if (bModel) {
							bModel.set('group_id', newGroupIds[idx]);
							bModel.set('group_label', `Group ${newGroupIds[idx].replace('group-item-', '')}`);
						}
						idx++;
					}
				});
				settingsModel.trigger('change', settingsModel);
			}
		}
	}, [groupStyles, isEditMode, widgetId, groupItemIds, customLayoutData, layoutData, columns]);

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
				...(layoutData.grouped && { grouped: layoutData.grouped }),
				...(layoutData.groupSnapshots && { groupSnapshots: layoutData.groupSnapshots }),
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
			...(layoutData.grouped && { grouped: layoutData.grouped }),
			...(layoutData.groupSnapshots && { groupSnapshots: layoutData.groupSnapshots }),
		};

		updateElementorSetting(
			'single-product-layout',
			widgetId,
			'mpl4e_sp_custom_layout',
			JSON.stringify(customLayout)
		);
	};

	// ── Group handlers (editor only) ─────────────────────────────────

	/**
	 * Add a new group grid item and a matching Elementor repeater row.
	 */
	const handleAddGroup = () => {
		if (!isEditMode || !widgetId) return;
		if (groupItemIds.length >= MAX_GROUPS) return;

		const { newLayoutJson, newItemId } = addItemToLayout(
			customLayoutData || JSON.stringify(layoutData),
			columns,
			{ itemPrefix: 'group-item-', maxItems: MAX_GROUPS }
		);

		// Persist the layout.
		updateElementorSetting(
			'single-product-layout', widgetId,
			'mpl4e_sp_custom_layout', newLayoutJson
		);

		// Add a matching repeater row so Elementor generates a unique _id.
		syncRepeaterToGroups([...groupItemIds, newItemId]);
	};

	/**
	 * Remove a group: restore children to the main grid, clean up layout JSON.
	 */
	const handleRemoveGroup = (groupId) => {
		if (!isEditMode || !widgetId) return;

		// 1. Remove the group item from the layout.
		let updatedJson = removeItemFromLayout(
			customLayoutData || JSON.stringify(layoutData),
			groupId
		);

		// 2. Restore grouped children positions from snapshots.
		let parsed;
		try { parsed = JSON.parse(updatedJson); } catch { return; }

		const newGrouped = { ...(parsed.grouped || {}) };
		const newSnapshots = { ...(parsed.groupSnapshots || {}) };

		// Remove members from grouped and restore their snapshot positions (if any).
		const memberIds = newGrouped[groupId] || [];
		memberIds.forEach((childId) => {
			const snap = newSnapshots[childId];
			if (snap) {
				['desktop', 'tablet', 'mobile'].forEach((bp) => {
					if (snap[bp] && parsed[bp]) {
						const idx = parsed[bp].findIndex((it) => it.i === childId);
						if (idx !== -1) {
							parsed[bp][idx] = { ...parsed[bp][idx], ...snap[bp] };
						}
					}
				});
				delete newSnapshots[childId];
			}
		});

		delete newGrouped[groupId];
		parsed.grouped = Object.keys(newGrouped).length ? newGrouped : undefined;
		parsed.groupSnapshots = Object.keys(newSnapshots).length ? newSnapshots : undefined;

		updateElementorSetting(
			'single-product-layout', widgetId,
			'mpl4e_sp_custom_layout', JSON.stringify(parsed)
		);

		// Sync repeater (remove the row).
		const remainingGroupIds = groupItemIds.filter((id) => id !== groupId);
		syncRepeaterToGroups(remainingGroupIds);
	};

	/**
	 * Toggle an element's membership in a group.
	 */
	const handleElementGroup = (elementItemId, groupId) => {
		if (!isEditMode || !widgetId) return;

		let existingCustomLayout = {};
		if (customLayoutData) {
			try { existingCustomLayout = JSON.parse(customLayoutData); } catch { return; }
		} else {
			existingCustomLayout = { ...layoutData };
		}

		const newGrouped = { ...(existingCustomLayout.grouped || {}) };
		const newSnapshots = { ...(existingCustomLayout.groupSnapshots || {}) };
		const isInThisGroup = (newGrouped[groupId] || []).includes(elementItemId);

		if (isInThisGroup) {
			// Remove from group → restore snapshot.
			newGrouped[groupId] = newGrouped[groupId].filter((id) => id !== elementItemId);
			if (!newGrouped[groupId].length) delete newGrouped[groupId];

			const snap = newSnapshots[elementItemId];
			if (snap) {
				['desktop', 'tablet', 'mobile'].forEach((bp) => {
					if (snap[bp] && existingCustomLayout[bp]) {
						const idx = existingCustomLayout[bp].findIndex((it) => it.i === elementItemId);
						if (idx !== -1) {
							existingCustomLayout[bp][idx] = { ...existingCustomLayout[bp][idx], ...snap[bp] };
						}
					}
				});
				delete newSnapshots[elementItemId];
			}
		} else {
			// Remove from any other group first.
			Object.keys(newGrouped).forEach((gId) => {
				newGrouped[gId] = newGrouped[gId].filter((id) => id !== elementItemId);
				if (!newGrouped[gId].length) delete newGrouped[gId];
			});

			// Snapshot current position before grouping.
			const snap = {};
			['desktop', 'tablet', 'mobile'].forEach((bp) => {
				const item = (existingCustomLayout[bp] || []).find((it) => it.i === elementItemId);
				if (item) snap[bp] = { x: item.x, y: item.y, w: item.w, h: item.h };
			});
			newSnapshots[elementItemId] = snap;

			// Add to group.
			newGrouped[groupId] = [...(newGrouped[groupId] || []), elementItemId];
		}

		existingCustomLayout.grouped = Object.keys(newGrouped).length ? newGrouped : undefined;
		existingCustomLayout.groupSnapshots = Object.keys(newSnapshots).length ? newSnapshots : undefined;

		updateElementorSetting(
			'single-product-layout', widgetId,
			'mpl4e_sp_custom_layout', JSON.stringify(existingCustomLayout)
		);
	};

	/**
	 * Sync the Elementor repeater rows to match the current group item IDs.
	 *
	 * Creates or removes rows so that each group has exactly one repeater row
	 * with a `group_id` field matching the grid item ID. Uses Elementor's
	 * `$e.run('document/repeater/insert|remove')` commands when available so
	 * that proper Containers are created for each row; falls back to direct
	 * Backbone collection manipulation for older Elementor versions.
	 *
	 * @param {string[]} targetGroupIds - Desired group item IDs (e.g. `['group-item-0']`).
	 */
	const syncRepeaterToGroups = (targetGroupIds) => {
		if (typeof window.MosaicLayoutsReact === 'undefined') return;
		const mgr = window.MosaicLayoutsReact;
		const model = mgr.getModel('single-product-layout', widgetId);
		if (!model) return;

		const settingsModel = model.get('settings');
		if (!settingsModel) return;

		const repeaterCollection = settingsModel.get('mpl4e_sp_group_styles');
		if (!repeaterCollection) return;

		// Current repeater rows.
		const currentRows = repeaterCollection.toJSON ? repeaterCollection.toJSON() : (Array.isArray(repeaterCollection) ? repeaterCollection : []);
		const currentGroupIds = new Set(currentRows.map((r) => r.group_id));

		// Rows to add.
		const toAdd = targetGroupIds.filter((id) => !currentGroupIds.has(id));
		// Rows to remove (IDs no longer present).
		const toRemove = currentRows.filter((r) => !targetGroupIds.includes(r.group_id));

		if (!toAdd.length && !toRemove.length) return;

		// Use Elementor's $e command API so that proper Containers are created
		// for each repeater row.  Direct collection.add() skips Container
		// creation, which causes Backbone initialization errors when the Style
		// tab renders the repeater control.
		const $e = window.$e || window.parent?.$e;
		let container = null;
		try {
			const el = typeof elementor !== 'undefined' ? elementor : window.parent?.elementor;
			container = el?.getContainer?.(widgetId);
		} catch (_) { /* getContainer may not exist in older Elementor */ }

		if ($e && container) {
			try {
				// Remove obsolete rows (reverse index order for stable indices).
				const removeIndices = toRemove
					.map((row) => repeaterCollection.indexOf(
						repeaterCollection.findWhere({ group_id: row.group_id })
					))
					.filter((idx) => idx !== -1)
					.sort((a, b) => b - a);

				removeIndices.forEach((idx) => {
					$e.run('document/repeater/remove', {
						container,
						name: 'mpl4e_sp_group_styles',
						index: idx,
					});
				});

				// Add new rows.
				toAdd.forEach((groupId) => {
					const label = `Group ${groupId.replace('group-item-', '')}`;
					$e.run('document/repeater/insert', {
						container,
						name: 'mpl4e_sp_group_styles',
						model: { group_id: groupId, group_label: label },
					});
				});

				// Fire an immediate settings change so React receives the
				// repeater update in the same batch as the layout update.
				// Without this the 80ms debounced scheduleRepeaterUpdate
				// creates a window where the reverse-sync useEffect sees an
				// orphaned grid item (layout changed, repeater not yet) and
				// removes it — requiring a second click.
				settingsModel.trigger('change', settingsModel);

				if (typeof elementor !== 'undefined' && elementor.saver) {
					elementor.saver.setFlagEditorChange(true);
				}
				return;
			} catch (err) {
				console.warn('$e.run repeater command failed, falling back:', err);
			}
		}

		// Fallback: direct collection manipulation (older Elementor).
		toRemove.forEach((row) => {
			const idx = repeaterCollection.indexOf(repeaterCollection.findWhere({ group_id: row.group_id }));
			if (idx !== -1) {
				repeaterCollection.remove(repeaterCollection.at(idx));
			}
		});

		toAdd.forEach((groupId) => {
			const label = `Group ${groupId.replace('group-item-', '')}`;
			repeaterCollection.add({ group_id: groupId, group_label: label });
		});

		settingsModel.trigger('change', settingsModel);
		if (typeof elementor !== 'undefined' && elementor.saver) {
			elementor.saver.setFlagEditorChange(true);
		}
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
			onMouseLeave={() => {
				if (isElementsDropdownOpen) setIsElementsDropdownOpen(false);
				if (isGroupDropdownOpen) setIsGroupDropdownOpen(null);
			}}
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

					// ── Group item ──
					if (layoutItem.i.startsWith('group-item-')) {
						const zIndex = layoutData.zindex?.[layoutItem.i] || 0;
						const repeaterRow = groupStyles.find((r) => r.group_id === layoutItem.i) || {};
						const repeaterClass = repeaterRow._id
							? `elementor-repeater-item-${repeaterRow._id}`
							: '';

						return (
							<div
								key={layoutItem.i}
								className={`sp-element group-element ${repeaterClass}`}
								style={{ zIndex }}
								data-label={repeaterRow.group_label || 'Group'}
								onMouseLeave={() => {
									if (isGroupDropdownOpen === layoutItem.i) {
										setIsGroupDropdownOpen(null);
									}
								}}
							>
								<GroupElement
									groupId={layoutItem.i}
									grouped={grouped}
									product={product}
									renderElement={renderElement}
									elementMap={ELEMENT_MAP}
									repeaterRow={repeaterRow}
									styles={{
										excerptTruncate,
										featuredImageSize,
										imagePosition,
										imageFit,
									}}
									isEditMode={isEditMode}
								/>

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
										<button
											className="sp-edit-element-btn"
											title="Edit group style"
											onMouseDownCapture={(e) => {
												e.stopPropagation();
												e.preventDefault();
												openPanelSection('sp_group_styles_section');
											}}
										>
											<i className="eicon-edit" />
										</button>
										<div className="mpl4e-group-controls-wrapper" ref={isGroupDropdownOpen === layoutItem.i ? groupDropdownRef : null}>
											<button
												className="sp-edit-element-btn"
												title="Group members"
												onMouseDownCapture={(e) => {
													e.stopPropagation();
													e.preventDefault();
													setIsGroupDropdownOpen((prev) =>
														prev === layoutItem.i ? null : layoutItem.i
													);
												}}
											>
												<i className="eicon-menu-bar" />
											</button>
											{isGroupDropdownOpen === layoutItem.i && (
												<div className="mpl4e-group-dropdown">
													{Object.entries(ELEMENT_MAP).map(([itemId, def]) => {
														if (UNGROUPABLE_IDS.has(itemId)) return null;
														if (itemId.startsWith('group-item-')) return null;
														const isInThisGroup = (grouped[layoutItem.i] || []).includes(itemId);
														const isHidden = hiddenItems.has(itemId);
														// Find if element is in another group.
														const otherGroup = Object.entries(grouped).find(
															([gId, members]) => gId !== layoutItem.i && members.includes(itemId)
														);
														return (
															<label
																key={itemId}
																className={`mpl4e-element-toggle-item${isInThisGroup ? ' is-active' : ''}${otherGroup ? ' in-other-group' : ''}${isHidden ? ' is-hidden' : ''}`}
																title={
																	otherGroup
																		? `In ${otherGroup[0]} — will be moved here`
																		: isInThisGroup
																			? 'Remove from group'
																			: 'Add to group'
																}
															>
																<input
																	type="checkbox"
																	checked={isInThisGroup}
																	onChange={() => handleElementGroup(itemId, layoutItem.i)}
																/>
																<span>{def.name}</span>
																{otherGroup && <span className="mpl4e-other-group-badge">{otherGroup[0].replace('group-item-', 'G')}</span>}
															</label>
														);
													})}
												</div>
											)}
										</div>
										<button
											className="mpl4e-remove-item-btn"
											title="Remove group"
											onMouseDownCapture={(e) => {
												e.stopPropagation();
												e.preventDefault();
												handleRemoveGroup(layoutItem.i);
											}}
										>
											<i className="eicon-close" />
										</button>
									</div>
								)}
							</div>
						);
					}

					// ── Regular element item ──
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
				<>
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
									{groupItemIds.map((groupId) => {
										const isHidden = hiddenItems.has(groupId);
										const row = groupStyles.find((r) => r.group_id === groupId) || {};
										const label = row.group_label || `Group ${groupId.replace('group-item-', '')}`;
										return (
											<label
												key={groupId}
												className={`mpl4e-element-toggle-item${isHidden ? ' is-hidden' : ''}`}
											>
												<input
													type="checkbox"
													checked={!isHidden}
													onChange={() => handleToggleElement(groupId)}
												/>
												<span>{label}</span>
											</label>
										);
									})}
								</div>
							)}
						</div>

						{groupItemIds.length < MAX_GROUPS && (
							<button
								type="button"
								className="mpl4e-toolbar-btn mpl4e-add-group-btn"
								onClick={handleAddGroup}
								title="Add group container"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
									<line x1="12" y1="8" x2="12" y2="16" />
									<line x1="8" y1="12" x2="16" y2="12" />
								</svg>
								<span>Add Group</span>
							</button>
						)}
					</div>

					<GridHelper gridSettings={gridSettings} device={deviceType} cols={columns} type={helperType} />
				</>
			)}{/* end of isEditMode */}

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
								isInStock: product.isInStock,
								isPurchasable: product.isPurchasable,
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

		case 'outofstock':
			if (product.isInStock) return <div className="elements-wrapper empty-element" />;
			return (
				<div className="elements-wrapper outofstock-badge-wrapper">
					<span className="product-badge outofstock-badge">
						{product.stockAvailability?.text || 'Out of stock'}
					</span>
				</div>
			);

		case 'attributes':
			if (!product.attributes?.length) return <div className="elements-wrapper empty-element" />;
			return (
				<div className="elements-wrapper attributes-wrapper">
					<table className="attributes-table">
						<tbody>
							{product.attributes.map((attr) => (
								<tr key={attr.id} className="attribute-row">
									<th className="attribute-name">{decode(attr.name)}</th>
									<td className="attribute-values">
										{attr.terms?.map((term) => decode(term.name)).join(', ') || '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);

		default:
			return null;
	}
}

export default SingleProductLayoutWidget;
