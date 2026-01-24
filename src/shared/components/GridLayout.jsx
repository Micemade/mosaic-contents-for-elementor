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
import 'react-grid-layout/css/styles.css';

/**
 * Get Elementor breakpoint values dynamically
 * Falls back to defaults if Elementor config is not available
 */
const getElementorBreakpoints = () => {
	if (typeof elementorFrontend !== 'undefined' && elementorFrontend.config?.responsive?.activeBreakpoints) {
		const activeBreakpoints = elementorFrontend.config.responsive.activeBreakpoints;
		const result = { mobile: 0 };

		// Extract breakpoint values from Elementor config
		Object.keys(activeBreakpoints).forEach(key => {
			if (activeBreakpoints[key].value) {
				result[key] = activeBreakpoints[key].value + 1; // Elementor uses max-width, we need min-width
			}
		});

		// Desktop is always the highest breakpoint + 1
		const tabletValue = result.tablet || 767;
		result.desktop = tabletValue + 1;

		return result;
	}

	// Fallback to default breakpoints
	return {
		desktop: 1025,
		tablet: 767,
		mobile: 0,
	};
};

const ELEMENTOR_BREAKPOINTS = getElementorBreakpoints();

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
		size,
		children,
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
	};

	const onResizeStart = (layout, oldItem, newItem, placeholder, e) => {
		if (e && e.nativeEvent) {
			e.nativeEvent.stopImmediatePropagation();
			e.nativeEvent.preventDefault();
		}
		e.stopPropagation();
		e.preventDefault();
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
		>
			{children}
		</RGL>
	);
}

export default withSize()(GridLayout);
