/**
 * Widgets Layout — React component (live-element model).
 *
 * Each grid cell can host any number of real Elementor widgets. Every cell owns
 * a dedicated hidden container (a sibling of this widget, created on demand and
 * deleted when the cell is emptied); dropped widgets are created inside their
 * cell's container and their DOM is re-parented into the matching cell slot.
 * Because the widgets stay real Elementor elements:
 *   - clicking one opens its native Elementor settings panel, and
 *   - edits persist through Elementor's own save pipeline.
 *
 * The widget setting `mc4e_widget_items` only stores the cell assignment and
 * order: [{ i: 'item-0', widgets: [{ id, type }, …] }, …]. The widget's MODEL
 * location (which cell container holds it) is kept in sync with this assignment.
 *
 * Three DnD flows, all separate from RGL's (mouse-based) grid drag:
 *   - Panel-widget drop: Elementor's native DnD is suppressed and we create the
 *     dragged widget ourselves inside the cell's container (createWidgetInCell).
 *   - Click-to-add (+ icon): opens the panel; the next widget Elementor adds is
 *     adopted into the cell's container and recorded (adoptElement).
 *   - Inner-widget DnD: dragging a widget's body reorders it within a cell or
 *     moves it to another cell; the drag source is detected in the dragstart
 *     capture handler (handleRootDragStartCapture).
 *
 * Grid cells are dragged only via a dedicated handle (`.wl-cell-drag-handle`,
 * rendered inside ItemControls) wired to react-grid-layout's draggableHandle.
 */

import React, {
	useMemo,
	useCallback,
	useEffect,
	useLayoutEffect,
	memo,
	useRef,
} from 'react';

import GridLayout from '../../shared/components/GridLayout.jsx';
import ItemControls from '../../shared/components/ItemControls.jsx';
import GridHelper from '../../shared/components/GridHelper.jsx';

import { applyLayoutChange, addGridItem, removeGridItem, selectElementorWidget } from '../../shared/utils/layoutEditing.js';
import { getLayout } from '../../shared/utils/layoutUtils.js';
import { useGridSettings, useElementorDevice } from '../../shared/utils/hooks.js';

import './widgets-layout.scss';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Normalize a stored cell entry to `{ i, widgets: [{ id, type }] }`. */
const normalizeCellEntry = (entry) => {
	if (!entry || !entry.i) return null;
	if (Array.isArray(entry.widgets)) {
		return { i: entry.i, widgets: entry.widgets.filter((w) => w && w.id) };
	}
	return { i: entry.i, widgets: [] };
};

const parseWidgetItems = (raw) => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeCellEntry).filter(Boolean);
	} catch {
		return [];
	}
};

/** Editor globals live in the parent (top) frame from the preview iframe. */
const getEditor = () => {
	const w = window.parent || window;
	return { el: w.elementor, $e: w.$e ?? window.$e };
};

/**
 * Set window.__mc4ePendingCell and schedule a 30-second auto-clear so a
 * cancelled add doesn't leave a stale pending cell.
 */
const setPendingCell = (widgetId, cellId) => {
	window.__mc4ePendingCell = { widgetId, cellId };

	if (window.__mc4ePendingClearTimeout) {
		clearTimeout(window.__mc4ePendingClearTimeout);
	}
	window.__mc4ePendingClearTimeout = setTimeout(() => {
		if (window.__mc4ePendingCell?.widgetId === widgetId) {
			window.__mc4ePendingCell = null;
		}
		window.__mc4ePendingClearTimeout = null;
	}, 30000);
};

/** Open the Elementor elements panel and mark the pending cell for adoption. */
const openWidgetPanel = (widgetId, cellId) => {
	setPendingCell(widgetId, cellId);

	const $e = window.parent?.$e;
	const elementorRef = window.parent?.elementor;

	try {
		if ($e?.run) {
			// Make sure the panel is open, then switch to the elements/widgets tab.
			try { $e.run('panel/open'); } catch { /* panel may already be open */ }
			$e.route('panel/elements/categories');
			return;
		}
	} catch {
		// fall through to the view-level fallback
	}

	try {
		elementorRef?.getPanelView?.()?.setPage?.('elements');
	} catch {
		// not in editor
	}
};

// ─── sub-components ──────────────────────────────────────────────────────────

/**
 * A single widget slot. The real Elementor element's DOM is re-parented into
 * `.wl-widget-mount`; React only owns the controls overlay and the empty mount.
 */
const WidgetSlot = memo(({
	isEditMode,
	widgetId: slotWidgetId,
	onEdit,
	onDragOver,
	onDragLeave,
	onDrop,
}) => {
	if (!isEditMode) {
		return (
			<div className="wl-widget-slot" data-slot-id={slotWidgetId}>
				<div className="wl-widget-mount" />
			</div>
		);
	}

	return (
		<div
			className="wl-widget-slot"
			data-slot-id={slotWidgetId}
			onClick={(e) => {
				e.stopPropagation();
				// Select the innermost real element clicked, so nested widgets
				// inside a Container/Grid cell open their own settings panel.
				const elementEl = e.target.closest?.('.elementor-element[data-id]');
				onEdit(elementEl?.getAttribute('data-id') || slotWidgetId);
			}}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{/* Real Elementor element gets appended here (see reparentAll) */}
			<div className="wl-widget-mount" />
		</div>
	);
});

/** One grid cell: empty-view (click/drop to add) or the ordered widget slots. */
const Cell = memo(({
	isEditMode,
	cellId,
	widgetId,
	widgets,
	onCellDragOver,
	onCellDragLeave,
	onCellDrop,
	onWidgetDragOver,
	onWidgetDragLeave,
	onWidgetDrop,
	onEditWidget,
}) => {
	const hasWidgets = widgets.length > 0;

	if (!isEditMode) {
		return (
			<div className={`wl-item-inner wl-item-filled`}>
				<div className="wl-cell-content">
					{widgets.map((w) => (
						<WidgetSlot key={w.id} isEditMode={false} widgetId={w.id} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`wl-item-inner ${hasWidgets ? 'wl-item-filled' : 'wl-item-empty'}`}
			onDragOver={onCellDragOver}
			onDragLeave={onCellDragLeave}
			onDrop={onCellDrop}
			data-cell-id={cellId}
		>
			{hasWidgets ? (
				<div className="wl-cell-content">
					{widgets.map((w) => (
						<WidgetSlot
							key={w.id}
							isEditMode
							widgetId={w.id}
							onEdit={onEditWidget}
							onDragOver={onWidgetDragOver}
							onDragLeave={onWidgetDragLeave}
							onDrop={(e) => onWidgetDrop(cellId, w.id, e)}
						/>
					))}
				</div>
			) : (
				<div
					className="elementor-empty-view"
					onClick={(e) => { e.stopPropagation(); openWidgetPanel(widgetId, cellId); }}
					title="Click to add a widget"
				>
					<div className="elementor-first-add">
						<div className="elementor-icon eicon-plus" />
					</div>
				</div>
			)}
		</div>
	);
});

// ─── main component ───────────────────────────────────────────────────────────

const WidgetsLayout = ({ widgetData = {}, widgetId = null, mode = 'display' }) => {
	const isEditMode = mode === 'edit';

	// Grid settings
	const gridSettings = useGridSettings(widgetData, 'mc4e_items_margin', 'mc4e_row_height');
	const deviceType   = useElementorDevice();
	const helperType   = widgetData?.mc4e_helper_grid || 'none';

	// Layout data
	const layoutId        = widgetData?.mc4e_layout || 'default';
	const customLayoutData = widgetData?.mc4e_custom_layout || '';

	const layoutData = useMemo(() => {
		if (customLayoutData) {
			try {
				return JSON.parse(customLayoutData);
			} catch {
				return getLayout(layoutId);
			}
		}
		return getLayout(layoutId);
	}, [layoutId, customLayoutData]);

	// Widget items (cell assignment + order; the widgets themselves are real
	// Elementor elements living in their cell's container).
	const widgetItems = useMemo(
		() => parseWidgetItems(widgetData?.mc4e_widget_items),
		[widgetData?.mc4e_widget_items]
	);

	const widgetItemsMap = useMemo(() => {
		const map = new Map();
		widgetItems.forEach((item) => {
			if (item.i) map.set(item.i, item.widgets || []);
		});
		return map;
	}, [widgetItems]);

	// Per-cell style repeater items (each carries a `cell_id` and Elementor `_id`).
	const cellStyleItems = useMemo(() => {
		const raw = widgetData?.mc4e_cell_styles;
		return Array.isArray(raw) ? raw : [];
	}, [widgetData?.mc4e_cell_styles]);

	// cellId → `elementor-repeater-item-{_id}` class, so Elementor's per-item CSS
	// (generated from {{CURRENT_ITEM}}) lands on the matching cell.
	const cellStyleClassMap = useMemo(() => {
		const map = new Map();
		cellStyleItems.forEach((item) => {
			if (item?.cell_id && item?._id) {
				map.set(item.cell_id, `elementor-repeater-item-${item._id}`);
			}
		});
		return map;
	}, [cellStyleItems]);

	const rootRef          = useRef(null);
	const widgetItemsRef   = useRef(widgetItems);
	widgetItemsRef.current = widgetItems;
	const cellStyleItemsRef = useRef(cellStyleItems);
	cellStyleItemsRef.current = cellStyleItems;
	const reconcilingStylesRef = useRef(false);

	// ── per-cell containers + DOM re-parenting ───────────────────────────────

	const getDoc = useCallback(
		() => rootRef.current?.ownerDocument || document,
		[]
	);

	// Per-cell hidden containers: each cell hosts its own widgets in a dedicated
	// container (a sibling of this widget). cellContainersRef caches cellId→id.
	const cellContainersRef = useRef({});
	// Suppress the cell-container add/remove listeners while WE mutate a cell's
	// container (create / adopt / move / remove), since those fire add/remove
	// events that we already account for in storage ourselves. External changes
	// (Elementor duplicate / paste / delete) run with this off and ARE synced.
	const suppressSyncRef = useRef(false);

	const cellMarker = useCallback(
		(cellId) => `mc4e-wlc-${widgetId}-${cellId}`,
		[widgetId]
	);

	/** Find an existing cell container's Container, or null. */
	const getCellContainer = useCallback((cellId) => {
		const { el } = getEditor();
		if (!el) return null;

		const cachedId = cellContainersRef.current[cellId];
		if (cachedId) {
			const c = el.getContainer?.(cachedId);
			if (c) return c;
		}

		const node = getDoc().getElementById(cellMarker(cellId));
		const id = node?.dataset?.id;
		if (!id) return null;
		cellContainersRef.current[cellId] = id;
		return el.getContainer?.(id) || null;
	}, [cellMarker, getDoc]);

	/** Find or lazily create a cell's hidden container; returns its Container. */
	const ensureCellContainer = useCallback((cellId) => {
		const existing = getCellContainer(cellId);
		if (existing) return existing;

		const { el, $e } = getEditor();
		if (!el || !$e || !widgetId) return null;
		const parentContainer = el.getContainer?.(widgetId)?.parent;
		if (!parentContainer) return null;

		let result;
		try {
			result = $e.run('document/elements/create', {
				container: parentContainer,
				model: {
					elType: 'container',
					settings: {
						_element_id: cellMarker(cellId),
						content_width: 'full',
						// Custom Navigator label (Elementor reads `_title`).
						_title: 'Widget Layout Cell',
					},
				},
				options: { edit: false },
			});
		} catch {
			return null;
		}
		const created = Array.isArray(result) ? result[0] : result;
		const newId = created?.id || created?.model?.id;
		if (newId) cellContainersRef.current[cellId] = newId;
		return created || null;
	}, [widgetId, cellMarker, getCellContainer]);

	/** Delete a cell's container once the cell has been emptied. */
	const deleteCellContainer = useCallback((cellId) => {
		const container = getCellContainer(cellId);
		delete cellContainersRef.current[cellId];
		if (!container) return;
		const { $e } = getEditor();
		if ($e) {
			try { $e.run('document/elements/delete', { container }); } catch { /* already gone */ }
		}
	}, [getCellContainer]);

	/** Delete ALL of this widget's cell containers (when the widget is removed). */
	const deleteAllCellContainers = useCallback(() => {
		const { el, $e } = getEditor();
		if (!el || !$e) return;

		const ids = new Set(Object.values(cellContainersRef.current));
		try {
			getDoc().querySelectorAll(`[id^="mc4e-wlc-${widgetId}-"]`).forEach((node) => {
				if (node.dataset?.id) ids.add(node.dataset.id);
			});
		} catch { /* ignore selector issues */ }

		cellContainersRef.current = {};
		ids.forEach((id) => {
			const c = el.getContainer?.(id);
			if (c) {
				try { $e.run('document/elements/delete', { container: c }); } catch { /* already gone */ }
			}
		});
	}, [widgetId, getDoc]);

	/**
	 * Mount the single canonical DOM node for `id` into its cell slot.
	 *
	 * The canonical node is the Elementor view's own element. An Elementor
	 * re-render can leave a second, stale node for the same element behind in
	 * our cells; we delete any such duplicates so a cell never shows two copies.
	 */
	const mountWidget = useCallback((id) => {
		const root = rootRef.current;
		if (!root) return;

		const { el } = getEditor();
		const container = el?.getContainer?.(id);
		const canonical = container?.view?.$el?.[0]
			|| container?.view?.el
			|| getDoc().querySelector(`[data-id="${id}"]`);

		const mount = root.querySelector(`.wl-widget-slot[data-slot-id="${id}"] .wl-widget-mount`);
		if (!mount || !canonical) return;

		// Remove any other DOM node for this element that ended up in our cells.
		root.querySelectorAll(`.wl-widget-mount > [data-id="${id}"]`).forEach((node) => {
			if (node !== canonical) node.remove();
		});

		if (canonical.parentElement !== mount) {
			mount.appendChild(canonical);
		}
	}, [getDoc]);

	/** Re-parent each tracked element into its cell slot, in order. */
	const reparentAll = useCallback(() => {
		widgetItemsRef.current.forEach((cell) => {
			(cell.widgets || []).forEach((w) => mountWidget(w.id));
		});
	}, [mountWidget]);

	// ── persistence ──────────────────────────────────────────────────────────
	const updateWidgetItemsSetting = useCallback((items) => {
		const newJson = JSON.stringify(items);
		const { el, $e } = getEditor();
		const container = el?.getContainer?.(widgetId);

		if ($e && container) {
			try {
				$e.run('document/elements/settings', {
					container,
					settings: { mc4e_widget_items: newJson },
				});
				return;
			} catch {
				// fall through
			}
		}

		if (window.MosaicContentsReact) {
			window.MosaicContentsReact.updateModelSetting(
				'widgets-layout',
				widgetId,
				'mc4e_widget_items',
				newJson
			);
		}
	}, [widgetId]);

	/** Append a widget id/type to a cell (reads the latest stored items). */
	const appendWidgetToCell = useCallback((cellId, id, type) => {
		const items = widgetItemsRef.current.map((c) => ({ i: c.i, widgets: [...(c.widgets || [])] }));
		let cell = items.find((c) => c.i === cellId);
		if (!cell) {
			cell = { i: cellId, widgets: [] };
			items.push(cell);
		}
		if (!cell.widgets.some((w) => w.id === id)) {
			cell.widgets.push({ id, type: type || 'widget' });
		}
		updateWidgetItemsSetting(items);
	}, [updateWidgetItemsSetting]);

	// ── add widget (drag from panel) ─────────────────────────────────────────
	const createWidgetInCell = useCallback((cellId) => {
		if (!isEditMode || !widgetId) return false;

		// Only create during a genuine panel-element drag. This blocks an inner
		// move (or any stray drop) from spawning a new widget off the panel's
		// stale `element:selected`. The seen-ref keeps it a no-op if Elementor's
		// drag event never fires (so real panel drops still work).
		if (panelDragSeenRef.current && !panelDragActiveRef.current) return false;

		const { el, $e } = getEditor();
		if (!el || !$e) return false;

		const dragged = el.channels?.panelElements?.request?.('element:selected');
		const model   = dragged?.model || dragged;
		const elType  = model?.get?.('elType');
		if (!elType) return false;

		const widgetType = model.get('widgetType');
		const newModel   = { elType };
		if (widgetType) newModel.widgetType = widgetType;

		const cellContainer = ensureCellContainer(cellId);
		if (!cellContainer) return false;

		suppressSyncRef.current = true;
		let result;
		try {
			result = $e.run('document/elements/create', {
				container: cellContainer,
				model: newModel,
				options: { edit: false },
			});
		} catch {
			suppressSyncRef.current = false;
			return false;
		}

		const created = Array.isArray(result) ? result[0] : result;
		const newId   = created?.id || created?.model?.id;
		setTimeout(() => { suppressSyncRef.current = false; }, 0);
		if (!newId) return false;

		appendWidgetToCell(cellId, newId, widgetType || elType);
		return true;
	}, [isEditMode, widgetId, ensureCellContainer, appendWidgetToCell]);

	// ── add widget (click-to-add adoption) ───────────────────────────────────
	const adoptElement = useCallback((cellId, node) => {
		const id   = node?.dataset?.id;
		const type = node?.dataset?.widgetType || 'widget';
		if (!id) return;

		const { el, $e } = getEditor();
		const cellContainer = ensureCellContainer(cellId);
		const elContainer   = el?.getContainer?.(id);

		if ($e && cellContainer && elContainer) {
			suppressSyncRef.current = true;
			try {
				$e.run('document/elements/move', { container: elContainer, target: cellContainer });
			} catch {
				// fall through — element stays where it is but is still recorded
			}
			setTimeout(() => { suppressSyncRef.current = false; }, 0);
		}
		appendWidgetToCell(cellId, id, type);
	}, [ensureCellContainer, appendWidgetToCell]);

	// ── inner-widget DnD (reorder within / move between cells) ───────────────
	const dragSourceRef = useRef(null);

	// Holds the data-id of a NESTED element (a child inside a Container cell
	// widget) while it's dragged, so on drop we promote just that element into
	// the target cell instead of moving the whole Container.
	const promoteDragRef = useRef(null);

	// True only while a real Elementor *panel* element is being dragged. Used to
	// gate widget creation so an inner move never spawns a stale new widget.
	const panelDragActiveRef = useRef(false);
	// Becomes true once we've actually observed Elementor's panel-drag event,
	// so the gate stays a no-op (legacy behaviour) if the event never fires.
	const panelDragSeenRef = useRef(false);

	// Arm the inner-drag source as early as possible (pointerdown beats the
	// sometimes-flaky dragstart), so the drop is reliably classified as a move.
	/**
	 * Resolve the source of an inner drag.
	 *
	 * Returns a tagged source when an existing widget is being dragged by its
	 * body (the source is recorded by handleRootDragStartCapture, with a
	 * fallback to Elementor's drag marker in the preview DOM). Returns null for a
	 * genuine new panel-element drag.
	 */
	const resolveDragSource = useCallback(() => {
		// Top-level cell widget dragged (handle or body) → move between/within cells.
		if (dragSourceRef.current) return { kind: 'cell', ...dragSourceRef.current };
		// Nested Container child dragged → promote it into the target cell.
		if (promoteDragRef.current) return { kind: 'promote', widgetId: promoteDragRef.current };

		const doc = getDoc();
		const draggingEl =
			doc.querySelector('.elementor-element.elementor-html5dnd-current-element') ||
			doc.querySelector('.elementor-element.ui-sortable-helper');
		const id = draggingEl?.dataset?.id;
		if (!id) return null;

		const cell = widgetItemsRef.current.find((c) =>
			(c.widgets || []).some((w) => w.id === id)
		);
		return cell ? { kind: 'cell', cellId: cell.i, widgetId: id } : null;
	}, [getDoc]);

	/**
	 * Promote a nested element (e.g. a child of a Container cell) into a target
	 * cell as a top-level widget: move its model into the target cell's container
	 * and record it. reparent then displays it; its old Container is left intact.
	 */
	const promoteWidget = useCallback((targetCellId, id) => {
		promoteDragRef.current = null;
		if (!isEditMode || !id) return;

		const { el, $e } = getEditor();
		const targetContainer = ensureCellContainer(targetCellId);
		const elContainer     = el?.getContainer?.(id);
		if (!$e || !targetContainer || !elContainer) return;

		const type = elContainer.model?.get?.('widgetType') || 'widget';

		suppressSyncRef.current = true;
		try {
			$e.run('document/elements/move', { container: elContainer, target: targetContainer });
		} catch {
			suppressSyncRef.current = false;
			return;
		}
		setTimeout(() => { suppressSyncRef.current = false; }, 0);

		appendWidgetToCell(targetCellId, id, type);
	}, [isEditMode, ensureCellContainer, appendWidgetToCell]);

	const moveWidget = useCallback((source, targetCellId, targetWidgetId, insertAfter = false) => {
		dragSourceRef.current = null;

		if (!source || !isEditMode) return;
		const { cellId: sourceCellId, widgetId: movedId } = source;
		if (!movedId) return;

		const newItems = widgetItems.map((c) => ({ i: c.i, widgets: [...(c.widgets || [])] }));

		const sourceCell = newItems.find((c) => c.i === sourceCellId);
		if (!sourceCell) return;
		const srcIdx = sourceCell.widgets.findIndex((w) => w.id === movedId);
		if (srcIdx < 0) return;
		const [moved] = sourceCell.widgets.splice(srcIdx, 1);

		let targetCell = newItems.find((c) => c.i === targetCellId);
		if (!targetCell) {
			targetCell = { i: targetCellId, widgets: [] };
			newItems.push(targetCell);
		}

		// Insert relative to the target widget — before it, or after it (which,
		// for the last widget, means appending to the end of the cell).
		let insertAt = targetCell.widgets.length;
		if (targetWidgetId) {
			const tIdx = targetCell.widgets.findIndex((w) => w.id === targetWidgetId);
			if (tIdx >= 0) insertAt = insertAfter ? tIdx + 1 : tIdx;
		}
		targetCell.widgets.splice(insertAt, 0, moved);

		// No-op if the widget ends up exactly where it started.
		const finalCell = newItems.find((c) => c.i === sourceCellId);
		if (
			sourceCellId === targetCellId &&
			finalCell?.widgets?.findIndex((w) => w.id === movedId) === srcIdx
		) {
			return;
		}

		// Cross-cell move: relocate the element's MODEL into the target cell's
		// container so the per-cell containers stay in sync with cell assignment.
		if (sourceCellId !== targetCellId) {
			const { el, $e } = getEditor();
			const targetContainer = ensureCellContainer(targetCellId);
			const elContainer     = el?.getContainer?.(movedId);
			if ($e && targetContainer && elContainer) {
				suppressSyncRef.current = true;
				try {
					$e.run('document/elements/move', { container: elContainer, target: targetContainer });
				} catch {
					// keep going — storage is still updated below
				}
				setTimeout(() => { suppressSyncRef.current = false; }, 0);
			}
		}

		updateWidgetItemsSetting(newItems);

		// If the source cell is now empty, remove its (empty) container.
		if (sourceCellId !== targetCellId && (finalCell?.widgets?.length ?? 0) === 0) {
			deleteCellContainer(sourceCellId);
		}
	}, [widgetItems, isEditMode, updateWidgetItemsSetting, ensureCellContainer, deleteCellContainer]);

	/** Whether the pointer is past the vertical midpoint of the drop target. */
	const isAfterMidpoint = (e) => {
		const rect = e.currentTarget.getBoundingClientRect();
		return (e.clientY - rect.top) > rect.height / 2;
	};

	const handleWidgetDragOver = useCallback((e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
		const after = isAfterMidpoint(e);
		e.currentTarget.classList.toggle('wl-widget-drag-over-after', after);
		e.currentTarget.classList.toggle('wl-widget-drag-over', !after);
	}, [isEditMode]);

	const handleWidgetDragLeave = useCallback((e) => {
		e.currentTarget.classList.remove('wl-widget-drag-over', 'wl-widget-drag-over-after');
	}, []);

	const handleWidgetDrop = useCallback((cellId, wId, e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
		const after = isAfterMidpoint(e);
		e.currentTarget.classList.remove('wl-widget-drag-over', 'wl-widget-drag-over-after');

		// Top-level widget → move (before/after target); nested Container child →
		// promote into this cell; otherwise → create.
		const source = resolveDragSource();
		if (source?.kind === 'cell') {
			moveWidget(source, cellId, wId, after);
			return;
		}
		if (source?.kind === 'promote') {
			promoteWidget(cellId, source.widgetId);
			return;
		}
		createWidgetInCell(cellId);
	}, [isEditMode, resolveDragSource, moveWidget, promoteWidget, createWidgetInCell]);

	// ── cell-level drag targets ──────────────────────────────────────────────
	const handleCellDragOver = useCallback((e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
		e.currentTarget.classList.add('wl-drag-over');
	}, [isEditMode]);

	const handleCellDragLeave = useCallback((e) => {
		e.currentTarget.classList.remove('wl-drag-over');
	}, []);

	const handleCellDrop = useCallback((cellId, e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
		e.currentTarget.classList.remove('wl-drag-over');

		// Top-level widget → append to this cell; nested Container child → promote
		// into this cell; otherwise → create.
		const source = resolveDragSource();
		if (source?.kind === 'cell') {
			moveWidget(source, cellId, null);
			return;
		}
		if (source?.kind === 'promote') {
			promoteWidget(cellId, source.widgetId);
			return;
		}
		createWidgetInCell(cellId);
	}, [isEditMode, resolveDragSource, moveWidget, promoteWidget, createWidgetInCell]);

	// Capture ANY drag that begins inside a widget slot (handle OR widget body)
	// so a body drag is treated as an inner move, not a new-widget create.
	// Capture phase runs before Elementor's own bubble-phase dragstart handler.
	const handleRootDragStartCapture = useCallback((e) => {
		if (!isEditMode || dragSourceRef.current) return;
		const slot = e.target?.closest?.('.wl-widget-slot[data-slot-id]');
		if (!slot) return;
		const slotId = slot.getAttribute('data-slot-id');

		// Identify the element actually being dragged. If it's a child element
		// living INSIDE the slot's widget (a nested Container child), promote it
		// on drop instead of moving the whole Container.
		const draggedEl = e.target?.closest?.('.elementor-element[data-id]');
		const draggedId = draggedEl?.getAttribute('data-id');
		if (draggedEl && slot.contains(draggedEl) && draggedId && draggedId !== slotId) {
			promoteDragRef.current = draggedId;
			panelDragActiveRef.current = false;
			return;
		}

		// The slot's own top-level widget (or our drag handle) → cell-level move.
		const cell = widgetItemsRef.current.find((c) =>
			(c.widgets || []).some((w) => w.id === slotId)
		);
		if (cell) {
			dragSourceRef.current = { cellId: cell.i, widgetId: slotId };
			panelDragActiveRef.current = false;
		}
	}, [isEditMode]);

	// Widget-level suppression of Elementor's native DnD over the whole widget.
	const handleRootDragOver = useCallback((e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
	}, [isEditMode]);

	const handleRootDrop = useCallback((e) => {
		if (!isEditMode) return;
		e.preventDefault();
		e.stopPropagation();
	}, [isEditMode]);

	// ── widget edit (open native Elementor settings panel) ─────────────────────
	// A plain DOM .click() does NOT select the element once its DOM has been
	// re-parented out of its model container, so we select it explicitly through
	// Elementor's command API (which opens the element's settings panel).
	const editWidget = useCallback((wId) => {
		if (!isEditMode) return;
		const { el, $e } = getEditor();
		const container = el?.getContainer?.(wId);
		if (!container) return;

		try {
			if ($e?.run) {
				$e.run('document/elements/select', { container });
				return;
			}
		} catch {
			// fall through to view-level fallback
		}

		// Fallback: invoke the element view's own edit handler directly.
		try {
			container.view?.onClickEdit?.({ stopPropagation() {}, preventDefault() {} });
		} catch {
			// give up silently
		}
	}, [isEditMode]);

	// ── edit a cell's per-cell style (open its repeater item in the panel) ─────
	// Selects the widget, reveals the Style tab / Per-Cell Style section and opens
	// the repeater row matching this cell (identified by its Elementor `_id`).
	const editCellStyles = useCallback((cellId) => {
		if (!isEditMode || !widgetId) return;

		const { el, $e } = getEditor();
		const container = el?.getContainer?.(widgetId);
		if (!el || !container) return;

		// Only re-select if this widget's panel isn't already open (selecting
		// re-renders the panel, which is what made this feel slow).
		const alreadyOpen = el.getPanelView?.()?.getCurrentPageView?.()?.model?.id === widgetId;
		if (!alreadyOpen) {
			try { $e?.run?.('document/elements/select', { container }); } catch { /* noop */ }
		}

		const item   = cellStyleItemsRef.current.find((it) => it.cell_id === cellId);
		const itemId = item?._id;
		const parentDoc = window.parent?.document;

		// Recursively collect the panel's control views (mirrors editor-hooks).
		const collectViews = (view, acc = []) => {
			if (!view || acc.includes(view)) return acc;
			acc.push(view);
			if (view.children?._views) {
				Object.values(view.children._views).forEach((c) => collectViews(c, acc));
			}
			if (Array.isArray(view._childViews)) {
				view._childViews.forEach((c) => collectViews(c, acc));
			}
			return acc;
		};

		// Switch the panel to the Style tab by clicking its nav item — this also
		// updates the tab highlight (page.activateTab did not).
		const ensureStyleTab = () => {
			const tab = parentDoc?.querySelector?.(
				'#elementor-panel .elementor-panel-navigation-tab[data-tab="style"]'
			);
			if (!tab) return false;
			if (!tab.classList.contains('elementor-active')) tab.click();
			return true;
		};

		const openRow = () => {
			try {
				const page = el.getPanelView?.()?.getCurrentPageView?.();
				if (!page || page.model?.id !== widgetId) return false;

				const styleReady = ensureStyleTab();
				try { page.activateSection?.('per_cell_style_section'); } catch { /* noop */ }

				const repeaterView = collectViews(page).find(
					(v) => v?.model?.get?.('name') === 'mc4e_cell_styles'
				);
				if (!repeaterView) return false;

				let targetRow = null;
				repeaterView.children?.each?.((rowView) => {
					const m = rowView?.model;
					if (m && (m.get?.('_id') === itemId || m.id === itemId)) targetRow = rowView;
				});
				if (!targetRow) return false;

				if (typeof repeaterView.editRow === 'function') {
					repeaterView.editRow(targetRow);
				} else {
					// DOM fallback: click the row's edit tool / title.
					targetRow.el
						?.querySelector?.('.elementor-repeater-tool-edit, .elementor-repeater-row-item-title')
						?.click?.();
				}
				// Only consider it done once the Style tab is actually active.
				return styleReady;
			} catch {
				return false;
			}
		};

		// Poll quickly (the panel renders async after select) and stop as soon as
		// it opens — far snappier than fixed long timeouts.
		if (!openRow()) {
			let attempts = 0;
			const tick = () => {
				if (openRow() || ++attempts >= 25) return;
				setTimeout(tick, 30);
			};
			setTimeout(tick, 20);
		}
	}, [isEditMode, widgetId]);

	// ── re-parent effects ──────────────────────────────────────────────────────

	// After any render that changes cells/order/layout, re-home the real
	// elements into their slots. useLayoutEffect runs before paint so a moved
	// element never blinks out. Timeouts cover elements Elementor renders late.
	useLayoutEffect(() => {
		reparentAll();
		const t1 = setTimeout(reparentAll, 100);
		const t2 = setTimeout(reparentAll, 400);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [reparentAll, widgetItems, layoutData, deviceType]);

	// Keep the per-cell style repeater (mc4e_cell_styles) in sync with the cells:
	// exactly one item per GridLayout cell id. Runs as cells change (predefined
	// layout switch, add/remove). Convergent — only acts on the diff — and guarded
	// against re-entrancy.
	useEffect(() => {
		if (!isEditMode || !widgetId || reconcilingStylesRef.current) return;

		const { el, $e } = getEditor();
		const container = el?.getContainer?.(widgetId);
		if (!container || !$e) return;

		const cellIds     = (layoutData?.mobile || []).map((it) => it.i).filter(Boolean);
		const items       = cellStyleItemsRef.current;
		const itemCellIds = items.map((it) => it.cell_id);

		const missing  = cellIds.filter((cid) => !itemCellIds.includes(cid));
		const extraIdx = [];
		items.forEach((it, idx) => {
			if (!cellIds.includes(it.cell_id)) extraIdx.push(idx);
		});

		if (!missing.length && !extraIdx.length) return;

		reconcilingStylesRef.current = true;
		try {
			// Remove stale items high→low so indices stay valid.
			extraIdx.sort((a, b) => b - a).forEach((idx) => {
				try {
					$e.run('document/repeater/remove', { container, name: 'mc4e_cell_styles', index: idx });
				} catch { /* ignore */ }
			});
			// Add one item per new cell.
			missing.forEach((cid) => {
				try {
					$e.run('document/repeater/insert', {
						container,
						name: 'mc4e_cell_styles',
						model: { cell_id: cid },
					});
				} catch { /* ignore */ }
			});
		} finally {
			setTimeout(() => { reconcilingStylesRef.current = false; }, 0);
		}
	}, [isEditMode, widgetId, layoutData, cellStyleItems]);

	// React to Elementor (re-)rendering widgets in the preview/page: when a
	// tracked element becomes ready it must be moved (back) into its slot, and
	// in edit mode a pending click-to-add element is adopted.
	useEffect(() => {
		const fe = window.elementorFrontend;
		if (!fe?.hooks?.addAction) return undefined;

		const onWidgetReady = ($scope) => {
			const node = $scope?.[0];
			const id   = node?.dataset?.id;
			if (!id || id === widgetId) return;

			// Adoption: a click-to-add widget Elementor just created for us.
			if (isEditMode) {
				const pending = window.__mc4ePendingCell;
				if (pending && pending.widgetId === widgetId) {
					const alreadyTracked = widgetItemsRef.current.some((c) =>
						(c.widgets || []).some((w) => w.id === id)
					);
					if (!alreadyTracked) {
						window.__mc4ePendingCell = null;
						adoptElement(pending.cellId, node);
						return;
					}
				}
			}

			// Re-parent a tracked element back into its slot after a re-render,
			// keeping only the canonical node (dedupes Elementor re-render clones).
			const tracked = widgetItemsRef.current.some((c) =>
				(c.widgets || []).some((w) => w.id === id)
			);
			if (tracked) {
				mountWidget(id);
			}
		};

		fe.hooks.addAction('frontend/element_ready/widget', onWidgetReady);
		return () => {
			fe.hooks.removeAction?.('frontend/element_ready/widget', onWidgetReady);
		};
	}, [isEditMode, widgetId, adoptElement, mountWidget]);

	// Track panel-element drags (gate for createWidgetInCell) and reliably clear
	// the inner-drag source at the end of any drag / click.
	useEffect(() => {
		if (!isEditMode) return undefined;

		const { el } = getEditor();
		const channel = el?.channels?.panelElements;

		const onPanelSelected = () => {
			panelDragSeenRef.current   = true;
			panelDragActiveRef.current = true;
		};
		// dragend fires AFTER drop, so the gate still sees the drag as active
		// while the drop handler runs.
		const onDragEnd = () => {
			panelDragActiveRef.current = false;
			dragSourceRef.current = null;
			promoteDragRef.current = null;
		};
		const onPointerUp = () => {
			dragSourceRef.current = null;
			promoteDragRef.current = null;
		};

		channel?.on?.('element:selected', onPanelSelected);
		window.addEventListener('dragend', onDragEnd);
		window.addEventListener('pointerup', onPointerUp);

		return () => {
			channel?.off?.('element:selected', onPanelSelected);
			window.removeEventListener('dragend', onDragEnd);
			window.removeEventListener('pointerup', onPointerUp);
		};
	}, [isEditMode]);

	// Keep cell storage in sync with each cell container's children when Elementor
	// changes them outside our flows. We bind 'add'/'remove' to every cell
	// container's child collection so:
	//   - a duplicated/pasted element gets tracked (and rendered into the cell), and
	//   - a natively deleted element restores the empty-view / cleans up the container.
	// (Our own create/adopt/move/remove set suppressSyncRef so they don't double-handle.)
	useEffect(() => {
		if (!isEditMode) return undefined;

		const bound = [];

		const onChildRemove = (cellId) => (childModel) => {
			if (suppressSyncRef.current) return;
			const removedId = childModel?.id || childModel?.get?.('id');
			if (!removedId) return;

			let changed = false;
			const newItems = widgetItemsRef.current.map((c) => ({
				i: c.i,
				widgets: (c.widgets || []).filter((w) => {
					if (w.id === removedId) { changed = true; return false; }
					return true;
				}),
			}));
			if (!changed) return;

			updateWidgetItemsSetting(newItems);
			const cell = newItems.find((c) => c.i === cellId);
			if ((cell?.widgets?.length ?? 0) === 0) {
				deleteCellContainer(cellId);
			}
		};

		const onChildAdd = (cellId) => (childModel) => {
			if (suppressSyncRef.current) return;
			const addedId = childModel?.id || childModel?.get?.('id');
			if (!addedId) return;

			// Skip if already tracked anywhere (avoids double-counting).
			const tracked = widgetItemsRef.current.some((c) =>
				(c.widgets || []).some((w) => w.id === addedId)
			);
			if (tracked) return;

			const type = childModel?.get?.('widgetType') || 'widget';
			appendWidgetToCell(cellId, addedId, type);
		};

		widgetItemsRef.current.forEach((cell) => {
			const container  = getCellContainer(cell.i);
			const collection = container?.model?.get?.('elements');
			if (!collection?.on) return;
			const removeHandler = onChildRemove(cell.i);
			const addHandler    = onChildAdd(cell.i);
			collection.on('remove', removeHandler);
			collection.on('add', addHandler);
			bound.push([collection, removeHandler, addHandler]);
		});

		return () => bound.forEach(([collection, removeHandler, addHandler]) => {
			collection.off('remove', removeHandler);
			collection.off('add', addHandler);
		});
	}, [isEditMode, getCellContainer, deleteCellContainer, updateWidgetItemsSetting, appendWidgetToCell, widgetItems]);

	// When the Widgets Layout widget itself is deleted, remove its orphaned cell
	// containers. Guarded by an existence check so MOVING the widget (which also
	// fires 'remove' on its model) does not wipe the cells.
	useEffect(() => {
		if (!isEditMode || !widgetId) return undefined;

		const { el } = getEditor();
		const model = el?.getContainer?.(widgetId)?.model;
		if (!model?.on) return undefined;

		const onGone = () => {
			setTimeout(() => {
				if (!getEditor().el?.getContainer?.(widgetId)) {
					deleteAllCellContainers();
				}
			}, 0);
		};

		model.on('destroy', onGone);
		model.on('remove', onGone);
		return () => {
			model.off('destroy', onGone);
			model.off('remove', onGone);
		};
	}, [isEditMode, widgetId, deleteAllCellContainers]);

	// Select this widget in the Elementor editor (called by GridLayout on drag start)
	const selectWidget = () => {
		selectElementorWidget({ isEditMode, widgetId, widgetClass: 'widgets-layout' });
	};

	// ── grid layout handlers (same pattern as content-layout) ────────────────

	const handleLayoutChange = (newLayouts) => {
		applyLayoutChange({
			widgetType: 'widgets-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			newLayouts,
		});
	};

	const handleAddItem = () => {
		addGridItem({
			isEditMode,
			widgetType: 'widgets-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			gridColumns: {
				desktop: gridSettings.columns.desktop,
				tablet:  gridSettings.columns.tablet,
				mobile:  gridSettings.columns.mobile,
			},
		});
	};

	const handleRemoveItem = (itemId) => {
		// Delete any real widgets hosted in this cell first.
		const { el, $e } = getEditor();
		const cellWidgets = widgetItemsMap.get(itemId) || [];
		cellWidgets.forEach((w) => {
			const container = el?.getContainer?.(w.id);
			if ($e && container) {
				try { $e.run('document/elements/delete', { container }); } catch { /* noop */ }
			}
		});

		removeGridItem({
			isEditMode,
			widgetType: 'widgets-layout',
			widgetId,
			settingKey: 'mc4e_custom_layout',
			customLayoutData,
			layoutData,
			itemId,
		});

		const newItems = widgetItems.filter((item) => item.i !== itemId);
		if (newItems.length !== widgetItems.length) {
			updateWidgetItemsSetting(newItems);
		}
	};

	// ── render ────────────────────────────────────────────────────────────────

	return (
		<div
			ref={rootRef}
			className="widgets-layout mosaic-content-layouts-widgets mosaic-content-layouts"
			data-widget-id={widgetId}
			onDragStartCapture={isEditMode ? handleRootDragStartCapture : undefined}
			onDragOver={isEditMode ? handleRootDragOver : undefined}
			onDrop={isEditMode ? handleRootDrop : undefined}
		>
			<GridLayout
				layouts={layoutData}
				columns={gridSettings.columns}
				itemsMargin={gridSettings.itemsMargin}
				rowHeight={gridSettings.rowHeight}
				allowOverlap={widgetData?.mc4e_allow_overlap || false}
				compactionType={widgetData?.mc4e_compaction_type || 'vertical'}
				context={isEditMode ? 'edit' : 'frontend'}
				isDraggable={isEditMode}
				isResizable={isEditMode}
				onLayoutChange={isEditMode ? handleLayoutChange : undefined}
				selectWidget={selectWidget}
				draggableHandle=".wl-cell-drag-handle"
			>
				{layoutData.mobile.map((layoutItem) => {
					const widgets       = widgetItemsMap.get(layoutItem.i) || [];
					const zIndex        = layoutData.zindex?.[layoutItem.i] || 0;
					const repeaterClass = cellStyleClassMap.get(layoutItem.i) || '';

					return (
						<div
							key={layoutItem.i}
							className={`wl-item ${!widgets.length ? 'no-widgets' : 'has-widgets'}  ${repeaterClass}`.trim()}
							style={{ zIndex }}
						>
							{isEditMode && (
								<>
									{/* Grid-level item controls (drag handle, z-index, remove cell) */}
									<ItemControls
										settingKey="mc4e_custom_layout"
										itemId={layoutItem.i}
										hideItemId={true}
										layoutData={layoutData}
										customLayoutData={customLayoutData}
										widgetId={widgetId}
										widgetType="widgets-layout"
										onRemove={handleRemoveItem}
										collapsible
										dragHandleClassName="wl-cell-drag-handle"
										onEditCell={editCellStyles}
									/>

								</>
							)}

							<Cell
								isEditMode={isEditMode}
								cellId={layoutItem.i}
								widgetId={widgetId}
								widgets={widgets}
								onCellDragOver={handleCellDragOver}
								onCellDragLeave={handleCellDragLeave}
								onCellDrop={(e) => handleCellDrop(layoutItem.i, e)}
								onWidgetDragOver={handleWidgetDragOver}
								onWidgetDragLeave={handleWidgetDragLeave}
								onWidgetDrop={handleWidgetDrop}
								onEditWidget={editWidget}
							/>
						</div>
					);
				})}
			</GridLayout>

			{isEditMode && (
				<>
					<div className="mc4e-editor-toolbar">
						<button
							type="button"
							className="mc4e-toolbar-btn mc4e-add-item-btn"
							onClick={handleAddItem}
							title="Add Grid Cell"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span>Add Cell</span>
						</button>
					</div>

					<GridHelper
						gridSettings={gridSettings}
						device={deviceType}
						cols={gridSettings.columns}
						type={helperType}
					/>
				</>
			)}
		</div>
	);
};

export default memo(WidgetsLayout);
