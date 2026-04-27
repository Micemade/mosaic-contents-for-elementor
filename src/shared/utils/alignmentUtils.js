import { getActiveBreakpointNames } from '../../core/elementor-utils';

const FLEX_TO_TEXT_ALIGN = {
	'flex-start': 'left',
	'flex-end': 'right',
	center: 'center',
};

/**
 * Build CSS variable map for breakpoint text alignment based on flex alignment settings.
 *
 * @param {Object} alignSetting Responsive align object keyed by breakpoint.
 * @param {string} cssVarPrefix CSS variable prefix, e.g. '--ml4e-product-align-text-'.
 * @returns {Object}
 */
export const getBreakpointTextAlignVars = (alignSetting, cssVarPrefix) => {
	const vars = {};

	if (!alignSetting || typeof alignSetting !== 'object') {
		return vars;
	}

	getActiveBreakpointNames().forEach((bp) => {
		const mapped = FLEX_TO_TEXT_ALIGN[alignSetting[bp]];
		if (mapped) {
			vars[`${cssVarPrefix}${bp}`] = mapped;
		}
	});

	return vars;
};
