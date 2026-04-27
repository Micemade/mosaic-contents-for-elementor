/**
 * Saved Setups Control Entry Point
 *
 * Registers a custom Elementor control that allows users to save, load,
 * and delete layout+style setups. Communicates with WP Settings API via
 * wp.apiFetch to persist setups in the wp_options table.
 *
 * Runs in the Elementor editor panel (NOT the preview iframe).
 */

import './saved-setups-control.scss';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// ── WP globals available in editor panel context ──────────────────────────
const apiFetch = wp.apiFetch;
const { __ } = wp.i18n;

// ── Widget-specific configuration ─────────────────────────────────────────
// Each widget type has its own WP option key, settings manifest, and channel events.
const WIDGET_CONFIGS = {
	'content-layout': {
		optionKey: 'ml4e_content_layout_setups',
		applySetupEvent: 'mosaic:applySetup',
// Layout settings (React-mapped)
		layoutKeys: [
			'ml4e_layout',
			'ml4e_custom_layout',
			'ml4e_items_margin',
			'ml4e_row_height',
			'ml4e_allow_overlap',
			'ml4e_compaction_type',
			'ml4e_element_ordering',
		],
		// Style settings (React-mapped)
		styleKeys: [
			'ml4e_style_preset',
			'ml4e_product_layout',
			'ml4e_title_size',
			'ml4e_price_size',
			'ml4e_button_size',
			'ml4e_taxonomy_size',
			'ml4e_product_align',
			'ml4e_product_vertical_align',
			'ml4e_featured_image_size',
			'ml4e_featured_image_position',
			'ml4e_image_fit',
			'ml4e_sale_badge_position',
		],
		// Responsive setting keys (have _tablet, _mobile variants)
		responsiveKeys: [
			'ml4e_title_size',
			'ml4e_price_size',
			'ml4e_button_size',
			'ml4e_taxonomy_size',
			'ml4e_product_align',
			'ml4e_product_vertical_align',
			'ml4e_elements_gap',
			'ml4e_padding',
			'ml4e_image_size',
			'ml4e_badge_sale_size',
		],
		// Selector-only style settings (NOT in React mapper but affect visual appearance)
		selectorStyleKeys: [
			'ml4e_elements_gap',
			'ml4e_padding',
			'ml4e_image_size',
			'ml4e_text_color',
			'ml4e_links_color',
			'ml4e_border_radius',
			'ml4e_rating_size',
			'ml4e_badge_sale_size',
			'ml4e_sale_badge_color',
			'ml4e_sale_badge_backcolor',
		],
		// Group control prefixes
		groupControlPrefixes: [
			'ml4e_background_color',
			'ml4e_product_border',
			'ml4e_box_shadow',
		],
	},
};

/**
 * Detect the current widget type from the Elementor panel.
 * @returns {string} Widget type name.
 */
function detectWidgetType() {
	try {
		const panelView = elementor.getPanelView().getCurrentPageView();
		const model = panelView?.model;
		if (model) {
			const widgetType = model.get('widgetType');
			if (widgetType && WIDGET_CONFIGS[widgetType]) {
				return widgetType;
			}
		}
	} catch (e) {
		// fallback
	}
	return 'content-layout'; // default fallback
}

/**
 * Get widget config for the currently open widget.
 * @returns {Object} Widget configuration
 */
function getActiveWidgetConfig() {
	return WIDGET_CONFIGS[detectWidgetType()];
}

// Responsive breakpoint suffixes
const BREAKPOINT_SUFFIXES = ['', '_tablet', '_mobile'];

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Slugify a name for use as setup ID (simplified cleanForSlug).
 */
function slugify(text) {
	return text
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^\w-]+/g, '')
		.replace(/--+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

/**
 * Show Elementor toast notification.
 */
function showToast(message, type = 'success') {
	if (typeof elementor !== 'undefined' && elementor.notifications) {
		elementor.notifications.showToast({
			message,
			// Elementor toasts don't have 'type' but we can use different buttons/durations
		});
	} else {
		console.log(`[ML4E Setup ${type}]:`, message);
	}
}

/**
 * Get the currently open widget model from the Elementor panel.
 * @returns {Object|null} Elementor model or null
 */
function getWidgetModel() {
	try {
		const panelView = elementor.getPanelView().getCurrentPageView();
		return panelView?.model || null;
	} catch (e) {
		return null;
	}
}

/**
 * Read all setup-relevant settings from the Elementor widget model.
 * Returns a flat object of { settingKey: value }.
 * Uses widget-specific key manifests based on the current widget type.
 */
function captureSettingsFromModel(model) {
	if (!model) return {};

	const settingsModel = model.get('settings');
	if (!settingsModel) return {};

	const allAttributes = settingsModel.attributes || {};
	const captured = {};

	const config = getActiveWidgetConfig();

	// Capture layout + style (React-mapped) keys
	const baseKeys = [...config.layoutKeys, ...config.styleKeys, ...config.selectorStyleKeys];

	baseKeys.forEach(key => {
		// For responsive keys, also capture _tablet and _mobile variants
		if (config.responsiveKeys.includes(key)) {
			BREAKPOINT_SUFFIXES.forEach(suffix => {
				const fullKey = key + suffix;
				const value = settingsModel.get(fullKey);
				if (value !== undefined && value !== null) {
					captured[fullKey] = value;
				}
			});
		} else {
			const value = settingsModel.get(key);
			if (value !== undefined && value !== null) {
				captured[key] = value;
			}
		}
	});

	// Also capture responsive keys not already covered by baseKeys.
	// For example, single-product-layout lists per-element text size/alignment
	// keys in responsiveKeys but not in styleKeys.
	config.responsiveKeys.forEach(key => {
		if (!baseKeys.includes(key)) {
			BREAKPOINT_SUFFIXES.forEach(suffix => {
				const fullKey = key + suffix;
				const value = settingsModel.get(fullKey);
				if (value !== undefined && value !== null) {
					captured[fullKey] = value;
				}
			});
		}
	});

	// Capture group control sub-keys by scanning all attributes
	config.groupControlPrefixes.forEach(prefix => {
		Object.keys(allAttributes).forEach(attrKey => {
			if (attrKey.startsWith(prefix)) {
				const value = allAttributes[attrKey];
				if (value !== undefined && value !== null) {
					captured[attrKey] = value;
				}
			}
		});
	});

	return captured;
}

/**
 * Apply setup settings to the Elementor widget model.
 *
 * Delegates to editor-hooks via the widget-specific channel event.
 * editor-hooks has full access to the widget view, model, and widgetManager
 * in the preview iframe context, allowing it to:
 * - Temporarily disable view.renderOnChange (prevent mid-batch DOM destruction)
 * - Temporarily disable change:layoutKey handler (prevent custom_layout clearance)
 * - Batch-set all settings atomically via settingsModel.set()
 * - Push final settings to React and regenerate CSS
 */
function applySettingsToModel(model, settings) {
	if (!model || !settings) return;

	const config = getActiveWidgetConfig();

	// Delegate to editor-hooks which has access to the widget view in the
	// preview iframe — needed to disable renderOnChange during batch.
	elementor.channels.editor.trigger(config.applySetupEvent, {
		widgetId: model.id,
		settings,
	});
}


// ── React Component ───────────────────────────────────────────────────────

/**
 * SavedSetupsUI — React component rendered inside the Elementor panel control.
 *
 * @param {Object} props
 * @param {string} props.initialValue - Initial selected setup ID
 * @param {Function} props.onValueChange - Callback to update Elementor control value
 */
function SavedSetupsUI({ initialValue, onValueChange }) {
	const [setups, setSetups] = useState([]);
	const [selectedId, setSelectedId] = useState(initialValue || '');
	const [newSetupName, setNewSetupName] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState(null);
	const nameInputRef = useRef(null);

	// Determine the WP option key based on which widget is currently open.
	// This is evaluated once on mount — the widget type won't change while
	// the control is rendered.
	const optionKey = useRef(getActiveWidgetConfig().optionKey).current;

	// ── Load setups from WP options on mount ──
	useEffect(() => {
		const controller = new AbortController();
		setError(null);

		apiFetch({ path: '/wp/v2/settings', signal: controller.signal })
			.then(response => {
				const raw = response[optionKey];
				setSetups(raw ? JSON.parse(raw) : []);
			})
			.catch(err => {
				if (err.name === 'AbortError') return;
				console.error('Failed to fetch setups:', err);
				setError(__('Failed to load setups.', 'mosaic-layouts-for-elementor'));
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, []);

	// ── Persist setups to WP options ──
	const persistSetups = useCallback(async (setupsToSave) => {
		setIsSaving(true);
		setError(null);
		try {
			await apiFetch({
				path: '/wp/v2/settings',
				method: 'POST',
				data: { [optionKey]: JSON.stringify(setupsToSave) },
			});
			return true;
		} catch (err) {
			const msg = err.message || __('Failed to save.', 'mosaic-layouts-for-elementor');
			setError(msg);
			showToast(msg, 'error');
			return false;
		} finally {
			setIsSaving(false);
		}
	}, []);

	// ── Save current setup ──
	const handleSave = useCallback(async () => {
		const trimmed = newSetupName.trim();
		if (!trimmed) {
			// Focus the input and show inline feedback
			if (nameInputRef.current) {
				nameInputRef.current.focus();
				nameInputRef.current.classList.add('ml4e-input-error');
				setTimeout(() => nameInputRef.current?.classList.remove('ml4e-input-error'), 1500);
			}
			return;
		}

		const id = slugify(trimmed);
		if (!id) return;

		const model = getWidgetModel();
		if (!model) {
			showToast(__('No widget model found.', 'mosaic-layouts-for-elementor'), 'error');
			return;
		}

		const capturedSettings = captureSettingsFromModel(model);

		const newSetup = {
			id,
			name: trimmed,
			settings: capturedSettings,
		};

		const existingIndex = setups.findIndex(s => s.id === id);
		if (existingIndex !== -1) {
			if (!confirm(
				`${__('Setup', 'mosaic-layouts-for-elementor')} "${trimmed}" ${__('already exists. Overwrite?', 'mosaic-layouts-for-elementor')}`
			)) {
				return;
			}
		}

		const updated = existingIndex !== -1
			? setups.map((s, i) => i === existingIndex ? newSetup : s)
			: [...setups, newSetup];

		const success = await persistSetups(updated);
		if (success) {
			setSetups(updated);
			setSelectedId(id);
			setNewSetupName('');
			onValueChange(id);
			showToast(
				existingIndex !== -1
					? __('Setup updated!', 'mosaic-layouts-for-elementor')
					: __('Setup saved!', 'mosaic-layouts-for-elementor')
			);
		}
	}, [newSetupName, setups, persistSetups, onValueChange]);

	// ── Load selected setup ──
	const handleSelect = useCallback((e) => {
		const id = e.target.value;
		setSelectedId(id);
		onValueChange(id);

		if (!id) return;

		const setup = setups.find(s => s.id === id);
		if (!setup || !setup.settings) return;

		const model = getWidgetModel();
		if (!model) return;

		applySettingsToModel(model, setup.settings);
		showToast(`${__('Loaded:', 'mosaic-layouts-for-elementor')} ${setup.name}`);
	}, [setups, onValueChange]);

	// ── Delete selected setup ──
	const handleDelete = useCallback(async () => {
		if (!selectedId) return;

		const setup = setups.find(s => s.id === selectedId);
		const name = setup?.name || selectedId;

		if (!confirm(
			`${__('Delete setup', 'mosaic-layouts-for-elementor')} "${name}"?`
		)) {
			return;
		}

		const updated = setups.filter(s => s.id !== selectedId);
		const success = await persistSetups(updated);
		if (success) {
			setSetups(updated);
			setSelectedId('');
			onValueChange('');
			showToast(__('Setup deleted.', 'mosaic-layouts-for-elementor'));
		}
	}, [selectedId, setups, persistSetups, onValueChange]);

	// ── Render ──
	if (isLoading) {
		return <div className="ml4e-setups-loading">{__('Loading setups…', 'mosaic-layouts-for-elementor')}</div>;
	}

	return (
		<div className="ml4e-saved-setups-ui">
			{error && <div className="ml4e-setups-error">{error}</div>}

			{/* Select saved setup */}
			<div className="ml4e-setups-select-row">
				<select
					className="ml4e-setups-select"
					value={selectedId}
					onChange={handleSelect}
					disabled={isSaving}
				>
					<option value="">{
						setups.length
							? __('— Select a setup —', 'mosaic-layouts-for-elementor')
							: __('— No saved setups —', 'mosaic-layouts-for-elementor')
					}</option>
					{setups.map(s => (
						<option key={s.id} value={s.id}>{s.name}</option>
					))}
				</select>

				{/* Delete button – only when a setup is selected */}
				{selectedId && (
					<button
						className="ml4e-setups-delete-btn"
						onClick={handleDelete}
						disabled={isSaving}
						title={__('Delete selected setup', 'mosaic-layouts-for-elementor')}
						type="button"
					>
						<i className="eicon-trash-o" />
					</button>
				)}
			</div>

			{/* Save new setup */}
			<div className="ml4e-setups-save-row">
				<input
					ref={nameInputRef}
					className="ml4e-setups-name-input"
					type="text"
					placeholder={__('Setup name…', 'mosaic-layouts-for-elementor')}
					value={newSetupName}
					onChange={(e) => setNewSetupName(e.target.value)}
					onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
					disabled={isSaving}
				/>
				<button
					className="ml4e-setups-save-btn"
					onClick={handleSave}
					disabled={isSaving}
					type="button"
				>
					{isSaving
						? __('Saving…', 'mosaic-layouts-for-elementor')
						: __('Save', 'mosaic-layouts-for-elementor')
					}
				</button>
			</div>
		</div>
	);
}


// ── Elementor Control View Registration ───────────────────────────────────

function initSavedSetupsControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) return;

	const BaseDataControl = elementor.modules.controls.BaseData;
	if (!BaseDataControl) {
		console.error('ML4E: BaseData control not found');
		return;
	}

	const SavedSetupsControl = BaseDataControl.extend({
		onReady() {
			this.initSavedSetups();
		},

		initSavedSetups() {
			const container = this.$el.find('.ml4e-saved-setups-container');
			if (!container.length) return;

			const initialValue = container.data('initial-value') || '';

			this._reactRoot = createRoot(container[0]);
			this._reactRoot.render(
				<SavedSetupsUI
					initialValue={initialValue}
					onValueChange={(val) => this.onSetupValueChange(val)}
				/>
			);
		},

		/**
		 * Update the Elementor control value when a setup is selected/saved/deleted.
		 */
		onSetupValueChange(value) {
			this.setValue(value);
		},

		applySavedValue() {
			BaseDataControl.prototype.applySavedValue.apply(this, arguments);
			// The React component manages its own state from WP options;
			// the control value is just the selected setup ID for reference.
		},

		onBeforeDestroy() {
			if (this._reactRoot) {
				this._reactRoot.unmount();
				this._reactRoot = null;
			}
		},
	});

	elementor.addControlView('ml4e_saved_setups', SavedSetupsControl);
}

// Initialize when Elementor is ready
window.addEventListener('elementor/init', () => {
	initSavedSetupsControl();
});

document.addEventListener('DOMContentLoaded', () => {
	if (typeof elementor !== 'undefined') {
		initSavedSetupsControl();
	}
});
