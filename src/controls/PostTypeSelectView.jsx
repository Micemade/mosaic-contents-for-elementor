/**
 * Post Type Select Control - React Component
 *
 * Async select component for searching and selecting post types.
 * Uses React Select's AsyncSelect with a custom REST endpoint.
 *
 * - Initial load: 50 most recent post types
 * - Async search: Fires after 2+ characters with 300ms debounce
 *
 * @package Micemade\MosaicContentsForElementor\Controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncSelect from 'react-select/async';

// ── WP globals available in editor panel context ──────────────────────────
const apiFetch = wp.apiFetch;
const { __ } = wp.i18n;

/**
 * REST API endpoint for post types.
 *
 * @type {string}
 */
const POST_TYPES_ENDPOINT = '/micemade_mc4e/v1/post-types';

/**
 * Default number of post types to load initially.
 *
 * @type {number}
 */
const PER_PAGE = 50;

/**
 * Debounce delay in milliseconds.
 *
 * @type {number}
 */
const DEBOUNCE_DELAY = 300;

/**
 * Minimum characters required before search triggers.
 *
 * @type {number}
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * PostTypeSelectView component.
 *
 * Renders an async React Select for choosing a post type.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.initialValue   Initial post type ID (from Elementor control value).
 * @param {Function} props.onChange        Callback when selection changes. Receives post type ID string.
 * @returns {React.Element} The rendered component.
 */
const PostTypeSelectView = ({ initialValue, onChange }) => {

	const [defaultOptions, setDefaultOptions] = useState([]);
	const [selectedOption, setSelectedOption] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const debounceTimerRef = useRef(null);

	/**
	 * Fetch the initial set of post types on mount.
	 */
	useEffect(() => {
		const fetchInitialPostTypes = async () => {
			try {
				setIsLoading(true);
				const response = await apiFetch({
					path: `${POST_TYPES_ENDPOINT}?per_page=${PER_PAGE}`,
				});
				setDefaultOptions(response);

				// If we have an initial value, find it in the response or fetch it specifically.
				if (initialValue) {
					const postTypeId = parseInt(initialValue, 10);
					const found = response.find((opt) => opt.value === postTypeId);
					if (found) {
						setSelectedOption(found);
					} else if (postTypeId > 0) {
						// Post type not in first 50 — fetch it by search.
						try {
							const searchResponse = await apiFetch({
								path: `${POST_TYPES_ENDPOINT}?search=${postTypeId}&per_page=1`,
							});
							// Also try fetching by searching for the post title via wp/v2.
							// Fallback: create a minimal option with just the ID as label.
							const titleResponse = await apiFetch({
								path: `/wp/v2/post-type/${postTypeId}?_fields=id,title`,
							});
							if (titleResponse && titleResponse.title) {
								setSelectedOption({
									value: postTypeId,
									label:
										titleResponse.title.rendered ||
										titleResponse.title,
									mediaId: 0,
								});
							} else if (searchResponse.length > 0) {
								const match = searchResponse.find(
									(opt) => opt.value === postTypeId
								);
								if (match) {
									setSelectedOption(match);
								}
							}
						} catch {
							// If individual post type fetch fails, set a basic option.
							setSelectedOption({
								value: postTypeId,
								label: `Post Type #${postTypeId}`,
								mediaId: 0,
							});
						}
					}
				}
			} catch (error) {
				console.error('Mosaic Contents for Elementor: Failed to fetch initial content items:', error);
				setDefaultOptions([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchInitialPostTypes();

		// Cleanup debounce timer on unmount.
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	/**
	 * Load options based on search input with debouncing.
	 * Used by react-select's async mode.
	 *
	 * @param {string} inputValue Search input value.
	 * @returns {Promise<Array>} Promise resolving to array of options.
	 */
	const loadOptions = useCallback(
		(inputValue) => {
			return new Promise((resolve) => {
				// Clear existing timer.
				if (debounceTimerRef.current) {
					clearTimeout(debounceTimerRef.current);
				}

				// Return default options if input is too short.
				if (!inputValue || inputValue.length < MIN_SEARCH_LENGTH) {
					resolve(defaultOptions);
					return;
				}

				// Debounce the search.
				debounceTimerRef.current = setTimeout(async () => {
					try {
						const response = await apiFetch({
							path: `${POST_TYPES_ENDPOINT}?search=${encodeURIComponent(inputValue)}&per_page=${PER_PAGE}`,
						});
						resolve(response);
					} catch (error) {
						console.error('Mosaic Contents for Elementor: Post type search failed:', error);
						resolve([]);
					}
				}, DEBOUNCE_DELAY);
			});
		},
		[defaultOptions]
	);

	/**
	 * Handle selection change.
	 *
	 * @param {Object|null} option Selected option object or null.
	 */
	const handleChange = useCallback(
		(option) => {
			setSelectedOption(option);
			// Pass the post type ID (as string) to Elementor, or empty string if cleared.
			onChange(option ? String(option.value) : '');
		},
		[onChange]
	);

	/**
	 * No options message for react-select.
	 *
	 * @param {Object} params             Parameters from react-select.
	 * @param {string} params.inputValue  Current input value.
	 * @returns {string} Message when no options are found.
	 */
	const noOptionsMessage = useCallback(({ inputValue }) => {
		if (!inputValue || inputValue.length < MIN_SEARCH_LENGTH) {
			return __('Type to search…', 'mosaic-contents-for-elementor');
		}
		return __('No post types found', 'mosaic-contents-for-elementor');
	}, []);

	/**
	 * Loading message for react-select.
	 *
	 * @returns {string} Loading message.
	 */
	const loadingMessage = useCallback(
		() => __('Searching…', 'mosaic-contents-for-elementor'),
		[]
	);

	/**
	 * Custom format for option labels — shows post type thumbnail + name.
	 *
	 * @param {Object} option Option data { value, label, mediaId }.
	 * @returns {React.Element} Formatted label.
	 */
	const formatOptionLabel = useCallback((option) => {
		return (
			<div className="mc4e-posttypeitem-option">
				<span className="mc4e-posttypeitem-option__label">{option.label}</span>
				<span className="mc4e-posttypeitem-option__id">#{option.value}</span>
			</div>
		);
	}, []);

	return (
		<div className="mc4e-posttype-select-wrapper">
			<AsyncSelect
				classNamePrefix="mc4e-ps"
				closeMenuOnSelect={true}
				defaultOptions={defaultOptions}
				loadOptions={loadOptions}
				noOptionsMessage={noOptionsMessage}
				loadingMessage={loadingMessage}
				value={selectedOption}
				onChange={handleChange}
				isMulti={false}
				isSearchable={true}
				isClearable={true}
				isLoading={isLoading}
				placeholder={__(
					'Select or type to search…',
					'mosaic-contents-for-elementor'
				)}
				cacheOptions={false}
				formatOptionLabel={formatOptionLabel}
				menuPortalTarget={document.body}
				styles={{
					menuPortal: (base) => ({ ...base, zIndex: 100000 }),
					control: (base) => ({
						...base,
						minHeight: '36px',
						fontSize: '12px',
					}),
					option: (base) => ({
						...base,
						fontSize: '12px',
						padding: '6px 10px',
					}),
					placeholder: (base) => ({
						...base,
						fontSize: '12px',
					}),
				}}
			/>
		</div>
	);
};

export default PostTypeSelectView;
