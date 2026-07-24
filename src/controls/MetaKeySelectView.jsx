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

const META_KEYS_ENDPOINT = '/micemade_mc4e/v1/post-meta-keys';
const DEBOUNCE_DELAY = 300;

// How long a fetched key list is reused, matching the server-side cache TTL.
const KEYS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Shared per-post-type request cache.
 *
 * Every repeater row mounts its own control, so without this a Post Meta
 * Display list of N rows fires N identical requests each time the post type
 * changes. Entries hold the promise itself, so rows that mount together share
 * one in-flight request rather than racing.
 *
 * @type {Map<string, {promise: Promise<Array>, timestamp: number}>}
 */
const metaKeysCache = new Map();

/**
 * Load the meta keys for a post type, reusing an in-flight or recent request.
 *
 * @param {string} postType Post type slug.
 * @returns {Promise<Array>} Resolves to an array of { value, label } options.
 */
const loadMetaKeys = (postType) => {
	const cached = metaKeysCache.get(postType);

	if (cached && Date.now() - cached.timestamp < KEYS_CACHE_TTL) {
		return cached.promise;
	}

	const promise = apiFetch({
		path: `${META_KEYS_ENDPOINT}?post_type=${encodeURIComponent(postType)}`,
	})
		.then((response) => (Array.isArray(response) ? response : []))
		.catch((error) => {
			// Never cache a failure — the next mount should retry.
			metaKeysCache.delete(postType);
			throw error;
		});

	metaKeysCache.set(postType, { promise, timestamp: Date.now() });

	return promise;
};

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
				const options = await loadMetaKeys(postType);
				if (!cancelled) {
					setDefaultOptions(options);
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Mosaic Contents for Elementor: Failed to load meta keys:', error);
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
