/**
 * GroupElement Component
 *
 * Renders grouped product elements inside a styled container.
 * The container receives an `elementor-repeater-item-{_id}` class so that
 * Elementor-generated CSS (from the repeater controls) targets it automatically.
 *
 * @module GroupElement
 */

import React from 'react';

/**
 * @param {Object}   props
 * @param {string}   props.groupId       - Grid item ID (e.g. 'group-item-0').
 * @param {Object}   props.grouped       - Map of groupId → [elementItemId, ...].
 * @param {Object}   props.product       - Product data from WC Store API.
 * @param {Function} props.renderElement - Shared renderElement(elementId, product, styles).
 * @param {Object}   props.elementMap    - ELEMENT_MAP constant.
 * @param {Object}   props.repeaterRow   - Matching repeater row object (has _id, group_id, etc.).
 * @param {Object}   props.styles        - Render style props (excerptTruncate, imagePosition, etc.).
 */
const GroupElement = ({
	groupId,
	grouped,
	product,
	renderElement,
	elementMap,
	repeaterRow,
	styles,
	isEditMode
}) => {
	const memberIds = grouped?.[groupId] || [];

	// Map Elementor's flex alignment values to CSS text-align values.
	const alignMap = { 'flex-start': 'left', 'flex-end': 'right', 'center': 'center' };
	const textAlign = alignMap[repeaterRow?.group_align] || 'center';

	if (!product) return null;

	return (
		<div className="elements-wrapper">
			<div className="grouped-elements" style={{ textAlign }}>
				{memberIds.map((itemId) => {
					const def = elementMap[itemId];
					if (!def) return null;
					return (
						<div key={itemId} className={`group-child-element ${def.id}`}>
							{renderElement(def.id, product, styles)}
						</div>
					);
				})}
				{memberIds.length === 0 && isEditMode && (
					<span className="group-empty-hint">
						Elements will be added here
					</span>
				)}
			</div>
		</div>
	);
};

export default GroupElement;
