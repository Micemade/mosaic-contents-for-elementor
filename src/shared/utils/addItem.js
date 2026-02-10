/**
 * WordPress dependencies.
 */
import { Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { element } from "prop-types";

const AddItem = ({ attributes, setAttributes, devices, variant, label, itemType = 'regular' }) => {

	const onAddItem = (attributes, setAttributes) => {

		const { savedLayouts, gridSettings, itemZindexes, productElementSettings, grouped } = attributes;

		const layoutsToEdit = JSON.parse(savedLayouts);

		// For 'group' item type (Single product) append 'group-item-', otherwise 'item-'
		const itemPrefix = itemType === 'group' ? itemType + '-item-' : 'item-';


		// Find the highest existing item number
		const getHighestItemNumber = () => {
			const allItems = Object.values(layoutsToEdit).flat();
			const itemNumbers = allItems.map(item => {
				// Use different regex patterns based on item type
				const pattern = itemType === 'group' ? /group-item-(\d+)/ : /^item-(\d+)/;
				const match = item.i.match(pattern);
				return match ? parseInt(match[1]) : 0;
			});
			return Math.max(...itemNumbers, 0);
		};

		// Get new count based on highest item number for the specific type
		const newCount = getHighestItemNumber() + 1;

		// Find the highest z-index value
		const highestZIndex = Object.values(itemZindexes || {}).reduce((max, current) =>
			Math.max(max, current), 0
		);

		const buildNewItem = (device) => {
			const gridWidth = gridSettings.cols[device];
			const existingLayouts = layoutsToEdit[device];

			// Get dimensions from the last item
			const lastItem = existingLayouts[existingLayouts.length - 1];
			const itemWidth = lastItem ? lastItem.w : 16;
			const itemHeight = lastItem ? lastItem.h : 20;

			// Sort layouts by position (top to bottom, left to right)
			const sortedLayouts = [...existingLayouts].sort((a, b) => {
				if (a.y === b.y) return a.x - b.x;
				return a.y - b.y;
			});

			// Find gaps between items
			for (let i = 0; i < sortedLayouts.length - 1; i++) {
				const current = sortedLayouts[i];
				const next = sortedLayouts[i + 1];

				if (itemType === 'group') {
					return {
						i: itemPrefix + newCount,
						x: 10,
						y: 10,
						w: 20,
						h: 20,
					}
				}

				// Check horizontal gap on the same row
				if (Math.abs(current.y - next.y) < itemHeight) {
					const gapX = next.x - (current.x + current.w);
					if (gapX >= itemWidth) {
						return {
							i: itemPrefix + newCount,
							x: current.x + current.w,
							y: current.y,
							w: itemWidth,
							h: itemHeight,
						};
					}
				}

				// Check gap below current item
				const itemsInNextRow = sortedLayouts.filter(item =>
					item.y > current.y + current.h &&
					item.y < current.y + current.h + itemHeight
				);

				if (itemsInNextRow.length === 0) {
					// Check if there's enough horizontal space
					const itemsInCurrentRow = sortedLayouts.filter(item =>
						Math.abs(item.y - current.y) < itemHeight
					);
					const rightmostX = Math.max(...itemsInCurrentRow.map(item => item.x + item.w));

					if (rightmostX + itemWidth <= gridWidth) {
						return {
							i: itemPrefix + newCount,
							x: rightmostX,
							y: current.y,
							w: itemWidth,
							h: itemHeight,
						};
					}
				}
			}

			// If no suitable gap is found, place it at the end
			const maxX = Math.max(...existingLayouts.map(layout => layout.x + layout.w));
			const maxY = Math.max(...existingLayouts.map(layout => layout.y + layout.h));

			// Try to place the item to the right of the last item first
			if (maxX + itemWidth <= gridWidth) {
				return {
					i: itemPrefix + newCount,
					x: maxX,
					y: maxY - itemHeight, // Align with the last row
					w: itemWidth,
					h: itemHeight,
				};
			}

			// If there's no space to the right, place it below
			return {
				i: itemPrefix + newCount,
				x: 0,
				y: maxY,
				w: itemWidth,
				h: itemHeight,
			};
		};

		const updatedLayoutsToEdit = devices.reduce((acc, device) => {
			acc[device] = [...layoutsToEdit[device], buildNewItem(device)];
			return acc;
		}, {});


		setAttributes({
			// Add a new item. It must have a unique key!
			savedLayouts: JSON.stringify(updatedLayoutsToEdit),
			startLayout: 'none',
			itemZindexes: {
				...itemZindexes,
				[`${itemPrefix}${newCount}`]: highestZIndex + 1
			},
			...(itemType === 'group' && {
				productElementSettings: {
					...productElementSettings,
					elements: [
						...productElementSettings.elements,
						{
							i: `${itemPrefix}${newCount}`,
							id: `${itemType}-${newCount}`,
							name: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} ${newCount}`,
							visible: devices,
							sort: false
						}
					],
					[`${itemType}-${newCount}Style`]: {
						// Add any default style properties here
						align: "center",
						valign: "center",
						backColor: '#ffffff',
						padding: { "top": "0.5em", "left": "0.5em", "right": "0.5em", "bottom": "0.5em" },
						border: { "width": "1px", "color": "rgba(200,200,200,0.8)", "style": "solid" },
						radius: "0px",
						boxShadow: "0px 0px 0px #0000001A",
						gap: '5px'
					}
				}
			})
		});

	}

	return (
		<Button
			variant={variant}
			onClick={() => onAddItem(attributes, setAttributes)}
			text={label}
			size="compact"
			className="mosaic-product-layouts-add-item"
		/>
	);
}

export default AddItem;
