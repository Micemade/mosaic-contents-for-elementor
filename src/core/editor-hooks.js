/**
 * Editor Hooks Registration
 *
 * Editor-only hooks for Elementor integration. Handles model binding,
 * settings sync, and DOM re-render prevention. Not loaded on frontend.
 */

import { getRegisteredWidgets, getWidgetConfig } from './widget-registry';
import { createWidgetInitializer } from './widget-initializer';
import widgetManager from './widget-manager';
import { getActiveBreakpointNames } from './elementor-utils';
import { addItemToLayout } from '../shared/utils/addItem';
import { getComputedLayout } from '../shared/utils/layoutUtils';

// Style presets for applying batch style changes from the Saved Setups control
import stylePresets from '../../assets/presets/content-layout/style-presets.json';


const STYLE_PRESET_MAP = stylePresets.reduce((acc, preset) => {
	if (preset?.id && preset?.settings) {
		acc[preset.id] = preset.settings;
	}
	return acc;
}, {});

const STYLE_PRESET_SETTING_KEYS = Array.from(
	new Set(
		stylePresets.flatMap((preset) => {
			if (!preset?.settings || typeof preset.settings !== 'object') {
				return [];
			}
			return Object.keys(preset.settings);
		})
	)
);

/**
 * Widget-specific settings key mapping.
 *
 * Maps each widget type to its layout/custom_layout keys and channel events.
 * This allows the generic editor hooks to work with any registered widget.
 */
const WIDGET_KEYS = {
	'content-layout': {
		layoutKey: 'mc4e_layout',
		customLayoutKey: 'mc4e_custom_layout',
		savedSetupKey: 'mc4e_saved_setup',
		stylePresetKey: 'mc4e_style_preset',
		presetSettingKeys: STYLE_PRESET_SETTING_KEYS,
		stylePresetMap: STYLE_PRESET_MAP,
		resetEvent: 'mosaic:resetLayout',
		applySetupEvent: 'mosaic:applySetup',
		addItemEvent: 'mosaic:addItem',
		gridColumns: { desktop: 48, tablet: 24, mobile: 12 },
		repeaterKeys: ['mc4e_element_ordering'],
	},
	'widgets-layout': {
		layoutKey: 'mc4e_layout',
		customLayoutKey: 'mc4e_custom_layout',
		widgetItemsKey: 'mc4e_widget_items',
		resetEvent: 'mosaic:resetLayout',
		addItemEvent: 'mosaic:addItem',
		gridColumns: { desktop: 48, tablet: 24, mobile: 12 },
		repeaterKeys: [],
	},
};

// Keep one active channel handler per event to avoid stacked callbacks
// when the same widget panel is opened multiple times.
const CHANNEL_EVENT_HANDLERS = {};
const POST_TYPE_META_CACHE = new Map();
const TAXONOMY_TERMS_OPTIONS_CACHE = new Map();

const getRestRoot = () => {
	const localizedRoot = window?.MC4E?.restRoot;
	const wpApiRoot = window?.wpApiSettings?.root;
	const fallback = '/wp-json/';
	const root = localizedRoot || wpApiRoot || fallback;

	return root.endsWith('/') ? root : `${root}/`;
};

const fetchPostTypeMeta = async (postType) => {
	if (!postType) {
		return null;
	}

	if (POST_TYPE_META_CACHE.has(postType)) {
		return POST_TYPE_META_CACHE.get(postType);
	}

	try {
		const response = await fetch(`${getRestRoot()}mc4e/v1/post-types`);
		if (!response.ok) {
			return null;
		}

		const postTypes = await response.json();
		if (Array.isArray(postTypes)) {
			postTypes.forEach((typeObj) => {
				if (typeObj?.name) {
					POST_TYPE_META_CACHE.set(typeObj.name, typeObj);
				}
			});
		}
	} catch (error) {
		console.warn('Failed to load post type metadata for dependent controls.', error);
	}

	return POST_TYPE_META_CACHE.get(postType) || null;
};

const collectControlViews = (rootView, collector = []) => {
	if (!rootView || collector.includes(rootView)) {
		return collector;
	}

	collector.push(rootView);

	const children = rootView.children;
	if (children?._views) {
		Object.values(children._views).forEach((childView) => collectControlViews(childView, collector));
	}

	if (Array.isArray(rootView._childViews)) {
		rootView._childViews.forEach((childView) => collectControlViews(childView, collector));
	}

	return collector;
};

const getActivePanelView = () => {
	try {
		return elementor.getPanelView()?.getCurrentPageView() || null;
	} catch (_) {
		return null;
	}
};

const updateControlOptions = (controlName, options) => {
	const panelView = getActivePanelView();
	if (!panelView) {
		return;
	}

	const allViews = collectControlViews(panelView);
	const controlView = allViews.find((view) => view?.model?.get?.('name') === controlName);

	if (!controlView) {
		return;
	}

	controlView.model.set('options', options || {});

	if (typeof controlView.render === 'function') {
		controlView.render();
	}
};

const fetchTaxonomyTermsOptions = async (taxonomy) => {
	if (!taxonomy) {
		return {};
	}

	if (TAXONOMY_TERMS_OPTIONS_CACHE.has(taxonomy)) {
		return TAXONOMY_TERMS_OPTIONS_CACHE.get(taxonomy);
	}

	try {
		const url = `${getRestRoot()}mc4e/v1/taxonomy-terms?taxonomy=${encodeURIComponent(taxonomy)}`;
		const response = await fetch(url);
		if (!response.ok) {
			return {};
		}

		const options = await response.json();
		const normalized = options && typeof options === 'object' ? options : {};
		TAXONOMY_TERMS_OPTIONS_CACHE.set(taxonomy, normalized);
		return normalized;
	} catch (error) {
		console.warn('Failed to load taxonomy terms for dependent controls.', error);
		return {};
	}
};

const syncTermsOptionsForTaxonomy = async (model, taxonomy) => {
	const termsOptions = await fetchTaxonomyTermsOptions(taxonomy);
	updateControlOptions('mc4e_terms', termsOptions);

	const selectedTerms = model.getSetting('mc4e_terms');
	if (Array.isArray(selectedTerms)) {
		const filteredTerms = selectedTerms.filter((term) => (
			typeof term === 'string' && taxonomy && term.startsWith(`${taxonomy}:`) && termsOptions[term]
		));

		if (filteredTerms.length !== selectedTerms.length) {
			model.setSetting('mc4e_terms', filteredTerms);
		}
	}
};

const syncTaxonomyOptionsForPostType = async (model, postType, forceResetTaxonomy = false) => {
	const postTypeMeta = await fetchPostTypeMeta(postType);
	if (!postTypeMeta) {
		updateControlOptions('mc4e_taxonomy', {});
		updateControlOptions('mc4e_terms', {});
		model.setSetting('mc4e_taxonomy', '');
		model.setSetting('mc4e_terms', []);
		return;
	}

	const taxonomyNames = Array.isArray(postTypeMeta.taxonomies)
		? postTypeMeta.taxonomies
		: [];
	const taxonomyLabels = postTypeMeta.taxonomy_labels && typeof postTypeMeta.taxonomy_labels === 'object'
		? postTypeMeta.taxonomy_labels
		: {};

	const taxonomyOptions = taxonomyNames.reduce((acc, taxonomyName) => {
		acc[taxonomyName] = taxonomyLabels[taxonomyName] || taxonomyName;
		return acc;
	}, {});

	updateControlOptions('mc4e_taxonomy', taxonomyOptions);

	const currentTaxonomy = model.getSetting('mc4e_taxonomy');
	const fallbackTaxonomy = Object.keys(taxonomyOptions)[0] || '';
	if (forceResetTaxonomy || !taxonomyOptions[currentTaxonomy]) {
		model.setSetting('mc4e_taxonomy', fallbackTaxonomy);
	}

	const activeTaxonomy = model.getSetting('mc4e_taxonomy');
	await syncTermsOptionsForTaxonomy(model, activeTaxonomy);
};

const bindEditorChannelHandler = (eventName, handler) => {
	if (!eventName || typeof handler !== 'function') {
		return;
	}

	if (CHANNEL_EVENT_HANDLERS[eventName]) {
		elementor.channels.editor.off(eventName, CHANNEL_EVENT_HANDLERS[eventName]);
	}

	elementor.channels.editor.on(eventName, handler);
	CHANNEL_EVENT_HANDLERS[eventName] = handler;
};

const markDocumentModified = (status = true) => {
	const $e = window.$e || window.parent?.$e;
	if ($e?.internal) {
		try {
			$e.internal('document/save/set-is-modified', { status });
			return;
		} catch (error) {
			console.warn('Elementor internal save state command failed, falling back:', error);
		}
	}

	if (elementor?.saver) {
		elementor.saver.setFlagEditorChange(status);
	}
};

const setWidgetSettingWithHistory = (model, widgetId, settingName, value) => {
	const $e = window.$e || window.parent?.$e;
	const elementorRef = typeof elementor !== 'undefined' ? elementor : window.parent?.elementor;
	const container = elementorRef?.getContainer?.(widgetId);

	if ($e && container) {
		try {
			$e.run('document/elements/settings', {
				container,
				settings: {
					[settingName]: value,
				},
			});
			return;
		} catch (error) {
			console.warn('History-aware setting command failed, falling back to setSetting:', error);
		}
	}

	model.setSetting(settingName, value);
	markDocumentModified(true);
};

const createRepeaterUpdateScheduler = (widgetType, widgetId, getSettingsFromModel) => {
	let repeaterTimer = null;

	return () => {
		clearTimeout(repeaterTimer);
		repeaterTimer = setTimeout(() => {
			widgetManager.updateInstance(
				widgetType,
				widgetId,
				getSettingsFromModel()
			);
		}, 80);
	};
};

const patchRepeaterCollection = (collection, widgetId, scheduleRepeaterUpdate) => {
	if (!collection || typeof collection.add !== 'function') {
		return;
	}

	// Skip if this exact collection instance was already patched
	// (e.g. Elementor updated in-place rather than replacing it).
	if (collection.__mc4ePatched === widgetId) {
		return;
	}

	collection.__mc4ePatched = widgetId;

	['add', 'remove', 'reset', 'sort'].forEach((method) => {
		const original = collection[method];
		if (typeof original !== 'function') return;
		collection[method] = function (...args) {
			const result = original.apply(this, args);
			scheduleRepeaterUpdate();
			return result;
		};
	});

	// Also listen for `change` events bubbled from item models
	// (e.g. visibility switcher toggles).
	collection.on('change', scheduleRepeaterUpdate);
};

const patchRepeaterCollections = (settingsModel, repeaterKeys, widgetId, scheduleRepeaterUpdate) => {
	if (!settingsModel || !Array.isArray(repeaterKeys)) {
		return;
	}

	repeaterKeys.forEach((repeaterKey) => {
		const collection = settingsModel.get(repeaterKey);
		patchRepeaterCollection(collection, widgetId, scheduleRepeaterUpdate);
	});
};

/**
 * Register frontend hooks for editor preview.
 * Same as frontend-hooks but with 'edit' mode.
 *
 * The widgets-layout live-element handling (creating dropped widgets in a
 * hidden holding container and re-parenting their DOM into grid cells) lives
 * entirely in the React component (widgets-layout.jsx), which registers its
 * own frontend/element_ready hooks inside this same preview iframe.
 *
 * @return void
 */
export const registerFrontendHooks = () => {
	if (typeof elementorFrontend === 'undefined') {
		return;
	}

	getRegisteredWidgets().forEach(widgetType => {
		elementorFrontend.hooks.addAction(
			`frontend/element_ready/${widgetType}.default`,
			createWidgetInitializer(widgetType, 'edit')
		);
	});
};

/**
 * Register editor hooks to prevent DOM re-renders and provide live updates.
 *
 * Ensures Elementor does not replace the widget DOM on each settings change
 * and wires the panel open event to provide a model getter for the widget
 * manager.
 *
 * @return void
 */
export const registerEditorHooks = () => {
	if (typeof elementor === 'undefined') {
		return;
	}

	// Prevent Elementor from re-rendering widget DOM on every settings change
	// React will handle updates internally without DOM replacement
	elementor.hooks.addFilter('editor/widget/renderOnChange', function (renderOnChange, widgetType) {
		if (getRegisteredWidgets().includes(widgetType)) {
			return false; // Disable automatic DOM re-renders for our widgets
		}
		return renderOnChange;
	});

	// Register panel open hooks for each widget type
	getRegisteredWidgets().forEach(widgetType => {
		elementor.hooks.addAction(`panel/open_editor/widget/${widgetType}`, (panel, model, view) => {
			const widgetId = model.id;
			const modelKey = `${widgetType}_${widgetId}`;
			const widgetConfig = getWidgetConfig(widgetType);
			const getSettingsFromModel = () => widgetConfig.settingsMapper(model);
			const panelView = panel || getActivePanelView();

			// Register the editor view with the widget manager so the
			// manager can consult it when deciding whether to remount
			// (for example: core/advanced settings should allow remount).
			if (view) {
				try {
					// Derive React scoped setting keys from the mapper result
					const mapped = getSettingsFromModel() || {};
					const widgetKeys = Object.keys(mapped);

					// Expand widgetKeys to include responsive control variants
					// Responsive settings in Elementor are stored as:
					// - base_key (desktop), base_key_tablet, base_key_mobile
					// But in mapped settings they appear as single key with breakpoints object
					const expandedWidgetKeys = new Set(widgetKeys);

					// Include the saved-setup control key so changing it
					// doesn't trigger a DOM re-render.
					const wKeys = WIDGET_KEYS[widgetType];
					if (wKeys?.savedSetupKey) {
						expandedWidgetKeys.add(wKeys.savedSetupKey);
					}

					if (wKeys?.stylePresetKey) {
						expandedWidgetKeys.add(wKeys.stylePresetKey);
					}

					if (Array.isArray(wKeys?.presetSettingKeys)) {
						wKeys.presetSettingKeys.forEach((key) => {
							expandedWidgetKeys.add(key);
						});
					}

					widgetKeys.forEach(key => {
						const value = mapped[key];
						// Check if this is a responsive setting (object with breakpoint keys)
						if (value && typeof value === 'object' && !Array.isArray(value)) {
							const activeBreakpoints = getActiveBreakpointNames();
							const hasBreakpoints = activeBreakpoints.some(bp => value.hasOwnProperty(bp));

							if (hasBreakpoints) {
								// Add breakpoint variants: key_tablet, key_mobile, etc.
								// Exclude 'desktop' as it's the base key
								activeBreakpoints.filter(bp => bp !== 'desktop').forEach(bp => {
									expandedWidgetKeys.add(`${key}_${bp}`);
								});
							}
						}
					});

					const widgetKeysArray = Array.from(expandedWidgetKeys);

					// Override view.renderOnChange to be conditional:
					// - For React scoped changes: renderUI() only (regenerates
					//   CSS for controls with `selectors` without DOM destruction)
					// - For core/advanced changes: call the original renderOnChange
					const originalRenderOnChange = view.renderOnChange.bind(view);
					view.renderOnChange = (settings) => {
						const changed = settings.changedAttributes();
						const changedKeys = Object.keys(changed || {});
						// Ignore Elementor internal keys (e.g. __globals__, __dynamic__)
						// that fire alongside React scoped changes like SELECT2 values.
						const relevantKeys = changedKeys.filter(k => !k.startsWith('__'));
						const hasNonWidgetChange = relevantKeys.some(k => !widgetKeysArray.includes(k));
						if (hasNonWidgetChange) {
							// Call original to handle core/advanced changes
							originalRenderOnChange(settings);
						} else if (relevantKeys.length) {
							// React scoped changes: refresh CSS (selectors) without
							// full DOM re-render so the React root stays intact.
							try { view.renderUI(); } catch (_) { /* swallow */ }
						}
					};

				} catch (e) {
					// ignore registration errors
				}
			}

			// Store getter globally so it's available during widget remounts
			widgetManager.modelGetters[modelKey] = getSettingsFromModel;

			// Store model reference for two-way updates (React → Elementor)
			widgetManager.models[modelKey] = model;

			// Push initial settings immediately so React mounts with correct data.
			// This ensures settings are applied on first widget load.
			widgetManager.updateInstance(
				widgetType,
				widgetId,
				getSettingsFromModel()
			);

			// Update React component whenever Elementor model settings change (Elementor → React).
			// Also regenerate CSS for controls with `selectors` (colours, borders,
			// shadows, etc.).  The global `editor/widget/renderOnChange` filter
			// returns false for our widgets, so Elementor's own onSettingsChange
			// never calls renderOnChange → renderUI is never triggered.  We call
			// it explicitly here so every individual panel change refreshes CSS.
			model.get('settings').on('change', (settingsModel) => {
				widgetManager.updateInstance(
					widgetType,
					widgetId,
					getSettingsFromModel()
				);
				// Regenerate selector-based CSS without DOM destruction.
				if (view && typeof view.renderUI === 'function') {
					try { view.renderUI(); } catch (_) { /* swallow */ }
				}
			});


			// Listen for repeater collection mutations.
			//
			// Elementor's repeater sort command (`document/repeater/move`)
			// uses `collection.remove()` + `collection.add()` with
			// `{silent: true}`, so standard Backbone events (`sort`,
			// `change`, `reset`) never fire on the Collection.
			//
			// To reliably detect ALL mutations (reorder, visibility
			// switcher toggles, etc.) we intercept the Collection's
			// mutator methods directly.  A short debounce coalesces
			// the remove+add pair that constitutes a single drag-sort.
			const wKeys = WIDGET_KEYS[widgetType];
			if (wKeys?.repeaterKeys) {
				const settingsModel = model.get('settings');
				const scheduleRepeaterUpdate = createRepeaterUpdateScheduler(widgetType, widgetId, getSettingsFromModel);
				patchRepeaterCollections(settingsModel, wKeys.repeaterKeys, widgetId, scheduleRepeaterUpdate);
			}

			// Clear custom layout when predefined layout changes
			// This ensures switching predefined layouts applies immediately
			if (wKeys) {
				let isApplyingStylePreset = false;
				let isApplyingSetupBatch = false;
				let taxonomySyncSeq = 0;

				if (widgetType === 'content-layout') {
					const selectedPostType = model.getSetting('mc4e_post_type') || 'post';
					const runTaxonomySync = async (nextPostType) => {
						taxonomySyncSeq += 1;
						const seq = taxonomySyncSeq;
						await syncTaxonomyOptionsForPostType(model, nextPostType || 'post', false);
						if (seq !== taxonomySyncSeq) {
							return;
						}
					};

					void runTaxonomySync(selectedPostType);
					model.get('settings').on('change:mc4e_post_type', (settingsModel, nextPostType) => {
						void settingsModel;
						taxonomySyncSeq += 1;
						const seq = taxonomySyncSeq;
						void (async () => {
							await syncTaxonomyOptionsForPostType(model, nextPostType || 'post', true);
							if (seq !== taxonomySyncSeq) {
								return;
							}
						})();
					});

					model.get('settings').on('change:mc4e_taxonomy', (settingsModel, nextTaxonomy) => {
						void settingsModel;
						void syncTermsOptionsForTaxonomy(model, nextTaxonomy || '');
					});
				}

				if (wKeys.stylePresetKey && wKeys.applySetupEvent) {
					model.get('settings').on(`change:${wKeys.stylePresetKey}`, (settingsModel, presetId) => {
						void settingsModel;
						if (isApplyingStylePreset || isApplyingSetupBatch || !presetId) {
							return;
						}

						const presetSettings = wKeys.stylePresetMap?.[presetId];
						if (!presetSettings) {
							return;
						}

						isApplyingStylePreset = true;
						elementor.channels.editor.trigger(wKeys.applySetupEvent, {
							widgetId,
							source: 'stylePreset',
							settings: {
								...presetSettings,
								[wKeys.stylePresetKey]: presetId,
							},
						});
						setTimeout(() => {
							isApplyingStylePreset = false;
						}, 0);
					});
				}

				model.get('settings').on(`change:${wKeys.layoutKey}`, (settingsModel, newLayoutId) => {
					const customLayout = model.getSetting(wKeys.customLayoutKey);
					if (customLayout) {
						// Clear custom layout so new predefined layout takes effect
						model.setSetting(wKeys.customLayoutKey, '');
					}
				});

				// Listen for custom 'reset layout' event from React component
				// (React → Elementor)
				bindEditorChannelHandler(wKeys.resetEvent, () => {
					// Only reset if this widget is currently open in the panel
					if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
						model.setSetting(wKeys.customLayoutKey, ''); // Clear custom layout setting
					}
				});

				// Listen for 'apply setup' event from the Saved Setups control.
				// Batch-sets all settings atomically, preventing mid-batch DOM
				// destruction that causes lost React updates and stale CSS.
				bindEditorChannelHandler(wKeys.applySetupEvent, ({ widgetId: targetWidgetId, settings: setupSettings, source }) => {
					// Only apply if this widget is currently open in the panel
					if (elementor.getPanelView().getCurrentPageView().model.id !== widgetId || targetWidgetId !== widgetId) {
						return;
					}

					const settingsModel = model.get('settings');
					const panelModel = elementor.getPanelView()?.getCurrentPageView()?.model;

					// 1. Temporarily disable view.renderOnChange to prevent DOM
					//    re-renders mid-batch (which would destroy the React root).
					let savedRenderOnChange = null;
					if (view && view.renderOnChange) {
						savedRenderOnChange = view.renderOnChange;
						view.renderOnChange = () => { };
					}

					// 2. Temporarily remove change:layoutKey listeners to prevent
					//    the clearance handler from wiping custom_layout.
					const layoutEvents = settingsModel._events?.[`change:${wKeys.layoutKey}`];
					const savedLayoutListeners = layoutEvents ? [...layoutEvents] : null;
					if (layoutEvents) {
						settingsModel.off(`change:${wKeys.layoutKey}`);
					}

					isApplyingSetupBatch = true;
					try {
						// 3. Batch-set ALL settings atomically.
						settingsModel.set(setupSettings);

						// 3b. Keep Elementor panel controls in sync when the panel
						// and preview use different Backbone model instances.
						// Use setSetting() so Elementor updates control UIs, not just
						// the raw Backbone attributes.
						if (source === 'stylePreset' && panelModel && panelModel.id === widgetId && typeof panelModel.setSetting === 'function') {
							Object.entries(setupSettings).forEach(([key, value]) => {
								panelModel.setSetting(key, value);
							});
						}

						// 3c. Apply group styles template to existing repeater rows.
						// The template defines visual style (colors, borders, etc.)
						// without overwriting group_id/group_label associations.
						const groupTemplate = setupSettings.mc4e_sp_group_styles_template;
						if (groupTemplate && typeof groupTemplate === 'object') {
							const repeaterCollection = settingsModel.get('mc4e_sp_group_styles');
							if (repeaterCollection && typeof repeaterCollection.each === 'function') {
								repeaterCollection.each((rowModel) => {
									Object.entries(groupTemplate).forEach(([key, value]) => {
										rowModel.set(key, value, { silent: true });
									});
								});
								repeaterCollection.trigger('change', repeaterCollection);
							}
							// Remove the transient template key from settings so
							// it is not persisted as an unknown Elementor control.
							settingsModel.unset('mc4e_sp_group_styles_template', { silent: true });
						}
					} finally {
						isApplyingSetupBatch = false;
					}

					// 4. Restore view.renderOnChange.
					if (view && savedRenderOnChange) {
						view.renderOnChange = savedRenderOnChange;
					}

					// 5. Restore change:layoutKey listeners.
					if (savedLayoutListeners) {
						savedLayoutListeners.forEach(listener => {
							settingsModel.on(`change:${wKeys.layoutKey}`, listener.callback, listener.context);
						});
					}

					// 6. Ensure React has the final correct settings.
					widgetManager.updateInstance(widgetType, widgetId, getSettingsFromModel());

					// 6b. Re-patch repeater collections that may have been
					//     replaced by a new Backbone Collection during the
					//     batch set above.  Without this, element ordering
					//     changes after applying a setup are silently ignored.
					if (wKeys?.repeaterKeys) {
						const scheduleRepeaterUpdate = createRepeaterUpdateScheduler(widgetType, widgetId, getSettingsFromModel);
						patchRepeaterCollections(settingsModel, wKeys.repeaterKeys, widgetId, scheduleRepeaterUpdate);
					}

					// 7. Regenerate CSS for selector-based styles.
					if (view && typeof view.renderUI === 'function') {
						try { view.renderUI(); } catch (_) { /* swallow */ }
					}

					// 8. Mark document as changed.
					markDocumentModified(true);
				});

				// Listen for 'add grid item' event from panel button
				// (Elementor Panel → React)
				bindEditorChannelHandler(wKeys.addItemEvent, () => {
					// Only add if this widget is currently open in the panel
					if (elementor.getPanelView().getCurrentPageView().model.id === widgetId) {
						// Guard against duplicate firing in the same tick.
						if (model.__mc4eAddItemInProgress) {
							return;
						}
						model.__mc4eAddItemInProgress = true;

						try {
							const customLayoutData = model.getSetting(wKeys.customLayoutKey) || '';
							const layoutId = model.getSetting(wKeys.layoutKey) || 'default';

							// Get the actual layout data (from custom or predefined)
							const currentLayoutData = getComputedLayout(customLayoutData, layoutId);
							const { newLayoutJson } = addItemToLayout(JSON.stringify(currentLayoutData), wKeys.gridColumns);
							setWidgetSettingWithHistory(model, widgetId, wKeys.customLayoutKey, newLayoutJson);
						} finally {
							setTimeout(() => {
								model.__mc4eAddItemInProgress = false;
							}, 0);
						}
					}
				});
			}
		});
	});
};

/**
 * Setup a MutationObserver inside the Elementor preview iframe.
 *
 * This observes dynamically added widgets (for example when dragging a
 * new widget into the canvas) and initializes React instances for them.
 *
 * @return void
 */
export const setupEditorObserver = () => {
	if (typeof elementor === 'undefined') return;

	const previewFrame = document.querySelector('#elementor-preview-iframe');
	if (!previewFrame) return;

	const initPreview = () => {
		// Access iframe document
		const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
		if (!previewDoc?.body) {
			// Retry if iframe body not ready yet
			setTimeout(initPreview, 100);
			return;
		}

		// Watch for new widgets added to DOM (e.g., drag & drop in editor)
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1) { // Element node
						// Check for all registered widget types
						getRegisteredWidgets().forEach(widgetType => {
							const wrapperClass = `${widgetType}-wrapper`;
							const elementorClass = `elementor-widget-${widgetType}`;

							// Find widget wrappers in added nodes
							const widgets = node.classList?.contains(wrapperClass)
								? [node]
								: (node.querySelectorAll ? node.querySelectorAll(`.${wrapperClass}`) : []);

							// Initialize each widget wrapper found
							widgets.forEach((wrapper) => {
								const $wrapper = jQuery(wrapper).closest(`.${elementorClass}`);
								if ($wrapper.length) {
									const widgetId = $wrapper.data('id') || $wrapper.data('widget-id');
									const instanceKey = `${widgetType}_${widgetId}`;
									// Only initialize if not already initialized
									if (!widgetManager.instances[instanceKey]) {
										createWidgetInitializer(widgetType, 'edit')($wrapper);
									}
								}
							});
						});
					}
				});
			});
		});

		// Observe entire preview document for changes
		observer.observe(previewDoc.body, { childList: true, subtree: true });

		// Initialize any existing widgets already in the DOM
		getRegisteredWidgets().forEach(widgetType => {
			const wrapperClass = `${widgetType}-wrapper`;
			const elementorClass = `elementor-widget-${widgetType}`;

			previewDoc.querySelectorAll(`.${wrapperClass}`).forEach((wrapper) => {
				const $wrapper = jQuery(wrapper).closest(`.${elementorClass}`);
				if ($wrapper.length) {
					const instanceKey = `${widgetType}_${$wrapper.data('id')}`;
					if (!widgetManager.instances[instanceKey]) {
						createWidgetInitializer(widgetType, 'edit')($wrapper);
					}
				}
			});
		});
	};

	// Start initialization based on iframe load state
	if (previewFrame.contentDocument?.readyState === 'complete') {
		initPreview(); // Already loaded
	} else {
		previewFrame.addEventListener('load', initPreview); // Wait for load
	}
};

/**
 * Initialize all editor hooks.
 *
 * @return void
 */
export const initializeEditorHooks = () => {
	registerFrontendHooks();
	registerEditorHooks();
	setupEditorObserver();
};
