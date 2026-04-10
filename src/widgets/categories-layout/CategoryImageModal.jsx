import React, { useEffect, useRef, useState } from 'react';
import { getRestNonceHeaders, parseJsonOrThrow } from '../../shared/utils/fetchHelpers.js';

const getWpMedia = () => {
	return window.parent?.wp?.media || window.wp?.media || null;
};

const toImagePayload = (attachment) => {
	if (!attachment?.id || !attachment?.url) {
		return null;
	}

	const thumbnail = attachment?.sizes?.thumbnail?.url || attachment.url;
	return {
		id: attachment.id,
		src: attachment.url,
		thumbnail,
		alt: attachment.alt || '',
	};
};

const saveCategoryImage = async (categoryId, attachmentId) => {
	const response = await fetch(`/wp-json/mpl4e/v1/categories/${categoryId}/image`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			...getRestNonceHeaders(),
		},
		body: JSON.stringify({ attachmentId }),
	});

	return parseJsonOrThrow(response, 'Failed to update category image.');
};

const uploadMedia = async (file) => {
	const formData = new FormData();
	formData.append('file', file, file.name);

	const response = await fetch('/wp-json/wp/v2/media', {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			...getRestNonceHeaders(),
		},
		body: formData,
	});

	return parseJsonOrThrow(response, 'Upload failed.');
};

const CategoryImageModal = ({ isOpen, category, onClose, onSaved }) => {
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadingAndApplying, setIsUploadingAndApplying] = useState(false);
	const [error, setError] = useState('');
	const fileInputRef = useRef(null);
	const titleId = 'mpl4e-cat-image-modal-title';

	useEffect(() => {
		if (!isOpen) {
			setError('');
			setIsSaving(false);
			setIsUploadingAndApplying(false);
			return undefined;
		}

		setError('');

		if (!isOpen) return undefined;
		const onKeyDown = (event) => {
			if (event.key === 'Escape' && !isSaving) {
				onClose();
			}
		};
		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [isOpen, isSaving, onClose]);

	if (!isOpen || !category) {
		return null;
	}

	const applyAttachment = async (attachmentLike, options = {}) => {
		const { manageSavingState = true } = options;
		const image = toImagePayload(attachmentLike);
		if (!image) {
			setError('Invalid image selected.');
			return;
		}

		if (manageSavingState) {
			setIsSaving(true);
		}
		setError('');
		try {
			const result = await saveCategoryImage(category.id, image.id);
			onSaved(result);
		} catch (err) {
			setError(err.message || 'Failed to set category image.');
		} finally {
			if (manageSavingState) {
				setIsSaving(false);
			}
		}
	};

	const handleChooseLibrary = () => {
		const media = getWpMedia();
		if (!media) {
			setError('Media library is not available in this context.');
			return;
		}

		const frame = media({
			title: 'Select category image',
			button: { text: 'Use image' },
			library: { type: 'image' },
			multiple: false,
		});

		frame.on('select', () => {
			const selected = frame.state().get('selection').first();
			if (!selected) return;
			applyAttachment(selected.toJSON());
		});

		frame.open();
	};

	const handleFileClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
			fileInputRef.current.click();
		}
	};

	const handleFileChange = async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsUploadingAndApplying(true);
		setIsSaving(true);
		setError('');
		try {
			const uploaded = await uploadMedia(file);
			const normalized = {
				id: uploaded.id,
				url: uploaded.source_url,
				sizes: uploaded.media_details?.sizes || {},
				alt: uploaded.alt_text || '',
			};
			await applyAttachment(normalized, { manageSavingState: false });
		} catch (err) {
			setError(err.message || 'Failed to upload image.');
		} finally {
			setIsSaving(false);
			setIsUploadingAndApplying(false);
		}
	};

	const handleRemove = async () => {
		setIsSaving(true);
		setError('');
		try {
			const result = await saveCategoryImage(category.id, 0);
			onSaved(result);
		} catch (err) {
			setError(err.message || 'Failed to remove category image.');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			className="mpl4e-cat-image-modal-backdrop"
			onMouseDown={() => {
				if (!isSaving) {
					onClose();
				}
			}}
		>
			<div
				className="mpl4e-cat-image-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<h4 id={titleId} className="mpl4e-cat-image-modal-title">Manage Category Image</h4>
				<p className="mpl4e-cat-image-modal-subtitle">for the "<strong>{category.name}</strong>" category</p>

				<div className="mpl4e-cat-image-modal-actions">
					<button type="button" onClick={handleChooseLibrary} disabled={isSaving}>
						Choose from Library
					</button>
					<button type="button" onClick={handleFileClick} disabled={isSaving}>
						Upload New
					</button>
					{category.image?.src && (
						<button type="button" onClick={handleRemove} disabled={isSaving}>
							Remove Image
						</button>
					)}
				</div>

				<p className="mpl4e-cat-image-modal-note"><strong>NOTE:</strong> Changing the category image will affect how it appears across the site.</p>

				<input
					type="file"
					accept="image/*"
					ref={fileInputRef}
					onChange={handleFileChange}
					style={{ display: 'none' }}
				/>

				{error ? <p className="mpl4e-cat-image-modal-error">{error}</p> : null}

				<div className="mpl4e-cat-image-modal-footer">
					<button
						type="button"
						onClick={onClose}
						disabled={isSaving}
						title='Close the modal'
					>
						<i className="eicon-close" aria-hidden="true" />
					</button>
				</div>

				{isUploadingAndApplying ? (
					<div className="mpl4e-cat-image-modal-overlay" role="status" aria-live="polite">
						<span>Uploading and applying</span>
					</div>
				) : null}
			</div>
		</div>
	);
};

export default CategoryImageModal;
