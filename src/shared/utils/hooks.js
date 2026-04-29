/**
 * Shared Widget Hooks
 *
 * Custom React hooks used across multiple widget components.
 * Keeps widget files focused on rendering logic.
 */

import { useMemo, useState, useEffect } from 'react';
import { getActiveBreakpointNames } from '../../core/elementor-utils';

/**
 * Subscribe to Elementor's device mode switcher (desktop / tablet / mobile).
 *
 * Reads `elementor.channels.deviceMode.request('currentMode')` on mount and
 * re-reads it whenever Elementor fires a `change` event on that channel.
 * Falls back to 'desktop' when running outside the editor (frontend, SSR).
 *
 * @returns {string} Current device mode: 'desktop' | 'tablet' | 'mobile'
 */
export const useElementorDevice = () => {
	const getMode = () => {
		try {
			return elementor?.channels?.deviceMode?.request('currentMode') || 'desktop';
		} catch (_) {
			return 'desktop';
		}
	};

	const [device, setDevice] = useState(getMode);

	useEffect(() => {
		if (typeof elementor === 'undefined' || !elementor?.channels?.deviceMode) return;
		const handler = () => setDevice(getMode());
		elementor.channels.deviceMode.on('change', handler);
		return () => elementor.channels.deviceMode.off('change', handler);
	}, []);

	return device;
};

/**
 * Generate CSS custom properties from responsive Elementor settings.
 *
 * Responsive settings (objects with breakpoint keys) become scoped
 * CSS variables like `--mc4e-title-size-desktop: 26px`.
 * Scalar colour/background/border/shadow values become simple vars.
 *
 * @param {Object} widgetData - Full settings object from Elementor model.
 * @returns {Object} Style object to spread on the widget root element.
 */
export const useCssVariables = (widgetData) => {
	return useMemo(() => {
		const vars = {};
		const breakpoints = getActiveBreakpointNames();

		Object.keys(widgetData).forEach(settingKey => {
			const settingValue = widgetData[settingKey];

			if (settingValue && typeof settingValue === 'object' && !Array.isArray(settingValue)) {

				const hasBreakpoints = breakpoints.some(bp => settingValue.hasOwnProperty(bp));

				if (hasBreakpoints) {
					breakpoints.forEach(breakpoint => {
						const value = settingValue[breakpoint];
						if (value !== undefined && value !== null) {
							const varName = `--${settingKey.replace(/_/g, '-')}-${breakpoint}`;
							if (typeof value === 'object' && value.size !== undefined) {
								vars[varName] = `${value.size}${value.unit || 'px'}`;
							} else if (typeof value === 'string' || typeof value === 'number') {
								vars[varName] = value;
							}
						}
					});
				}
			} else if (typeof settingValue === 'string' || typeof settingValue === 'number') {
				if (settingKey.includes('color') || settingKey.includes('background') ||
					settingKey.includes('border') || settingKey.includes('shadow')) {
					const varName = `--${settingKey.replace(/_/g, '-')}`;
					vars[varName] = settingValue;
				}
			}
		});

		return vars;
	}, [widgetData]);
};

/**
 * Derive grid settings from Elementor widget data.
 *
 * All widgets share the same column structure; only the setting-key
 * prefix differs (e.g. `mc4e_items_margin` vs `mc4e_cat_items_margin`).
 *
 * @param {Object}  widgetData - Full settings object.
 * @param {string}  marginKey  - Setting key for items margin.
 * @param {string}  rowHeightKey - Setting key for row height.
 * @returns {Object} { columns, itemsMargin, rowHeight }
 */
export const useGridSettings = (widgetData, marginKey, rowHeightKey) => {
	return useMemo(
		() => ({
			columns: {
				desktop: 48,
				tablet: 24,
				mobile: 12,
			},
			itemsMargin: widgetData?.[marginKey]?.size || 15,
			rowHeight: widgetData?.[rowHeightKey]?.size || 10,
		}),
		[widgetData?.[marginKey], widgetData?.[rowHeightKey]]
	);
};
