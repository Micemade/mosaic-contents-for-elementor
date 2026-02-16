/**
 * Elementor Integration Utilities
 * 
 * Helper functions for React components to interact with Elementor.
 * Provides methods to update settings and trigger events.
 */

/**
 * Update Elementor model setting from React component
 * Critical for saving custom layouts after drag/resize
 * 
 * @param {string} widgetType - Widget type (e.g., 'products-layout')
 * @param {string} widgetId - Widget instance ID
 * @param {string} settingName - Setting key to update
 * @param {*} value - New value
 * @returns {boolean} Success status
 */
export const updateElementorSetting = (widgetType, widgetId, settingName, value) => {
	if (typeof window.MosaicLayoutsReact === 'undefined') {
		console.warn('MosaicLayoutsReact not available');
		return false;
	}

	window.MosaicLayoutsReact.updateModelSetting(widgetType, widgetId, settingName, value);

	return true;
};

/**
 * Get active Elementor breakpoints
 * 
 * @returns {Array} Array of breakpoint names (e.g., ['desktop', 'tablet', 'mobile'])
 */
export const getActiveBreakpoints = () => {

	if (typeof elementorFrontend !== 'undefined' && elementorFrontend.config?.responsive?.activeBreakpoints) {
		const activeBreakpoints = elementorFrontend.config.responsive.activeBreakpoints;
		// Get breakpoint keys and reverse (Elementor is mobile-first, we need desktop-first)
		const breakpointKeys = Object.keys(activeBreakpoints).reverse();
		// Always include 'desktop' as base
		if (!breakpointKeys.includes('desktop')) {
			breakpointKeys.unshift('desktop');
		}
		return breakpointKeys;
	}
	// Fallback to default breakpoints
	return ['desktop', 'tablet', 'mobile'];
};

/**
 * Check if currently in Elementor editor mode
 * 
 * @returns {boolean} True if in editor mode
 */
export const isElementorEditor = () => {
	return typeof elementor !== 'undefined' || 
		(typeof window.elementorFrontend !== 'undefined' && window.elementorFrontend.isEditMode());
};

/**
 * Inject dynamic breakpoint stylesheet
 * Generates CSS media queries from Elementor's active breakpoint configuration
 * and injects them into the document head. Only runs once.
 * 
 * @returns {boolean} Success status
 */
export const injectBreakpointStylesheet = () => {
	// Check if already injected
	if (document.getElementById('mosaic-elementor-breakpoints')) {
		return true;
	}

	// Get breakpoint configuration from Elementor
	if (typeof elementorFrontend === 'undefined' || !elementorFrontend.config?.responsive?.activeBreakpoints) {
		console.warn('Elementor breakpoint config not available');
		return false;
	}

	const breakpoints = elementorFrontend.config.responsive.activeBreakpoints;

	// Generate CSS with actual breakpoint values
	let css = '/* Elementor Dynamic Breakpoints */\n';

	// Sort breakpoints by value (largest to smallest for desktop-first approach)
	const sortedBreakpoints = Object.entries(breakpoints)
		.filter(([, config]) => config.direction === 'max') // Only max-width breakpoints
		.sort((a, b) => b[1].value - a[1].value);

	// Add desktop styles (no media query needed, it's the default)
	css += `
.products-layout .flex-wrapper {
	align-items: var(--mpl4e-product-vertical-align-desktop, center);
}
.products-layout .flex-wrapper .product-elements {
	justify-content: var(--mpl4e-product-align-desktop, center);
}
.products-layout .flex-wrapper .product-elements .name {
	font-size: var(--mpl4e-title-size-desktop, 26px);
	justify-content: var(--mpl4e-product-align-desktop, center);
	text-align: var(--mpl4e-product-align-desktop, center);
}
.products-layout .flex-wrapper .product-elements .price {
	font-size: var(--mpl4e-price-size-desktop, 16px);
	justify-content: var(--mpl4e-product-align-desktop, center);
	text-align: var(--mpl4e-product-align-desktop, center);
}
.products-layout .flex-wrapper .product-elements .add-to-cart-wrapper {
	font-size: var(--mpl4e-button-size-desktop, 16px);
	justify-content: var(--mpl4e-product-align-desktop, center);
	text-align: var(--mpl4e-product-align-desktop, center);
}
.products-layout .flex-wrapper .product-elements .rating-wrapper {
	justify-content: var(--mpl4e-product-align-desktop, center);
}
.mosaic-hide-desktop {
	display: none !important;
}

/* Categories Layout - Desktop */
.categories-layout .flex-wrapper {
	align-items: var(--mpl4e-cat-vertical-align-desktop, center);
}
.categories-layout .flex-wrapper .category-elements {
	justify-content: var(--mpl4e-cat-align-desktop, center);
}
.categories-layout .flex-wrapper .category-elements .name {
	font-size: var(--mpl4e-cat-title-size-desktop, 24px);
	justify-content: var(--mpl4e-cat-align-desktop, center);
	text-align: var(--mpl4e-cat-align-desktop, center);
}
.categories-layout .flex-wrapper .category-elements .cat-count {
	font-size: var(--mpl4e-cat-count-size-desktop, 16px);
	justify-content: var(--mpl4e-cat-align-desktop, center);
	text-align: var(--mpl4e-cat-align-desktop, center);
}
.categories-layout .flex-wrapper .category-elements .cat-description {
	font-size: var(--mpl4e-cat-description-size-desktop, 14px);
	justify-content: var(--mpl4e-cat-align-desktop, center);
	text-align: var(--mpl4e-cat-align-desktop, center);
}
`;
	// Generate responsive styles for products-layout widget
	sortedBreakpoints.forEach(([name, config]) => {
		const { value } = config;



		css += `
@media (max-width: ${value}px) {
	.products-layout .flex-wrapper {
		align-items: var(--mpl4e-product-vertical-align-${name}, center);
	}
	.products-layout .flex-wrapper .product-elements {
		justify-content: var(--mpl4e-product-align-${name}, center);
	}
	.products-layout .flex-wrapper .product-elements .name {
		font-size: var(--mpl4e-title-size-${name}, 20px);
		justify-content: var(--mpl4e-product-align-${name}, center);
		text-align: var(--mpl4e-product-align-${name}, center);
	}
	.products-layout .flex-wrapper .product-elements .price {
		font-size: var(--mpl4e-price-size-${name}, 16px);
		justify-content: var(--mpl4e-product-align-${name}, center);
		text-align: var(--mpl4e-product-align-${name}, center);
	}
	.products-layout .flex-wrapper .product-elements .add-to-cart-wrapper {
		font-size: var(--mpl4e-button-size-${name}, 16px);
		justify-content: var(--mpl4e-product-align-${name}, center);
		text-align: var(--mpl4e-product-align-${name}, center);
	}
	.products-layout .flex-wrapper .product-elements .rating-wrapper {
		justify-content: var(--mpl4e-product-align-${name}, center);
	}
	.mosaic-hide-${name} {
		display: none !important;
	}

	/* Categories Layout - ${name} */
	.categories-layout .flex-wrapper {
		align-items: var(--mpl4e-cat-vertical-align-${name}, center);
	}
	.categories-layout .flex-wrapper .category-elements {
		justify-content: var(--mpl4e-cat-align-${name}, center);
	}
	.categories-layout .flex-wrapper .category-elements .name {
		font-size: var(--mpl4e-cat-title-size-${name}, 20px);
		justify-content: var(--mpl4e-cat-align-${name}, center);
		text-align: var(--mpl4e-cat-align-${name}, center);
	}
	.categories-layout .flex-wrapper .category-elements .cat-count {
		font-size: var(--mpl4e-cat-count-size-${name}, 14px);
		justify-content: var(--mpl4e-cat-align-${name}, center);
		text-align: var(--mpl4e-cat-align-${name}, center);
	}
	.categories-layout .flex-wrapper .category-elements .cat-description {
		font-size: var(--mpl4e-cat-description-size-${name}, 12px);
		justify-content: var(--mpl4e-cat-align-${name}, center);
		text-align: var(--mpl4e-cat-align-${name}, center);
	}
}`;
	});


	// Create and inject style element
	const styleElement = document.createElement('style');
	styleElement.id = 'mosaic-elementor-breakpoints';
	styleElement.textContent = css;
	document.head.appendChild(styleElement);

	return true;
};
