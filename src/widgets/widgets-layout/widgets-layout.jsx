/**
 * Widgets Layout — React component (live-element model).
 *
 * Each grid cell can host any number of real Elementor widgets. Dropped widgets
 * are created as real elements inside a hidden "holding" container (a sibling
 * container of this widget) and their DOM is then re-parented into the matching
 * cell slot. Because the widgets stay real Elementor elements:
 *   - clicking one opens its native Elementor settings panel, and
 *   - edits persist through Elementor's own save pipeline.
 *
 * The widget setting `mc4e_widget_items` only stores the cell assignment and
 * order: [{ i: 'item-0', widgets: [{ id, type }, …] }, …].
 *
 * Three DnD flows, all separate from RGL's (mouse-based) grid drag:
 *   - Panel-widget drop: Elementor's native DnD is suppressed and we create the
 *     dragged widget ourselves inside the holding container (createWidgetInCell).
 *   - Click-to-add (+ icon): opens the panel; the next widget Elementor adds is
 *     adopted into the holding container and recorded (adoptElement).
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
	// Elementor elements living in the holding container).
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

	// ── holding-container + DOM re-parenting ─────────────────────────────────

	const holdingMarkerId = `mc4e-wlh-${widgetId}`;

	const getDoc = useCallback(
		() => rootRef.current?.ownerDocument || document,
		[]
	);

	/** Locate (or lazily create) the hidden holding container; returns its Container. */
	const ensureHoldingContainer = useCallback(() => {
		const { el, $e } = getEditor();
		if (!el || !$e || !widgetId) return null;

		const existing = getDoc().getElementById(holdingMarkerId);
		if (existing?.dataset?.id) {
			const c = el.getContainer?.(existing.dataset.id);
			if (c) return c;
		}

		const ourContainer    = el.getContainer?.(widgetId);
		const parentContainer = ourContainer?.parent;
		if (!parentContainer) return null;

		let result;
		try {
			result = $e.run('document/elements/create', {
				container: parentContainer,
				model: {
					elType: 'container',
					settings: { _element_id: holdingMarkerId, content_width: 'full' },
				},
				options: { edit: false },
			});
		} catch {
			return null;
		}
		return Array.isArray(result) ? result[0] : result;
	}, [widgetId, holdingMarkerId, getDoc]);

	/** Inner node of the holding container where parked elements are stashed. */
	const getHoldingInner = useCallback(() => {
		const holdingEl = getDoc().getElementById(holdingMarkerId);
		if (!holdingEl) return null;
		return holdingEl.querySelector(':scope > .e-con-inner') || holdingEl;
	}, [holdingMarkerId, getDoc]);

	/** Move every cell-mounted real element back into the holding container. */
	const parkAllElements = useCallback(() => {
		const inner = getHoldingInner();
		const root  = rootRef.current;
		if (!inner || !root) return;
		root.querySelectorAll('.wl-widget-mount > .elementor-element').forEach((node) => {
			inner.appendChild(node);
		});
	}, [getHoldingInner]);

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
		// Stash live elements in the holding container first so the upcoming
		// React re-render can freely tear down / rebuild cell slots without
		// destroying real element DOM. reparentAll re-homes them afterwards.
		parkAllElements();

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
	}, [widgetId, parkAllElements]);

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

		const holding = ensureHoldingContainer();
		if (!holding) return false;

		let result;
		try {
			result = $e.run('document/elements/create', {
				container: holding,
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
	}, [isEditMode, widgetId, ensureHoldingContainer, appendWidgetToCell]);

	// ── add widget (click-to-add adoption) ───────────────────────────────────
	const adoptElement = useCallback((cellId, node) => {
		const id   = node?.dataset?.id;
		const type = node?.dataset?.widgetType || 'widget';
		if (!id) return;

		const { el, $e } = getEditor();
		const holding    = ensureHoldingContainer();
		const elContainer = el?.getContainer?.(id);

		if ($e && holding && elContainer) {
			try {
				$e.run('document/elements/move', { container: elContainer, target: holding });
			} catch {
				// fall through — element stays where it is but is still recorded
			}
		}
		appendWidgetToCell(cellId, id, type);
	}, [ensureHoldingContainer, appendWidgetToCell]);

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

		updateWidgetItemsSetting(newItems);
	}, [widgetItems, isEditMode, updateWidgetItemsSetting]);

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
	}, [widgetItems, updateWidgetItemsSetting]);

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
	// elements into their slots (with a couple of retries to cover the case
	// where Elementor renders the element a tick later).
	useEffect(() => {
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

	// Prune a widget from storage when its real element is deleted — whether via
	// our remove button or Elementor's own "Delete" control. Listening on the
	// holding container's child collection covers both paths, so the cell's
	// empty-view is restored once its last widget is gone.
	useEffect(() => {
		if (!isEditMode) return undefined;

		const { el } = getEditor();
		const holdingEl = getDoc().getElementById(holdingMarkerId);
		const holdingId = holdingEl?.dataset?.id;
		if (!holdingId) return undefined;

		const container  = el?.getContainer?.(holdingId);
		const collection = container?.model?.get?.('elements');
		if (!collection?.on) return undefined;

		const onChildRemove = (childModel) => {
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
			if (changed) updateWidgetItemsSetting(newItems);
		};

		collection.on('remove', onChildRemove);
		return () => collection.off('remove', onChildRemove);
	}, [isEditMode, holdingMarkerId, getDoc, updateWidgetItemsSetting, widgetItems]);

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
						<div key={layoutItem.i} className="wl-item">
							{isEditMode && (
								/* Grid-level item controls (drag handle, z-index, remove cell) */
								<ItemControls
									settingKey="mc4e_custom_layout"
									itemId={layoutItem.i}
									hideItemId={true}
									layoutData={layoutData}
									customLayoutData={customLayoutData}
									widgetId={widgetId}
									widgetType="widgets-layout"
									onRemove={handleRemoveItem}
									dragHandleClassName="wl-cell-drag-handle"
									collapsible
									removeButtonClassName="mc4e-cell-edit"
								/>
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
