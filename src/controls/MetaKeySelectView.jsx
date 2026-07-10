/**
 * Meta Key Select Control - React Component
 *
 * Async select for choosing a post meta key scoped to a post type. Lists the
 * available (non-protected) meta keys via a custom REST endpoint and lets the
 * user search them.
 *
 * @package Micemade\MosaicContentsForElementor\Controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncSelect from 'react-select/async';

// ── WP globals available in the editor panel context ──────────────────────────
const apiFetch = wp.apiFetch;
const { __ } = wp.i18n;

const META_KEYS_ENDPOINT = '/mc4e/v1/post-meta-keys';
const DEBOUNCE_DELAY = 300;

/**
 * MetaKeySelectView component.
 *
 * @param {Object}   props              Component props.
 * @param {string}   props.initialValue Currently stored meta key.
 * @param {string}   props.postType     The widget's selected post type slug.
 * @param {Function} props.onChange     Called with the selected meta key (string).
 * @returns {React.Element}
 */
const MetaKeySelectView = ({ initialValue, postType, onChange }) => {
	const [defaultOptions, setDefaultOptions] = useState([]);
	const [selectedOption, setSelectedOption] = useState(
		initialValue ? { value: initialValue, label: initialValue } : null
	);
	const [isLoading, setIsLoading] = useState(false);
	const debounceTimerRef = useRef(null);

	// (Re)load the available meta keys whenever the post type changes.
	useEffect(() => {
		let cancelled = false;

		const fetchKeys = async () => {
			if (!postType) {
				setDefaultOptions([]);
				return;
			}
			try {
				setIsLoading(true);
				const response = await apiFetch({
					path: `${META_KEYS_ENDPOINT}?post_type=${encodeURIComponent(postType)}`,
				});
				if (!cancelled) {
					setDefaultOptions(Array.isArray(response) ? response : []);
				}
			} catch (error) {
				if (!cancelled) {
					console.error('MC4E: Failed to load meta keys:', error);
					setDefaultOptions([]);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		fetchKeys();

		return () => {
			cancelled = true;
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		};
	}, [postType]);

	// Keep the displayed selection in sync with the stored value.
	useEffect(() => {
		setSelectedOption(initialValue ? { value: initialValue, label: initialValue } : null);
	}, [initialValue]);

	/**
	 * Filter the loaded keys by search input (debounced, client-side).
	 *
	 * @param {string} inputValue Search input.
	 * @returns {Promise<Array>}
	 */
	const loadOptions = useCallback(
		(inputValue) => {
			return new Promise((resolve) => {
				if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
				const needle = (inputValue || '').toLowerCase();
				if (!needle) {
					resolve(defaultOptions);
					return;
				}
				debounceTimerRef.current = setTimeout(() => {
					resolve(
						defaultOptions.filter((opt) =>
							String(opt.value).toLowerCase().includes(needle)
						)
					);
				}, DEBOUNCE_DELAY);
			});
		},
		[defaultOptions]
	);

	const handleChange = useCallback(
		(option) => {
			setSelectedOption(option);
			onChange(option ? String(option.value) : '');
		},
		[onChange]
	);

	const noOptionsMessage = useCallback(() => {
		if (!postType) {
			return __('Select a post type first', 'mosaic-contents-for-elementor');
		}
		return __('No meta keys found', 'mosaic-contents-for-elementor');
	}, [postType]);

	return (
		<div className="mc4e-metakey-select-wrapper">
			<AsyncSelect
				classNamePrefix="mc4e-ps"
				closeMenuOnSelect={true}
				defaultOptions={defaultOptions}
				loadOptions={loadOptions}
				noOptionsMessage={noOptionsMessage}
				loadingMessage={() => __('Loading…', 'mosaic-contents-for-elementor')}
				value={selectedOption}
				onChange={handleChange}
				isMulti={false}
				isSearchable={true}
				isClearable={true}
				isLoading={isLoading}
				placeholder={__('Select or search a meta key…', 'mosaic-contents-for-elementor')}
				cacheOptions={false}
				menuPortalTarget={document.body}
				styles={{
					menuPortal: (base) => ({ ...base, zIndex: 100000 }),
					control: (base) => ({ ...base, minHeight: '36px', fontSize: '12px' }),
					option: (base) => ({ ...base, fontSize: '12px', padding: '6px 10px' }),
					placeholder: (base) => ({ ...base, fontSize: '12px' }),
				}}
			/>
		</div>
	);
};

export default MetaKeySelectView;
