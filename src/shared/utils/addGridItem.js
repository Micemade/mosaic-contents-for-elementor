/**
 * Add Grid Item Utility for Elementor
 * 
 * Provides functionality to add new items to the grid layout.
 * Adapted from the Gutenberg AddItem component for Elementor's architecture.
 */

import { getActiveBreakpoints } from '../../core/elementor-utils';

/**
 * Find the highest existing item number in the layouts
 * 
 * @param {Object} layouts - Layout object with breakpoint keys (desktop, tablet, mobile)
 * @param {string} itemPrefix - Prefix for item IDs (e.g., 'item-')
 * @returns {number} Highest item number found
 */
const getHighestItemNumber = (layouts, itemPrefix = 'item-') => {
	// Only get arrays (breakpoint layouts), exclude zindex and other non-array properties
	const layoutArrays = Object.entries(layouts)
		.filter(([key, value]) => Array.isArray(value))
		.map(([key, value]) => value);
	
	const allItems = layoutArrays.flat();
	const itemNumbers = allItems
		.filter(item => item && typeof item.i === 'string') // Ensure item has valid 'i' property
		.map(item => {
			const pattern = new RegExp(`^${itemPrefix}(\\d+)$`);
			const match = item.i.match(pattern);
			return match ? parseInt(match[1]) : 0;
		});
	return Math.max(...itemNumbers, 0);
};

/**
 * Build a new item for a specific breakpoint
 * 
 * @param {string} device - Breakpoint name (desktop, tablet, mobile)
 * @param {Array} existingLayouts - Existing layout items for this breakpoint
 * @param {number} gridWidth - Number of columns for this breakpoint
 * @param {string} itemId - ID for the new item
 * @returns {Object} New layout item
 */
const buildNewItemForDevice = (device, existingLayouts, gridWidth, itemId) => {
	// Default dimensions based on device
	const defaultDimensions = {
		desktop: { w: 12, h: 15 },
		tablet: { w: 8, h: 12 },
		mobile: { w: 6, h: 10 },
	};

	const defaults = defaultDimensions[device] || defaultDimensions.desktop;

	// If no existing layouts, place at origin
	if (!existingLayouts || existingLayouts.length === 0) {
		return {
			i: itemId,
			x: 0,
			y: 0,
			w: defaults.w,
			h: defaults.h,
		};
	}

	// Get dimensions from the last item or use defaults
	const lastItem = existingLayouts[existingLayouts.length - 1];
	const itemWidth = lastItem ? lastItem.w : defaults.w;
	const itemHeight = lastItem ? lastItem.h : defaults.h;

	// Calculate the maximum y position (bottom of layout)
	const maxY = Math.max(...existingLayouts.map(layout => layout.y + layout.h));
	const maxX = Math.max(...existingLayouts.map(layout => layout.x + layout.w));

	// Try to place the item to the right of the last row first
	if (maxX + itemWidth <= gridWidth) {
		// Find items in the last row
		const lastRowY = Math.max(...existingLayouts.map(l => l.y));
		const lastRowItems = existingLayouts.filter(l => l.y === lastRowY);
		const lastRowMaxX = Math.max(...lastRowItems.map(l => l.x + l.w));
		
		if (lastRowMaxX + itemWidth <= gridWidth) {
			return {
				i: itemId,
				x: lastRowMaxX,
				y: lastRowY,
				w: itemWidth,
				h: itemHeight,
			};
		}
	}

	// If there's no space to the right, place it below
	return {
		i: itemId,
		x: 0,
		y: maxY,
		w: itemWidth,
		h: itemHeight,
	};
};

/**
 * Add a new item to the layout
 * 
 * @param {string} currentLayoutJson - Current layout as JSON string
 * @param {Object} gridColumns - Object with column counts per breakpoint { desktop: 48, tablet: 24, mobile: 12 }
 * @returns {Object} Object containing { newLayoutJson, newItemId }
 */
export const addItemToLayout = (currentLayoutJson, gridColumns = { desktop: 48, tablet: 24, mobile: 12 }) => {
	let layouts;
	
	// Parse current layout or create empty structure
	try {
		layouts = currentLayoutJson ? JSON.parse(currentLayoutJson) : {
			desktop: [],
			tablet: [],
			mobile: [],
			zindex: {}
		};
	} catch (error) {
		console.error('Failed to parse layout JSON:', error);
		layouts = {
			desktop: [],
			tablet: [],
			mobile: [],
			zindex: {}
		};
	}

	// Get active breakpoints
	const breakpoints = getActiveBreakpoints();
	
	// Find the highest item number and create new item ID
	const highestNumber = getHighestItemNumber(layouts, 'item-');
	const newItemNumber = highestNumber + 1;
	const newItemId = `item-${newItemNumber}`;

	// Find the highest z-index
	const highestZIndex = Object.values(layouts.zindex || {}).reduce(
		(max, current) => Math.max(max, current), 
		0
	);

	// Build new item for each breakpoint
	const updatedLayouts = { ...layouts };
	
	breakpoints.forEach(device => {
		if (device === 'widescreen') return; // Skip widescreen if present
		
		const existingItems = layouts[device] || [];
		const columns = gridColumns[device] || 48;
		const newItem = buildNewItemForDevice(device, existingItems, columns, newItemId);
		
		updatedLayouts[device] = [...existingItems, newItem];
	});

	// Add z-index for new item
	updatedLayouts.zindex = {
		...(layouts.zindex || {}),
		[newItemId]: highestZIndex + 1
	};

	return {
		newLayoutJson: JSON.stringify(updatedLayouts),
		newItemId
	};
};

/**
 * Remove an item from the layout
 * 
 * @param {string} currentLayoutJson - Current layout as JSON string
 * @param {string} itemId - ID of the item to remove
 * @returns {string} Updated layout as JSON string
 */
export const removeItemFromLayout = (currentLayoutJson, itemId) => {
	let layouts;
	
	try {
		layouts = JSON.parse(currentLayoutJson);
	} catch (error) {
		console.error('Failed to parse layout JSON:', error);
		return currentLayoutJson;
	}

	// Remove item from all breakpoints
	const breakpoints = getActiveBreakpoints();
	const updatedLayouts = { ...layouts };
	
	breakpoints.forEach(device => {
		if (layouts[device]) {
			updatedLayouts[device] = layouts[device].filter(item => item.i !== itemId);
		}
	});

	// Remove z-index for the item
	if (updatedLayouts.zindex && updatedLayouts.zindex[itemId]) {
		const { [itemId]: removed, ...remainingZindex } = updatedLayouts.zindex;
		updatedLayouts.zindex = remainingZindex;
	}

	return JSON.stringify(updatedLayouts);
};

export default addItemToLayout;
