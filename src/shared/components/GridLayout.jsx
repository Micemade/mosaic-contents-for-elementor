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

const isEditorMode = () => {
	return typeof elementorFrontend !== 'undefined' && elementorFrontend.isEditMode();
};

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

	const onBreakpointChange = (newBreakpoint, newCols) => {
		setBreakpoint(newBreakpoint);
	};

	/**
	 * Prevent Elementor widget drag when interacting with grid items.
	 * Stops event propagation so parent drag handlers don't interfere.
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

	const onResizeStart = (layout, oldItem, newItem, placeholder, e) => {
		if (e && e.nativeEvent) {
			e.nativeEvent.stopImmediatePropagation();
			e.nativeEvent.preventDefault();
		}
		e.stopPropagation();
		e.preventDefault();
		selectWidget();
	};

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
