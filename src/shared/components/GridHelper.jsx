/**
 * GridHelper
 *
 * This component renders a repeating linear gradient that can be used
 * as a grid helper when building a grid. It can be used to represent
 * both columns and rows.
 *
 * Helper resource: https://css-shape.com/grid-lines/
 *
 * @param {object} gridSettings - The layout settings for the grid.
 * @param {string} device - The device mode (e.g. desktop, tablet, mobile).
 * @param {array} cols - An array of column counts for the grid.
 * @param {string} type - The type of grid to render. Can be 'front', 'back', or 'none'.
 * @param {string} width - The width of the grid.
 *
 * @return {JSX.Element}
 */
const GridHelper = ({ gridSettings, device, cols, type, width }) => {

	const { itemsMargin: gap = 0, rowHeight = 0 } = gridSettings || {};

	/**
	 * Calculate the width of each column.
	 * If cols is not defined, we don't render any columns.
	 */
	const colWidth = cols ? 100 / cols[device] : 0;

	/**
	 * Define the colors used for the grid.
	 */
	const colorOne = 'rgba(150, 150, 150, 0.18)';
	const colorTwo = 'transparent';

	const backgroundStyle = {
		background: `conic-gradient(from 90deg at ${gap}px ${gap}px,${colorOne} 25%,${colorTwo} 0) 0 0/${colWidth}% ${rowHeight + gap}px`,
		marginLeft: `-${gap}px`,
		width: `calc(100% + ${gap}px)`,
		marginTop: `-${gap}px`,
		height: `calc(100% + ${gap}px)`,
	}

	if (type === 'none') {
		return null;
	}

	return (
		<div className="grid-helper-holder" style={{ width: width, zIndex: type === 'front' ? 2 : 0 }}>
			<div className='grid-helper' style={backgroundStyle} />
		</div>
	);

}
export default GridHelper;
