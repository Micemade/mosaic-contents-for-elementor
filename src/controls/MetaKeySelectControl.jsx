/**
 * Meta Key Select Control Entry Point
 *
 * Registers a custom Elementor control (async React Select) for choosing a post
 * meta key. Used inside the Content Layout "Post Meta Display" repeater; scoped
 * to the widget's currently selected post type.
 *
 * Runs in the Elementor editor panel (NOT the preview iframe).
 */

import './MetaKeySelectControl.scss';
import React from 'react';
import { createRoot } from 'react-dom/client';
import MetaKeySelectView from './MetaKeySelectView';

window.addEventListener('elementor/init', () => initMetaKeySelectControl());
document.addEventListener('DOMContentLoaded', () => {
	if (typeof elementor !== 'undefined') {
		initMetaKeySelectControl();
	}
});

/**
 * Read the currently edited widget's post type from the panel model.
 *
 * @returns {string} The `mc4e_post_type` setting, or an empty string.
 */
function getCurrentPostType() {
	try {
		const model = elementor.getPanelView()?.getCurrentPageView()?.model;
		return model?.getSetting?.('mc4e_post_type') || '';
	} catch {
		return '';
	}
}

/**
 * Register the meta-key select control view with Elementor.
 */
function initMetaKeySelectControl() {
	if (typeof elementor === 'undefined' || !elementor.modules) {
		return;
	}

	const BaseDataControl = elementor.modules.controls.BaseData;
	if (!BaseDataControl) {
		return;
	}

	const MetaKeySelectControl = BaseDataControl.extend({
		onReady() {
			this.initMetaKeySelect();
		},

		initMetaKeySelect() {
			const container = this.$el.find('.mc4e-metakey-select-container');
			if (!container.length) {
				return;
			}

			this._reactRoot = createRoot(container[0]);
			this._renderView(String(container.data('initial-value') || ''));

			// Re-render whenever the widget's post type changes so the key list follows.
			this._settingsModel = elementor
				.getPanelView()?.getCurrentPageView()?.model?.get?.('settings');
			if (this._settingsModel) {
				this._onPostTypeChange = () =>
					this._renderView(String(this.getControlValue() || ''));
				this._settingsModel.on('change:mc4e_post_type', this._onPostTypeChange);
			}
		},

		_renderView(value) {
			if (!this._reactRoot) {
				return;
			}
			this._reactRoot.render(
				<MetaKeySelectView
					initialValue={value}
					postType={getCurrentPostType()}
					onChange={(key) => this.onMetaKeyChange(key)}
				/>
			);
		},

		onMetaKeyChange(key) {
			this.$el.find('.mc4e-metakey-select-value').val(key);
			this.setValue(key);
		},

		applySavedValue() {
			BaseDataControl.prototype.applySavedValue.apply(this, arguments);
			this._renderView(String(this.getControlValue() || ''));
		},

		onBeforeDestroy() {
			if (this._settingsModel && this._onPostTypeChange) {
				this._settingsModel.off('change:mc4e_post_type', this._onPostTypeChange);
			}
			if (this._reactRoot) {
				this._reactRoot.unmount();
				this._reactRoot = null;
			}
		},
	});

	elementor.addControlView('mc4e_meta_key_select', MetaKeySelectControl);
}
