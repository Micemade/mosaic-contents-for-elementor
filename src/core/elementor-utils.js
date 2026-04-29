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
 * @param {string} widgetType - Widget type (e.g., 'content-layout')
 * @param {string} widgetId - Widget instance ID
 * @param {string} settingName - Setting key to update
 * @param {*} value - New value
 * @returns {boolean} Success status
 */
export const updateElementorSetting = (widgetType, widgetId, settingName, value) => {
	if (typeof window.MosaicContentsReact === 'undefined') {
		console.warn('MosaicContentsReact not available');
		return false;
	}

	window.MosaicContentsReact.updateModelSetting(widgetType, widgetId, settingName, value);

	return true;
};

/**
 * Get active Elementor breakpoints
 * 
 * @returns {Array} Array of breakpoint names (e.g., ['desktop', 'tablet', 'mobile'])
 */
export const getActiveBreakpointNames = () => {

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
 * Get Elementor breakpoint values formatted for react-grid-layout min-width map.
 *
 * @returns {{desktop:number, tablet:number, mobile:number}}
 */
export const getElementorGridBreakpoints = () => {
	if (typeof elementorFrontend !== 'undefined' && elementorFrontend.config?.responsive?.activeBreakpoints) {
		const activeBreakpoints = elementorFrontend.config.responsive.activeBreakpoints;
		const result = { mobile: 0 };

		Object.keys(activeBreakpoints).forEach((key) => {
			if (activeBreakpoints[key].value) {
				// Elementor uses max-width values; RGL uses min-width breakpoints.
				result[key] = activeBreakpoints[key].value + 1;
			}
		});

		// Desktop is always above tablet max width.
		const tabletValue = result.tablet || 767;
		result.desktop = tabletValue + 1;

		return result;
	}

	// Fallback defaults.
	return {
		desktop: 1025,
		tablet: 767,
		mobile: 0,
	};
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
	// Avoid reinjecting
	if (document.getElementById('mosaic-elementor-breakpoints')) {
		return true;
	}

	// bail out early if Elementor config is not present
	if (typeof elementorFrontend === 'undefined' || !elementorFrontend.config?.responsive?.activeBreakpoints) {
		console.warn('Elementor breakpoint config not available');
		return false;
	}

	// compute media queries from Elementor config.  Support both
	// "max" breakpoints (finite ranges) and explicit "min"
	// breakpoints (e.g. widescreen).  Max ranges are generated
	// sequentially and a desktop fallback added; min entries are
	// appended afterward so they can override earlier rules.
	const computeQueries = () => {
		const active = elementorFrontend.config.responsive.activeBreakpoints;
		const maxItems = [];
		const minItems = [];

		Object.entries(active).forEach(([name, cfg]) => {
			if (cfg.value == null) {
				return;
			}
			if (cfg.direction === 'max') {
				maxItems.push({ name, max: cfg.value });
			} else if (cfg.direction === 'min') {
				minItems.push({ name, min: cfg.value });
			}
		});

		// Build ordered ranges from max breakpoints.
		maxItems.sort((a, b) => a.max - b.max);
		const queries = [];
		let prevMax = -1;
		maxItems.forEach(entry => {
			if (prevMax < 0) {
				queries.push({ name: entry.name, mq: `@media (max-width: ${entry.max}px)` });
			} else {
				const min = prevMax + 1;
				queries.push({ name: entry.name, mq: `@media (min-width: ${min}px) and (max-width: ${entry.max}px)` });
			}
			prevMax = entry.max;
		});

		if (prevMax >= 0) {
			// Desktop starts where the last "max" range ends.  We used to
			// add +1 to avoid overlapping, but Elementor's preview width
			// often equals that value (e.g. 1366px).  Allow overlap so that
			// selecting "desktop" in the editor immediately triggers the
			// desktop rule and overrides any laptop settings.
			queries.push({ name: 'desktop', mq: `@media (min-width: ${prevMax}px)` });
		}

		// Now append explicit min-width breakpoints
		minItems.sort((a, b) => a.min - b.min);
		minItems.forEach(entry => {
			queries.push({ name: entry.name, mq: `@media (min-width: ${entry.min}px)` });
		});

		return queries;
	};

	const queries = computeQueries();
	if (!queries.length) {
		console.warn('Elementor breakpoint config not available');
		return false;
	}

	let css = '/* Elementor Dynamic Breakpoints */\n';
	queries.forEach(({ name, mq }) => {

		css += `
${mq} {

	.mosaic-hide-${name} {
		display: none !important;
	}

	/* Content Layout - ${name} */
	.content-layout .flex-wrapper {
		text-align: var(--mc4e-product-align-${name}, center);
	}

	.content-layout .item-wrapper .flex-wrapper .product-elements {
		text-align: var(--mc4e-product-align-text-${name});
	}

	/* Categories Layout - ${name} */
	.categories-layout .flex-wrapper {
		text-align: var(--mc4e-cat-align-text-${name}, center);
	}
}
`;
	});

	const styleElement = document.createElement('style');
	styleElement.id = 'mosaic-elementor-breakpoints';
	styleElement.textContent = css;
	document.head.appendChild(styleElement);

	return true;
};

/**
 * Open and scroll to a specific Elementor panel section.
 *
 * Switches to the given tab (default: 'style') if not already active,
 * then expands the section accordion and scrolls it into view.
 *
 * @param {string} sectionId - Elementor section control ID (e.g. 'sp_title_style_section')
 * @param {string} [tab='style'] - Tab name: 'content' | 'style' | 'advanced'
 */
export const openPanelSection = (sectionId, tab = 'style') => {

	if (typeof elementor === 'undefined') return;
	try {
		// The panel lives in the parent frame.
		const parentWindow = window.parent;
		const parentDocument = parentWindow?.document;
		if (!parentDocument) return;

		const panel = parentDocument.querySelector('#elementor-panel');
		if (!panel) return;

		const clickElement = (element) => {
			if (!element) return;
			element.dispatchEvent(new parentWindow.MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: parentWindow,
			}));
		};

		const expandSection = () => {
			const sectionClassName = `elementor-control-${sectionId}`;
			const section = panel.getElementsByClassName(sectionClassName)[0];
			if (!section) return;

			// Elementor toggles sections by clicking .elementor-section-toggle.
			if (!section.classList.contains('elementor-open')) {
				clickElement(section.querySelector('.elementor-section-toggle'));
			}

			// Scroll after accordion animation starts.
			setTimeout(() => {
				section.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 80);
		};

		const navTab = panel.querySelector(`.elementor-panel-navigation [data-tab="${tab}"]`);
		const isActive = navTab?.classList.contains('elementor-active');

		if (!isActive && navTab) {
			clickElement(navTab);
			// Wait for Elementor to re-render the tab controls before expanding.
			setTimeout(expandSection, 200);
		} else {
			expandSection();
		}
	} catch (e) {
		console.warn('Could not open panel section:', e);
	}
};
