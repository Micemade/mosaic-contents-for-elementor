/**
 * Add Grid Item Utility for Elementor
 * 
 * Provides functionality to add new items to the grid layout.
 * Adapted from the Gutenberg AddItem component for Elementor's architecture.
 */

import { getActiveBreakpointNames } from '../../core/elementor-utils';

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
 * Check if a position is occupied by any existing item
 * 
 * @param {Array} existingLayouts - Existing layout items
 * @param {number} x - X position to check
 * @param {number} y - Y position to check
 * @param {number} w - Width of item to place
 * @param {number} h - Height of item to place
 * @returns {boolean} True if position overlaps with any existing item
 */
const isPositionOccupied = (existingLayouts, x, y, w, h) => {
	return existingLayouts.some(item => {
		// Check for overlap: items overlap if they share any cells
		const overlapX = x < item.x + item.w && x + w > item.x;
		const overlapY = y < item.y + item.h && y + h > item.y;
		return overlapX && overlapY;
	});
};

/**
 * Find the first available gap in the grid and calculate available space
 * Scans from top-left, row by row
 * 
 * @param {Array} existingLayouts - Existing layout items
 * @param {number} gridWidth - Number of columns in the grid
 * @param {number} minWidth - Minimum width to consider as a valid gap
 * @returns {Object|null} Position { x, y, availableWidth } or null if no gap found
 */
const findFirstAvailableGap = (existingLayouts, gridWidth, minWidth = 1) => {
	if (!existingLayouts || existingLayouts.length === 0) {
		return { x: 0, y: 0, availableWidth: gridWidth };
	}

	// Calculate the bounding box of existing items
	const maxY = Math.max(...existingLayouts.map(item => item.y + item.h));

	// Scan the grid from top-left, row by row
	for (let y = 0; y <= maxY; y++) {
		for (let x = 0; x <= gridWidth - minWidth; x++) {
			// Check if this position is free (check with 1x1 to find any gap start)
			if (!isPositionOccupied(existingLayouts, x, y, 1, 1)) {
				// Found a gap start, calculate available horizontal space
				let availableWidth = 0;
				for (let testX = x; testX < gridWidth; testX++) {
					if (!isPositionOccupied(existingLayouts, testX, y, 1, 1)) {
						availableWidth++;
					} else {
						break;
					}
				}
				if (availableWidth >= minWidth) {
					return { x, y, availableWidth };
				}
			}
		}
	}

	return null; // No gap found within existing layout bounds
};

/**
 * Calculate the maximum height available at a position without overlapping
 * 
 * @param {Array} existingLayouts - Existing layout items
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width of the item
 * @param {number} maxHeight - Maximum height to check
 * @returns {number} Maximum available height
 */
const getAvailableHeight = (existingLayouts, x, y, width, maxHeight) => {
	for (let h = 1; h <= maxHeight; h++) {
		if (isPositionOccupied(existingLayouts, x, y, width, h)) {
			return h - 1;
		}
	}
	return maxHeight;
};

/**
 * Find the height to use for a new item based on nearby items,
 * constrained to not overlap with any existing items
 * 
 * @param {Array} existingLayouts - Existing layout items
 * @param {number} gapX - X position of the gap
 * @param {number} gapY - Y position of the gap
 * @param {number} gapWidth - Width of the new item
 * @param {number} defaultHeight - Default height to use if no match found
 * @returns {number} Height to use
 */
const getHeightFromNearbyItems = (existingLayouts, gapX, gapY, gapWidth, defaultHeight) => {
	if (!existingLayouts || existingLayouts.length === 0) {
		return defaultHeight;
	}

	// First, calculate the maximum available height without overlapping
	const maxAvailableHeight = getAvailableHeight(existingLayouts, gapX, gapY, gapWidth, defaultHeight * 2);

	if (maxAvailableHeight <= 0) {
		return 1; // Minimum height
	}

	// Look for items on the same row (same y position) to match height
	const sameRowItems = existingLayouts.filter(item => item.y === gapY);
	if (sameRowItems.length > 0) {
		const targetHeight = sameRowItems[0].h;
		return Math.min(targetHeight, maxAvailableHeight);
	}

	// Look for items that overlap vertically with this y position
	const overlappingItems = existingLayouts.filter(item =>
		item.y <= gapY && item.y + item.h > gapY
	);
	if (overlappingItems.length > 0) {
		const targetHeight = overlappingItems[0].h;
		return Math.min(targetHeight, maxAvailableHeight);
	}

	// Fall back to last item's height, constrained by available space
	const lastItem = existingLayouts[existingLayouts.length - 1];
	const targetHeight = lastItem ? lastItem.h : defaultHeight;
	return Math.min(targetHeight, maxAvailableHeight);
};

/**
 * Build a new item for a specific breakpoint
 * 
 * Placement priority:
 * 1. First available gap in existing layout (from top-left), filling horizontal space
 * 2. New row at the bottom
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
		desktop: { w: 12, h: 20 },
		tablet: { w: 8, h: 16 },
		mobile: { w: 6, h: 12 },
	};

	const defaults = defaultDimensions[device] || defaultDimensions.desktop;

	// If no existing layouts, place at origin with default dimensions
	if (!existingLayouts || existingLayouts.length === 0) {
		return {
			i: itemId,
			x: 0,
			y: 0,
			w: defaults.w,
			h: defaults.h,
		};
	}

	// Get last item's dimensions for reference
	const lastItem = existingLayouts[existingLayouts.length - 1];

	// Priority 1: Find first available gap in existing layout
	// Gap must be at least defaults.w wide (minimum width)
	const gap = findFirstAvailableGap(existingLayouts, gridWidth, defaults.w);
	if (gap) {
		// Use available width (fill the gap horizontally), minimum is defaults.w
		let itemWidth = Math.max(gap.availableWidth, defaults.w);

		// For desktop/tablet: if width is half of grid width or more, limit to last item's width
		if (device !== 'mobile' && itemWidth >= gridWidth / 2 && lastItem) {
			itemWidth = Math.max(lastItem.w, defaults.w);
		}

		// Get height from nearby items, constrained to not overlap
		const itemHeight = getHeightFromNearbyItems(existingLayouts, gap.x, gap.y, itemWidth, defaults.h);

		// Only use this gap if dimensions meet minimum requirements
		if (itemWidth >= defaults.w && itemHeight >= defaults.h) {
			return {
				i: itemId,
				x: gap.x,
				y: gap.y,
				w: itemWidth,
				h: itemHeight,
			};
		}
	}

	// Priority 2: Place on a new row at the bottom
	const maxY = Math.max(...existingLayouts.map(layout => layout.y + layout.h));
	// Use last item's height but ensure minimum height requirement
	const itemHeight = Math.max(lastItem ? lastItem.h : defaults.h, defaults.h);

	// For desktop/tablet: use last item's width; for mobile: use full grid width
	let itemWidth;
	if (device !== 'mobile' && lastItem) {
		itemWidth = Math.max(lastItem.w, defaults.w);
	} else {
		itemWidth = Math.max(gridWidth, defaults.w);
	}

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
 * @param {Object} [options] - Additional options
 * @param {string} [options.itemPrefix='item-'] - Prefix for item IDs (e.g. 'group-item-' for groups)
 * @returns {Object} Object containing { newLayoutJson, newItemId }
 */
export const addItemToLayout = (currentLayoutJson, gridColumns = { desktop: 48, tablet: 24, mobile: 12 }, options = {}) => {
	const itemPrefix = options.itemPrefix || 'item-';
	const isGroup = itemPrefix === 'group-item-';
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
	const breakpoints = getActiveBreakpointNames();
	
	// Find the highest item number and create new item ID
	const highestNumber = getHighestItemNumber(layouts, itemPrefix);
	const newItemNumber = highestNumber + 1;
	const newItemId = `${itemPrefix}${newItemNumber}`;

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

		let newItem;
		if (isGroup) {
			// Groups use fixed dimensions, placed centrally
			const groupDimensions = {
				desktop: { w: 20, h: 20, x: 10, y: 10 },
				tablet: { w: 16, h: 16, x: 8, y: 8 },
				mobile: { w: 14, h: 14, x: 4, y: 4 },
			};
			const dims = groupDimensions[device] || groupDimensions.desktop;
			newItem = { i: newItemId, ...dims };
		} else {
			newItem = buildNewItemForDevice(device, existingItems, columns, newItemId);
		}
		
		updatedLayouts[device] = [...existingItems, newItem];
	});

	// Add z-index for new item
	updatedLayouts.zindex = {
		...(layouts.zindex || {}),
		[newItemId]: highestZIndex + 1
	};

	// Preserve grouped and groupSnapshots if present
	if (layouts.grouped) {
		updatedLayouts.grouped = layouts.grouped;
	}
	if (layouts.groupSnapshots) {
		updatedLayouts.groupSnapshots = layouts.groupSnapshots;
	}

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
	const breakpoints = getActiveBreakpointNames();
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
