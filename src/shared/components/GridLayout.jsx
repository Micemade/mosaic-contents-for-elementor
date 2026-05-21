/**
 * GridLayout Component for Elementor React widgets.
 *
 * Wraps react-grid-layout's Responsive component with Elementor-compatible breakpoints.
 * Adapted from mosaic-product-layouts pattern for use in Elementor context.
 *
 * Key differences from Gutenberg version:
 * - Uses React imports instead of @wordpress/element
 * - Breakpoints align with Elementor defaults (1024px tablet, 767px mobile)
 * - No setAttributes (Elementor doesn't save layout changes from frontend)
 * - Simplified for frontend-only rendering
 */

import { useState, useEffect } from 'react';
import { publish } from './utils/events';
import { Responsive as RGL } from 'react-grid-layout';
import { withSize } from 'react-sizeme';
import { getElementorGridBreakpoints } from '../../core/elementor-utils';
import 'react-grid-layout/css/styles.css';

const ELEMENTOR_BREAKPOINTS = getElementorGridBreakpoints();

/**
 * Check whether the current runtime context is Elementor editor mode.
 *
 * @returns {boolean} True when running in Elementor edit mode.
 */
const isEditorMode = () => {
	return typeof elementorFrontend !== 'undefined' && elementorFrontend.isEditMode();
};

/**
 * Render a responsive grid wrapper around widget children.
 *
 * @param {Object} props - Grid layout properties.
 * @param {Object} props.layouts - Layout map keyed by breakpoint.
 * @param {Object} [props.columns] - Column counts per breakpoint.
 * @param {number} [props.itemsMargin=15] - Horizontal/vertical grid margin in pixels.
 * @param {number} [props.rowHeight=5] - Base row height used by react-grid-layout.
 * @param {boolean} [props.allowOverlap=false] - Whether grid items can overlap.
 * @param {('vertical'|'horizontal'|null)} [props.compactionType='vertical'] - Grid compaction strategy.
 * @param {('edit'|'frontend')} [props.context] - Rendering context.
 * @param {boolean} [props.isDraggable] - Whether dragging is enabled.
 * @param {boolean} [props.isResizable] - Whether resizing is enabled.
 * @param {Function} [props.onLayoutChange] - Callback fired after drag/resize updates.
 * @param {string} [props.draggableCancel=''] - Selector for child elements that should not trigger drag.
 * @param {Object} [props.size] - Size info injected by react-sizeme HOC.
 * @param {number} [props.size.width] - Current container width.
 * @param {import('react').ReactNode} props.children - Grid item children.
 * @param {Function} [props.selectWidget] - Callback to focus/select the current Elementor widget.
 * @returns {import('react').JSX.Element} Responsive grid element.
 */
function GridLayout(props) {
	const {
		layouts,
		columns = { desktop: 12, tablet: 8, mobile: 4 },
		itemsMargin = 15,
		rowHeight = 5,
		allowOverlap = false,
		compactionType = 'vertical',
		context = isEditorMode() ? 'edit' : 'frontend',
		isDraggable = isEditorMode(),
		isResizable = isEditorMode(),
		onLayoutChange, // Callback when layout changes
		draggableCancel = '', // CSS selector for non-draggable child elements
		size,
		children,
		selectWidget,
	} = props;

	// Grid columns per breakpoint
	const cols = {
		desktop: columns.desktop || 12,
		tablet: columns.tablet || 8,
		mobile: columns.mobile || 4,
	};

	const defaultProps = {
		breakpoints: ELEMENTOR_BREAKPOINTS,
		cols: cols,
		className: `mosaic-grid-layout${context === 'edit' ? ' edit' : ''}`,
		isDraggable: isDraggable,
		isResizable: isResizable,
		resizeHandles: isResizable ? ["s", "w", "e", "n", "sw", "nw", "se", "ne"] : [],
		containerPadding: [0, 0],
		transformScale: 1,
		isBounded: false,
		useCSSTransforms: true,
	};

	const [layoutsState, setLayoutsState] = useState(layouts);
	const [breakpoint, setBreakpoint] = useState(null);
	const { width } = size || {};

	// Detect current breakpoint based on window width
	/**
	 * Resolve the current breakpoint name from viewport width.
	 *
	 * @returns {('desktop'|'tablet'|'mobile')} Current breakpoint key.
	 */
	const getBreakpointFromWidth = () => {
		const windowWidth = window.innerWidth;
		if (windowWidth < ELEMENTOR_BREAKPOINTS.mobile) {
			return 'mobile';
		} else if (windowWidth < ELEMENTOR_BREAKPOINTS.desktop) {
			return 'tablet';
		}
		return 'desktop';
	};

	// Width adjustment hack for initial render (from mosaic-product-layouts)
	const [widthTemp, setWidthTemp] = useState(width);
	useEffect(() => {
		setWidthTemp((prev) => (prev ? prev - 1 : prev));
		const timeoutWidthTemp = setTimeout(() => {
			setWidthTemp(null);
		}, 50);
		return () => clearTimeout(timeoutWidthTemp);
	}, []);

	// Publish gridDone event when grid is ready
	useEffect(() => {
		if (context === 'edit') return;
		const gridDone = setTimeout(() => {
			publish('gridDone');
		}, 300);
		return () => clearTimeout(gridDone);
	}, [context]);

	// Update layouts when props change
	useEffect(() => {
		if (layouts) {
			setLayoutsState(layouts);
		}
	}, [layouts]);

	/**
	 * Handle react-grid-layout breakpoint changes.
	 *
	 * @param {string} newBreakpoint - New active breakpoint key.
	 * @param {number} newCols - Column count for the active breakpoint.
	 * @returns {void}
	 */
	const onBreakpointChange = (newBreakpoint, newCols) => {
		setBreakpoint(newBreakpoint);
	};

	/**
	 * Prevent Elementor widget drag when interacting with grid items.
	 * Stops event propagation so parent drag handlers don't interfere.
	 *
	 * @param {Array} layout - Current layout for the active breakpoint.
	 * @param {Object} oldItem - Item state before drag starts.
	 * @param {Object} newItem - Item state when drag starts.
	 * @param {Object} placeholder - Placeholder item used during drag.
	 * @param {Event} e - Native/React drag start event.
	 * @returns {void}
	 */
	const onDragStart = (layout, oldItem, newItem, placeholder, e) => {
		if (e && e.nativeEvent) {
			e.nativeEvent.stopImmediatePropagation();
			e.nativeEvent.preventDefault();
		}
		e.stopPropagation();
		e.preventDefault();
		selectWidget();
	};

	/**
	 * Prevent Elementor parent drag handling when resize starts.
	 *
	 * @param {Array} layout - Current layout for the active breakpoint.
	 * @param {Object} oldItem - Item state before resize starts.
	 * @param {Object} newItem - Item state when resize starts.
	 * @param {Object} placeholder - Placeholder item used during resize.
	 * @param {Event} e - Native/React resize start event.
	 * @returns {void}
	 */
	const onResizeStart = (layout, oldItem, newItem, placeholder, e) => {
		if (e && e.nativeEvent) {
			e.nativeEvent.stopImmediatePropagation();
			e.nativeEvent.preventDefault();
		}
		e.stopPropagation();
		e.preventDefault();
		selectWidget();
	};

	/**
	 * Handle drag completion and emit layout changes in breakpoint-map format.
	 *
	 * @param {Array} layout - Updated layout items for the active breakpoint.
	 * @param {Object} oldItem - Item state before drag.
	 * @param {Object} newItem - Item state after drag.
	 * @returns {void}
	 */
	const onDragStop = (layout, oldItem, newItem) => {
		if (onLayoutChange) {
			// Convert layout to breakpoint format
			const newLayouts = {
				...layoutsState,
				[currentBreakpoint]: layout
			};
			onLayoutChange(newLayouts);
		}
	};

	/**
	 * Handle resize completion and emit layout changes in breakpoint-map format.
	 *
	 * @param {Array} layout - Updated layout items for the active breakpoint.
	 * @param {Object} oldItem - Item state before resize.
	 * @param {Object} newItem - Item state after resize.
	 * @returns {void}
	 */
	const onResizeStop = (layout, oldItem, newItem) => {
		if (onLayoutChange) {
			// Convert layout to breakpoint format
			const newLayouts = {
				...layoutsState,
				[currentBreakpoint]: layout
			};
			onLayoutChange(newLayouts);
		}
	};

	const currentBreakpoint = getBreakpointFromWidth();
/* 
	// Prepare layoutsState for debugging
	const debugLayoutsState = () => {
		const cleaned = {};
		Object.entries(layoutsState).forEach(([breakpoint, value]) => {
			// Skip zindex
			console.log(breakpoint);

			if (breakpoint === 'zindex') return;
			// Capitalize breakpoint name
			const capitalizedBreakpoint = breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1);
			// Remove 'moved' and 'static' from each item
			cleaned[capitalizedBreakpoint] = Array.isArray(value)
				? value.map(item => {
					const { moved, static: staticProp, ...cleanItem } = item;
					return cleanItem;
				})
				: value;
		});
		// Convert to JSON string with escaped double quotes
		const jsonString = JSON.stringify(cleaned).replace(/"/g, '\\"');
		console.log(jsonString);
	};
	debugLayoutsState();
 */

	return (
		<RGL
			{...defaultProps}
			layouts={layoutsState}
			margin={[itemsMargin, itemsMargin]}
			measureBeforeMount={true}
			width={widthTemp || width}
			onBreakpointChange={onBreakpointChange}
			onDragStart={onDragStart}
			onDragStop={onDragStop}
			onResizeStart={onResizeStart}
			onResizeStop={onResizeStop}
			breakpoint={currentBreakpoint}
			compactType={compactionType}
			allowOverlap={allowOverlap}
			rowHeight={rowHeight}
			{...(draggableCancel && { draggableCancel })}
		>
			{children}
		</RGL>
	);
}

export default withSize()(GridLayout);
