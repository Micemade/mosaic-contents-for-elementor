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
 *   - Inner-widget DnD: a per-widget handle reorders widgets within a cell and
 *     moves them between cells (tagged with the `mc4e/inner-widget` type).
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
	cellId,
	widgetId: slotWidgetId,
	onRemove,
	onEdit,
	onPointerDown,
	onDragStart,
	onDragEnd,
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
			{/* Controls must not bubble a click up to the widget-select handler */}
			<div className="wl-widget-controls" onClick={(e) => e.stopPropagation()}>
				{/* Drag handle — HTML5 drag, never triggers the RGL cell drag */}
				<span
					className="wl-widget-handle"
					draggable="true"
					onPointerDown={onPointerDown}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					title="Drag to reorder or move widget"
				>
					<i className="eicon-ellipsis-v" aria-hidden="true" />
				</span>

				<button
					type="button"
					className="wl-widget-remove-btn"
					onClick={() => onRemove(cellId, slotWidgetId)}
					title="Remove widget"
				>
					<i className="eicon-trash" aria-hidden="true" />
				</button>
			</div>

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
	onWidgetPointerDown,
	onWidgetDragStart,
	onWidgetDragEnd,
	onWidgetDragOver,
	onWidgetDragLeave,
	onWidgetDrop,
	onRemoveWidget,
	onEditWidget,
}) => {
	const hasWidgets = widgets.length > 0;

	if (!isEditMode) {
		return (
			<div className="wl-item-inner wl-item-filled">
				<div className="wl-cell-content">
					{widgets.map((w) => (
						<WidgetSlot key={w.id} isEditMode={false} cellId={cellId} widgetId={w.id} />
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
							cellId={cellId}
							widgetId={w.id}
							onRemove={onRemoveWidget}
							onEdit={onEditWidget}
							onPointerDown={() => onWidgetPointerDown(cellId, w.id)}
							onDragStart={(e) => onWidgetDragStart(cellId, w.id, e)}
							onDragEnd={onWidgetDragEnd}
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

	const rootRef        = useRef(null);
	const widgetItemsRef = useRef(widgetItems);
	widgetItemsRef.current = widgetItems;

	// ── per-cell containers + DOM re-parenting ───────────────────────────────

	const getDoc = useCallback(
		() => rootRef.current?.ownerDocument || document,
		[]
	);

	// Per-cell hidden containers: each cell hosts its own widgets in a dedicated
	// container (a sibling of this widget). cellContainersRef caches cellId→id.
	const cellContainersRef = useRef({});
	// Suppress the delete-prune listener while WE relocate an element's model
	// (a cross-cell move fires the source container's 'remove' which is not a
	// real deletion).
	const suppressPruneRef = useRef(false);

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

		let result;
		try {
			result = $e.run('document/elements/create', {
				container: cellContainer,
				model: newModel,
				options: { edit: false },
			});
		} catch {
			return false;
		}

		const created = Array.isArray(result) ? result[0] : result;
		const newId   = created?.id || created?.model?.id;
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
			try {
				$e.run('document/elements/move', { container: elContainer, target: cellContainer });
			} catch {
				// fall through — element stays where it is but is still recorded
			}
		}
		appendWidgetToCell(cellId, id, type);
	}, [ensureCellContainer, appendWidgetToCell]);

	// ── inner-widget DnD (reorder within / move between cells) ───────────────
	const dragSourceRef = useRef(null);

	// True only while a real Elementor *panel* element is being dragged. Used to
	// gate widget creation so an inner move never spawns a stale new widget.
	const panelDragActiveRef = useRef(false);
	// Becomes true once we've actually observed Elementor's panel-drag event,
	// so the gate stays a no-op (legacy behaviour) if the event never fires.
	const panelDragSeenRef = useRef(false);

	// Arm the inner-drag source as early as possible (pointerdown beats the
	// sometimes-flaky dragstart), so the drop is reliably classified as a move.
	const handleWidgetPointerDown = useCallback((cellId, wId) => {
		dragSourceRef.current = { cellId, widgetId: wId };
		// An inner drag is never a panel drag — make sure the create gate is shut.
		panelDragActiveRef.current = false;
	}, []);

	const handleWidgetDragStart = useCallback((cellId, wId, e) => {
		dragSourceRef.current = { cellId, widgetId: wId };
		e.dataTransfer.setData('mc4e/inner-widget', wId);
		e.dataTransfer.effectAllowed = 'move';
		e.stopPropagation();
	}, []);

	const handleWidgetDragEnd = useCallback(() => {
		dragSourceRef.current = null;
	}, []);

	/**
	 * Resolve the source of an inner drag.
	 *
	 * Returns `{ cellId, widgetId }` when an existing tracked widget is being
	 * dragged — either via our handle (dragSourceRef) or by its body, in which
	 * case Elementor flags the dragged element in the preview DOM. Returns null
	 * for a genuine new panel-element drag.
	 */
	const resolveDragSource = useCallback(() => {
		if (dragSourceRef.current) return dragSourceRef.current;

		const doc = getDoc();
		const draggingEl =
			doc.querySelector('.elementor-element.elementor-html5dnd-current-element') ||
			doc.querySelector('.elementor-element.ui-sortable-helper');
		const id = draggingEl?.dataset?.id;
		if (!id) return null;

		const cell = widgetItemsRef.current.find((c) =>
			(c.widgets || []).some((w) => w.id === id)
		);
		return cell ? { cellId: cell.i, widgetId: id } : null;
	}, [getDoc]);

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
				suppressPruneRef.current = true;
				try {
					$e.run('document/elements/move', { container: elContainer, target: targetContainer });
				} catch {
					// keep going — storage is still updated below
				}
				setTimeout(() => { suppressPruneRef.current = false; }, 0);
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

		// Existing widget (handle or body drag) → move (before/after the target);
		// otherwise it's a new panel widget → create.
		const source = resolveDragSource();
		if (source) {
			moveWidget(source, cellId, wId, after);
			return;
		}
		createWidgetInCell(cellId);
	}, [isEditMode, resolveDragSource, moveWidget, createWidgetInCell]);

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

		// Existing widget (handle or body drag) → append to this cell; otherwise
		// it's a new panel widget → create.
		const source = resolveDragSource();
		if (source) {
			moveWidget(source, cellId, null);
			return;
		}
		createWidgetInCell(cellId);
	}, [isEditMode, resolveDragSource, moveWidget, createWidgetInCell]);

	// Capture ANY drag that begins inside a widget slot (handle OR widget body)
	// so a body drag is treated as an inner move, not a new-widget create.
	// Capture phase runs before Elementor's own bubble-phase dragstart handler.
	const handleRootDragStartCapture = useCallback((e) => {
		if (!isEditMode || dragSourceRef.current) return;
		const slot = e.target?.closest?.('.wl-widget-slot[data-slot-id]');
		if (!slot) return;
		const id = slot.getAttribute('data-slot-id');
		const cell = widgetItemsRef.current.find((c) =>
			(c.widgets || []).some((w) => w.id === id)
		);
		if (cell) {
			dragSourceRef.current = { cellId: cell.i, widgetId: id };
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

	// ── widget remove ─────────────────────────────────────────────────────────
	const handleRemoveWidget = useCallback((cellId, wId) => {
		// We prune storage ourselves here, so silence the collection listener.
		suppressPruneRef.current = true;

		// Delete the real Elementor element, then drop it from cell storage.
		const { el, $e } = getEditor();
		const container  = el?.getContainer?.(wId);
		if ($e && container) {
			try {
				$e.run('document/elements/delete', { container });
			} catch {
				// ignore — element may already be gone
			}
		}

		const newItems = widgetItems.map((c) => (
			c.i === cellId
				? { ...c, widgets: (c.widgets || []).filter((w) => w.id !== wId) }
				: c
		));
		updateWidgetItemsSetting(newItems);

		// Emptied the cell → remove its now-empty container.
		const cell = newItems.find((c) => c.i === cellId);
		if ((cell?.widgets?.length ?? 0) === 0) {
			deleteCellContainer(cellId);
		}

		setTimeout(() => { suppressPruneRef.current = false; }, 0);
	}, [widgetItems, updateWidgetItemsSetting, deleteCellContainer]);

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
		};
		const onPointerUp = () => { dragSourceRef.current = null; };

		channel?.on?.('element:selected', onPanelSelected);
		window.addEventListener('dragend', onDragEnd);
		window.addEventListener('pointerup', onPointerUp);

		return () => {
			channel?.off?.('element:selected', onPanelSelected);
			window.removeEventListener('dragend', onDragEnd);
			window.removeEventListener('pointerup', onPointerUp);
		};
	}, [isEditMode]);

	// Prune a widget from storage when its real element is deleted via Elementor's
	// own "Delete" control. We bind a 'remove' listener to every cell container's
	// child collection so the cell's empty-view is restored and the container is
	// cleaned up once its last widget is gone. (Our own remove button and moves
	// set suppressPruneRef so they don't double-handle here.)
	useEffect(() => {
		if (!isEditMode) return undefined;

		const { el } = getEditor();
		const bound = [];

		const onChildRemove = (cellId) => (childModel) => {
			if (suppressPruneRef.current) return;
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

		widgetItemsRef.current.forEach((cell) => {
			const container  = getCellContainer(cell.i);
			const collection = container?.model?.get?.('elements');
			if (!collection?.on) return;
			const handler = onChildRemove(cell.i);
			collection.on('remove', handler);
			bound.push([collection, handler]);
		});

		return () => bound.forEach(([collection, handler]) => collection.off('remove', handler));
	}, [isEditMode, getCellContainer, deleteCellContainer, updateWidgetItemsSetting, widgetItems]);

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
					const widgets = widgetItemsMap.get(layoutItem.i) || [];

					return (
						<div
							key={layoutItem.i}
							className={`wl-item ${!widgets.length ? 'no-widgets' : 'has-widgets'}`}
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
										removeButtonClassName="mc4e-cell-edit"
									/>
									<span
										className="wl-cell-drag-handle"
										title="Drag to move cell"
										aria-label="Drag to move cell"
									>
										<i className="eicon-drag-n-drop" aria-hidden="true" />
									</span>
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
								onWidgetPointerDown={handleWidgetPointerDown}
								onWidgetDragStart={handleWidgetDragStart}
								onWidgetDragEnd={handleWidgetDragEnd}
								onWidgetDragOver={handleWidgetDragOver}
								onWidgetDragLeave={handleWidgetDragLeave}
								onWidgetDrop={handleWidgetDrop}
								onRemoveWidget={handleRemoveWidget}
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
