import { updateElementorSetting } from "../../core/elementor-utils";
import ZIndexControls from "./ZIndexControls";

/**
 * Editor-only controls overlay for a single grid item.
 *
 * Renders the z-index adjuster and the remove-item button.
 *
 * @param {Object} props
 * @param {string}   props.itemId          - Grid item ID (e.g. 'item-0').
 * @param {Object}   props.layoutData      - Full layout data (desktop/tablet/mobile/zindex).
 * @param {string}   props.customLayoutData - Current custom layout JSON string.
 * @param {string}   props.widgetId        - Elementor widget instance ID.
 * @param {Function} props.onRemove        - Called with itemId when the remove button is clicked.
 */
const ItemControls = ({
	settingKey,
	itemId,
	layoutData,
	customLayoutData,
	widgetId,
	widgetType,
	onRemove,
	onManage,
	manageTitle = 'Manage',
}) => (

	<div className="mc4e-item-controls">
		<span style={{ fontSize: "14px" }}>{itemId}</span>
		<ZIndexControls
			itemId={itemId}
			layoutData={layoutData}
			customLayoutData={customLayoutData}
			widgetType={widgetType}
			widgetId={widgetId}
			settingKey={settingKey}
			updateFn={updateElementorSetting}
		/>
		{typeof onManage === 'function' && (
			<button
				type="button"
				className="mc4e-manage-item-btn"
				onMouseDownCapture={(e) => {
					e.stopPropagation();
					e.preventDefault();
					onManage(itemId);
				}}
				title={manageTitle}
			>
				<i className="eicon-image-bold" aria-hidden="true" />
			</button>
		)}
		{layoutData.mobile.length > 1 && (
			<button
				type="button"
				className="mc4e-remove-item-btn"
				onMouseDownCapture={(e) => {
					e.stopPropagation();
					onRemove(itemId);
				}}
				title="Remove Layout Item"
			>
				<i className="eicon-close" aria-hidden="true" />
			</button>
		)}
	</div>
);

export default ItemControls;
