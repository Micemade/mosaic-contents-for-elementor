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
		optionKey: 'mc4e_content_layout_setups',
		applySetupEvent: 'mosaic:applySetup',

		// Layout settings (React-mapped)
		layoutKeys: [
			'mc4e_layout',
			'mc4e_custom_layout',
			'mc4e_items_margin',
			'mc4e_row_height',
			'mc4e_allow_overlap',
			'mc4e_compaction_type',
			'mc4e_element_ordering',
		],
		// Style settings (React-mapped)
		styleKeys: [
			'mc4e_style_preset',
			'mc4e_item_layout',
			'mc4e_title_size',
			'mc4e_excerpt_size',
			'mc4e_readmore_size',
			'mc4e_taxonomy_size',
			'mc4e_excerpt_truncate',
			'mc4e_excerpt_truncate_lines',
			'mc4e_item_align',
			'mc4e_item_vertical_align',
			'mc4e_image_resolution',
			'mc4e_featured_image_position',
			'mc4e_image_fit'
		],
		// Responsive setting keys (have _tablet, _mobile variants)
		responsiveKeys: [
			'mc4e_title_size',
			'mc4e_excerpt_size',
			'mc4e_readmore_size',
			'mc4e_taxonomy_size',
			'mc4e_item_align',
			'mc4e_item_vertical_align',
			'mc4e_elements_gap',
			'mc4e_padding',
			'mc4e_image_size',
			'mc4e_badge_sale_size',
		],
		// Selector-only style settings (NOT in React mapper but affect visual appearance)
		selectorStyleKeys: [
			'mc4e_elements_gap',
			'mc4e_padding',
			'mc4e_image_size',
			'mc4e_text_color',
			'mc4e_links_color',
			'mc4e_border_radius',
		],
		// Group control prefixes
		groupControlPrefixes: [
			'mc4e_background_color',
			'mc4e_item_border',
			'mc4e_box_shadow',
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
		console.log(`[MC4E Setup ${type}]:`, message);
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
	// For example, single-posttypeitem-layout lists per-element text size/alignment
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
				setError(__('Failed to load setups.', 'mosaic-contents-for-elementor'));
			})
			.finally(() => setIsLoading(false));

		return () => controller.abort();
	}, []);

	// ── Persist setups to WP options ──
	/**
	 * Persist the current setups state to WordPress settings.
	 *
	 * @param {Array<Object>} setupsToSave - The saved setup objects to persist.
	 * @returns {Promise<boolean>} True when save succeeds.
	 */
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
			const msg = err.message || __('Failed to save.', 'mosaic-contents-for-elementor');
			setError(msg);
			showToast(msg, 'error');
			return false;
		} finally {
			setIsSaving(false);
		}
	}, []);

	// ── Save current setup ──
	/**
	 * Capture the current widget settings and save them as a named setup.
	 * If the setup ID already exists, the user is prompted to confirm overwrite.
	 *
	 * @returns {Promise<void>}
	 */
	const handleSave = useCallback(async () => {
		const trimmed = newSetupName.trim();
		if (!trimmed) {
			// Focus the input and show inline feedback
			if (nameInputRef.current) {
				nameInputRef.current.focus();
				nameInputRef.current.classList.add('mc4e-input-error');
				setTimeout(() => nameInputRef.current?.classList.remove('mc4e-input-error'), 1500);
			}
			return;
		}

		const id = slugify(trimmed);
		if (!id) return;

		const model = getWidgetModel();
		if (!model) {
			showToast(__('No widget model found.', 'mosaic-contents-for-elementor'), 'error');
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
				`${__('Setup', 'mosaic-contents-for-elementor')} "${trimmed}" ${__('already exists. Overwrite?', 'mosaic-contents-for-elementor')}`
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
					? __('Setup updated!', 'mosaic-contents-for-elementor')
					: __('Setup saved!', 'mosaic-contents-for-elementor')
			);
		}
	}, [newSetupName, setups, persistSetups, onValueChange]);

	// ── Load selected setup ──
	/**
	 * Apply the selected setup to the current widget model.
	 *
	 * @param {Event} e - Change event from the setup select element.
	 * @returns {void}
	 */
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
		showToast(`${__('Loaded:', 'mosaic-contents-for-elementor')} ${setup.name}`);
	}, [setups, onValueChange]);

	// ── Delete selected setup ──
	/**
	 * Delete the currently selected saved setup and persist the new list.
	 *
	 * @returns {Promise<void>}
	 */
	const handleDelete = useCallback(async () => {
		if (!selectedId) return;

		const setup = setups.find(s => s.id === selectedId);
		const name = setup?.name || selectedId;

		if (!confirm(
			`${__('Delete setup', 'mosaic-contents-for-elementor')} "${name}"?`
		)) {
			return;
		}

		const updated = setups.filter(s => s.id !== selectedId);
		const success = await persistSetups(updated);
		if (success) {
			setSetups(updated);
			setSelectedId('');
			onValueChange('');
			showToast(__('Setup deleted.', 'mosaic-contents-for-elementor'));
		}
	}, [selectedId, setups, persistSetups, onValueChange]);

	// ── Render ──
	if (isLoading) {
		return <div className="mc4e-setups-loading">{__('Loading setups…', 'mosaic-contents-for-elementor')}</div>;
	}

	return (
		<div className="mc4e-saved-setups-ui">
			{error && <div className="mc4e-setups-error">{error}</div>}

			{/* Select saved setup */}
			<div className="mc4e-setups-select-row">
				<select
					className="mc4e-setups-select"
					value={selectedId}
					onChange={handleSelect}
					disabled={isSaving}
				>
					<option value="">{
						setups.length
							? __('— Select a setup —', 'mosaic-contents-for-elementor')
							: __('— No saved setups —', 'mosaic-contents-for-elementor')
					}</option>
					{setups.map(s => (
						<option key={s.id} value={s.id}>{s.name}</option>
					))}
				</select>

				{/* Delete button – only when a setup is selected */}
				{selectedId && (
					<button
						className="mc4e-setups-delete-btn"
						onClick={handleDelete}
						disabled={isSaving}
						title={__('Delete selected setup', 'mosaic-contents-for-elementor')}
						type="button"
					>
						<i className="eicon-trash-o" />
					</button>
				)}
			</div>

			{/* Save new setup */}
			<div className="mc4e-setups-save-row">
				<input
					ref={nameInputRef}
					className="mc4e-setups-name-input"
					type="text"
					placeholder={__('Setup name…', 'mosaic-contents-for-elementor')}
					value={newSetupName}
					onChange={(e) => setNewSetupName(e.target.value)}
					onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
					disabled={isSaving}
				/>
				<button
					className="mc4e-setups-save-btn"
					onClick={handleSave}
					disabled={isSaving}
					type="button"
				>
					{isSaving
						? __('Saving…', 'mosaic-contents-for-elementor')
						: __('Save', 'mosaic-contents-for-elementor')
					}
				</button>
			</div>
		</div>
	);
}


// ── Elementor Control View Registration ───────────────────────────────────

/**
 * Initialize the saved setups control view within Elementor.
 *
 * @returns {void}
 */
function initSavedSetupsControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) return;

	const BaseDataControl = elementor.modules.controls.BaseData;
	if (!BaseDataControl) {
		console.error('MC4E: BaseData control not found');
		return;
	}

	const SavedSetupsControl = BaseDataControl.extend({
		/**
		 * Elementor control lifecycle callback when the control is ready.
		 *
		 * @returns {void}
		 */
		onReady() {
			this.initSavedSetups();
		},

		/**
		 * Mount the React saved setups UI into the control container.
		 *
		 * @returns {void}
		 */
		initSavedSetups() {
			const container = this.$el.find('.mc4e-saved-setups-container');
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

		/**
		 * Apply the saved control value from Elementor when the control is restored.
		 *
		 * @returns {void}
		 */
		applySavedValue() {
			BaseDataControl.prototype.applySavedValue.apply(this, arguments);
			// The React component manages its own state from WP options;
			// the control value is just the selected setup ID for reference.
		},

		/**
		 * Clean up and unmount the React root before control destruction.
		 *
		 * @returns {void}
		 */
		onBeforeDestroy() {
			if (this._reactRoot) {
				this._reactRoot.unmount();
				this._reactRoot = null;
			}
		},
	});

	elementor.addControlView('mc4e_saved_setups', SavedSetupsControl);
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
