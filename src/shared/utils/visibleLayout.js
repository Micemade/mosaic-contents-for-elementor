/**
 * Visible Layout Utilities
 *
 * Helpers for temporarily hiding grid items that have no corresponding
 * data (e.g. a query returns fewer products/categories than there are
 * layout slots).  The stored layout is never mutated — hidden items are
 * restored automatically when the data count increases.
 */

/**
 * Return a copy of `layoutData` whose breakpoint arrays contain only the
 * items that have a corresponding data entry.
 *
 * The mobile layout is the canonical ordering source: the first `count`
 * items in `layoutData.mobile` define which item IDs are "visible".
 * The same IDs are then kept in `desktop` and `tablet` arrays so all
 * breakpoints stay in sync.
 *
 * @param {Object} layoutData - Full layout { desktop, tablet, mobile, zindex }
 * @param {number} count      - Number of data items returned by the query
 * @returns {Object} Filtered layout with only `count` items per breakpoint
 */
export function getVisibleLayout(layoutData, count) {
	if (!layoutData) return { desktop: [], tablet: [], mobile: [], zindex: {} };

	const mobileItems = layoutData.mobile || [];
	const visibleCount = Math.min(Math.max(count, 0), mobileItems.length);

	// Determine which item IDs should be shown (preserves mobile ordering)
	const visibleIds = new Set(
		mobileItems.slice(0, visibleCount).map((item) => item.i)
	);

	const filterBreakpoint = (items) =>
		(items || []).filter((item) => visibleIds.has(item.i));

	return {
		desktop: filterBreakpoint(layoutData.desktop),
		tablet:  filterBreakpoint(layoutData.tablet),
		mobile:  filterBreakpoint(layoutData.mobile),
		zindex:  layoutData.zindex || {},
	};
}

/**
 * Merge drag/resize changes for visible items back into the full layout.
 *
 * react-grid-layout fires `onLayoutChange` with only the currently rendered
 * items (the visible subset).  Before persisting, we must re-insert the
 * hidden items so they are not lost.
 *
 * @param {Object} fullLayoutData   - Full layout that includes hidden items
 * @param {Object} visibleChanges   - Layout object from react-grid-layout
 *                                    (only contains visible items)
 * @returns {Object} Merged full layout with updated positions for visible items
 */
export function mergeVisibleIntoFullLayout(fullLayoutData, visibleChanges) {
	const mergeBreakpoint = (fullItems, changedItems) => {
		if (!changedItems || changedItems.length === 0) return fullItems || [];

		const changedMap = new Map(changedItems.map((item) => [item.i, item]));
		return (fullItems || []).map((item) =>
			changedMap.has(item.i) ? changedMap.get(item.i) : item
		);
	};

	return {
		desktop: mergeBreakpoint(fullLayoutData.desktop, visibleChanges.desktop),
		tablet:  mergeBreakpoint(fullLayoutData.tablet,  visibleChanges.tablet),
		mobile:  mergeBreakpoint(fullLayoutData.mobile,  visibleChanges.mobile),
		zindex:  fullLayoutData.zindex || {},
	};
}
