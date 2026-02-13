/**
 * WordPress dependecies.
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	Placeholder,
	Spinner,
	Button,
	Modal,
	TextControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	Icon,
	Dropdown,
	Flex,
	BaseControl,
	Tooltip,
	CardDivider,
	CheckboxControl
} from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { cleanForSlug } from '@wordpress/url';
import { starFilled, chevronUp, chevronDown, helpFilled } from "@wordpress/icons";

/**
 * Internal dependencies.
 */
import showNotice from '../utils/showNotice';

/**
 * Component for managing plugin settings and layouts.
 *
 * @param {Object} props - Component properties
 * @param {string} props.context - The context where the settings are being rendered. Defaults to 'InspectorControls'.
 * @param {string} props.blockType - The type of block being edited (single product, products grid, or categories grid)
 * @param {Object} props.attributes - Block attributes containing layout and style settings
 * @param {Function} props.setAttributes - Function to update block attributes
 * @return {JSX.Element} The rendered plugin settings component
 */
const SaveCurrentSetup = ({ context = 'InspectorControls', blockType, attributes, setAttributes }) => {

	// If block settings are for a products/categories grid, and NOT for single product.
	const isBlockTypeGrid = (blockType === 'mosaic_product_layouts_products_setups' || blockType === 'mosaic_product_layouts_categories_setups') ?? false;

	const {
		savedLayouts,
		itemZindexes,
		gridSettings,
		productElementSettings,
		featuredImageSize,
		grouped,
		itemStyleOverrides // Products and categories grid only.
	} = attributes;

	// Initial state setup.
	const [userSetups, setUserSetups] = useState([]);
	const [isAPILoaded, setIsAPILoaded] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [newSetupName, setNewSetupName] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState(null);


	useEffect(() => {
		const controller = new AbortController();

		const fetchSettings = async () => {
			setError(null);
			try {
				const response = await apiFetch({
					path: '/wp/v2/settings',
					signal: controller.signal
				});
				const serializedSetups = response[blockType];
				setUserSetups(serializedSetups ? JSON.parse(serializedSetups) : []);
			} catch (error) {
				if (error.name === 'AbortError') {
					// Request was aborted, do nothing
					return;
				}
				console.error('Failed to fetch settings:', error);
				setError(__('Failed to load settings. Please refresh the page.', 'mosaic-product-layouts'));
				setUserSetups([]);
			} finally {
				setIsAPILoaded(true);
			}
		};

		fetchSettings();

		return () => controller.abort();
	}, [blockType]);

	/**
	 * Saves user setups to the database with proper state management.
	 *
	 * @param {Array} setupsToSave - The setups array to save
	 * @return {Promise<boolean>} Returns true if save was successful
	 */
	const saveSetups = async (setupsToSave) => {
		setIsSaving(true);
		setError(null);

		try {
			await apiFetch({
				path: '/wp/v2/settings',
				method: 'POST',
				data: {
					[blockType]: JSON.stringify(setupsToSave),
				},
			});
			showNotice(__('Layout settings saved successfully!', 'mosaic-product-layouts'));
			return true;
		} catch (error) {
			const errorMessage = error.message || __('Failed to save layout settings.', 'mosaic-product-layouts');
			showNotice(errorMessage, 'error');
			console.error('Save error:', error);
			setError(errorMessage);
			return false;
		} finally {
			setIsSaving(false);
		}
	};

	/**
	 * Handles saving a layout setup with validation.
	 * If a setup with the same name exists, prompts for confirmation before overwriting.
	 * Updates the userSetups state and triggers a save to the database.
	 *
	 * @return {Promise<void>} No value is returned.
	 */
	const handleSetupSave = async () => {

		if (!newSetupName) {
			alert(__('Please enter a name for the setup.', 'mosaic-product-layouts'));
			return;
		}

		const idFromNameSlug = cleanForSlug(newSetupName);

		const newSetup = {
			id: idFromNameSlug,
			name: newSetupName.trim(),
			layout: savedLayouts,
			zIndex: itemZindexes,
			...(gridSettings && { grid: gridSettings }),
			prodElSettings: productElementSettings,
			...(itemStyleOverrides && isBlockTypeGrid && { overrides: itemStyleOverrides }),
			featImgSize: featuredImageSize,
			group: grouped
		};

		const existingSetupIndex = userSetups.findIndex((setup) => setup.id === idFromNameSlug);

		if (existingSetupIndex !== -1) {
			if (!confirm(`${__('Setup with name', 'mosaic-product-layouts')} "${newSetupName}" ${__('already exists. Overwrite it?', 'mosaic-product-layouts')}`)) {
				return;
			}
		}

		const updatedSetups = existingSetupIndex !== -1
			? userSetups.map((setup, index) => index === existingSetupIndex ? newSetup : setup)
			: [...userSetups, newSetup];

		const success = await saveSetups(updatedSetups);

		if (success) {
			setUserSetups(updatedSetups);
			setNewSetupName('');
			setIsModalOpen(false);
			showNotice(
				existingSetupIndex !== -1
					? __('Layout setup updated successfully!', 'mosaic-product-layouts')
					: __('New layout setup saved successfully!', 'mosaic-product-layouts')
			);
		}
	};




	// REMOVING SETUPS WITH CONFIRMATION.
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [layoutToDelete, setLayoutToDelete] = useState(null);

	const shouldShowDeleteConfirm = () => {
		const skipConfirm = localStorage.getItem('mpl_skip_delete_confirm');
		return skipConfirm !== 'true';
	};

	/**
	 * Checks if delete confirmation should be shown based on localStorage setting.
	 *
	 * @returns {boolean} True if delete confirmation should be shown, false otherwise.
	 */
	const handleRemoveSetup = (idToRemove) => {
		if (shouldShowDeleteConfirm()) {
			setLayoutToDelete(idToRemove);
			setShowDeleteConfirm(true);
		} else {
			deleteLayout(idToRemove);
		}
	};

	/**
	 * Deletes a layout setup by ID.
	 *
	 * @param {string} idToRemove - The ID of the layout setup to delete
	 * @return {Promise<void>}
	 */
	const deleteLayout = async (idToRemove) => {
		const updatedUserSetups = userSetups.filter((setup) => setup.id !== idToRemove);

		const success = await saveSetups(updatedUserSetups);

		if (success) {
			setUserSetups(updatedUserSetups);
			showNotice(__('Layout setup removed successfully!', 'mosaic-product-layouts'));
		}
	};


	/**
	 * Sets the block attributes for the selected setup.
	 *
	 * @param {{items?: object, itemsInactive?: object, layout: string, zIndex: string, prodElSettings: string}} setup The selected setup.
	 */
	const onChangeSetup = ({ layout, zIndex, grid, prodElSettings, overrides, featImgSize, group }) => {
		setAttributes({
			...overrides && { itemStyleOverrides: overrides },
			savedLayouts: layout,
			itemZindexes: zIndex,
			...grid && { gridSettings: grid },
			productElementSettings: prodElSettings,
			...featImgSize && { featuredImageSize: featImgSize },
			...group && { grouped: group }
		})
	};

	// Component styles.
	const dropDownBorder = context === 'BlockControls' ? '1px solid #000' : '1px solid #ccc';
	const dropdownToggleStyle = { height: '46px', padding: '6px 0', cursor: 'pointer', [context === 'BlockControls' ? 'borderRight' : 'border']: dropDownBorder, padding: '0 8px', background: '#fff' };
	const dropDownStyle = { width: context === 'InspectorControls' ? '100%' : '', zIndex: 9999 }

	const label = __('Select or save setups', 'mosaic-product-layouts');

	if (!isAPILoaded) {
		return (
			<Placeholder>
				<Spinner />
				{error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
			</Placeholder>
		);
	}

	return (
		<BaseControl
			label={
				<Flex>
					{__('My layout and style setups', 'mosaic-product-layouts')}
					<Tooltip text={__('Save current layout and style settings for later usage.', 'mosaic-product-layouts')}>
						<div className="mosaic-product-layouts-help-icon">{helpFilled}</div>
					</Tooltip>
				</Flex>
			}
			__nextHasNoMarginBottom
		>
			<Dropdown
				className="mosaic-product-layouts-popover"
				contentClassName="mosaic-product-layouts__popover-content"
				style={dropDownStyle}
				headerTitle={label}
				popoverProps={{ placement: 'bottom' }}
				renderToggle={({ isOpen, onToggle, onClose }) => (
					<>
						{context === 'InspectorControls' && (
							<Flex
								align="center"
								justify="space-between"
								style={dropdownToggleStyle}
								onClick={onToggle}
								aria-expanded={isOpen}
							>
								<Flex align="center" justify="start"><Icon icon={starFilled} />{label}</Flex>
								<span>
									<Icon icon={isOpen ? chevronUp : chevronDown} />
								</span>

							</Flex>
						)}
						{context === 'BlockControls' && (
							<Tooltip text={label} delay={0}>
								<ToolbarGroup>
									<Button
										aria-expanded={isOpen}
										onClick={onToggle}
										icon={starFilled}
									/>
								</ToolbarGroup>
							</Tooltip>

						)}
					</>
				)}
				renderContent={({ isOpen, onToggle, onClose }) => (
					<>
						{context === 'InspectorControls' && (
							<BaseControl label={userSetups && userSetups.length ? __('Saved setups', 'mosaic-product-layouts') : __('No saved setups. Click on the button bellow to save current layout and style.', 'mosaic-product-layouts')} />
						)}

						<ToggleGroupControl
							className="switch-button-group"
							children={
								userSetups && (userSetups.map((setup) => {
									const setupOptions = {
										itemsInactive: setup.itemsInactive ?? null,
										layout: setup.layout ?? null,
										zIndex: setup.zIndex ?? null,
										grid: setup.grid ?? null,
										prodElSettings: setup.prodElSettings ?? null,
										overrides: setup.overrides ?? null,
										featImgSize: setup.featImgSize ?? null,
										group: setup.group ?? null
									}
									return (
										<div className='button-wrap'>
											<Button
												key={setup.id}
												className='setup-button'
												variant="primary"
												size='small'
												text={setup.name}
												onClick={() => {
													setNewSetupName(setup.name);
													onChangeSetup(setupOptions);
												}}
											/>
											<Icon icon={'no'} onClick={() => handleRemoveSetup(setup.id)} />

										</div>
									)
								}))}
						/>

						<CardDivider margin='10px' />

						<Button variant="primary" size='default' onClick={() => setIsModalOpen(true)}>
							{__('Save current layout and style', 'mosaic-product-layouts')}
						</Button>
						<div onClick={onClose}></div>
					</>
				)}
			/>

			{isModalOpen && (
				<Modal
					title={__('Save current layout and style', 'mosaic-product-layouts')}
					onRequestClose={() => setIsModalOpen(false)}
				>
					<TextControl
						label={newSetupName ? __('Current setup:', 'mosaic-product-layouts') : __('Enter a name to save this setup.', 'mosaic-product-layouts')}
						value={newSetupName}
						onChange={(value) => setNewSetupName(value)}
						disabled={isSaving}
					/>
					<Button
						variant="primary"
						onClick={handleSetupSave}
						isBusy={isSaving}
						disabled={isSaving}
					>
						{isSaving ? __('Saving...', 'mosaic-product-layouts') : __('Save', 'mosaic-product-layouts')}
					</Button>

				</Modal>
			)}

			{showDeleteConfirm && (
				<Modal
					title={__('Confirm Deletion', 'mosaic-product-layouts')}
					onRequestClose={() => {
						setShowDeleteConfirm(false);
						setLayoutToDelete(null);
					}}
				>
					<p>{__('Are you sure you want to delete this saved layout?', 'mosaic-product-layouts')}</p>
					<CheckboxControl
						label={__('Don\'t show this confirmation again', 'mosaic-product-layouts')}
						onChange={(checked) => {
							localStorage.setItem('mpl_skip_delete_confirm', checked);
						}}
					/>
					<Flex justify="flex-end">
						<Button
							variant="secondary"
							onClick={() => {
								setShowDeleteConfirm(false);
								setLayoutToDelete(null);
							}}
						>
							{__('Cancel', 'mosaic-product-layouts')}
						</Button>
						<Button
							variant="primary"
							onClick={() => {
								deleteLayout(layoutToDelete);
								setShowDeleteConfirm(false);
								setLayoutToDelete(null);
							}}
						>
							{__('Delete', 'mosaic-product-layouts')}
						</Button>
					</Flex>
				</Modal>
			)}

		</BaseControl>
	);
};

export default SaveCurrentSetup;
