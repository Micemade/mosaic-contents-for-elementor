import React, { useEffect, useRef, useState } from 'react';

const getRestNonce = () => {
	return window.MPL4E?.restNonce || window.parent?.MPL4E?.restNonce || '';
};

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
	const nonce = getRestNonce();
	const response = await fetch(`/wp-json/mpl4e/v1/categories/${categoryId}/image`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			...(nonce ? { 'X-WP-Nonce': nonce } : {}),
		},
		body: JSON.stringify({ attachmentId }),
	});

	if (!response.ok) {
		const errorJson = await response.json().catch(() => ({}));
		const message = errorJson?.message || 'Failed to update category image.';
		throw new Error(message);
	}

	return response.json();
};

const uploadMedia = async (file) => {
	const nonce = getRestNonce();
	const formData = new FormData();
	formData.append('file', file, file.name);

	const response = await fetch('/wp-json/wp/v2/media', {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			...(nonce ? { 'X-WP-Nonce': nonce } : {}),
		},
		body: formData,
	});

	if (!response.ok) {
		const errorJson = await response.json().catch(() => ({}));
		const message = errorJson?.message || 'Upload failed.';
		throw new Error(message);
	}

	return response.json();
};

const CategoryImageModal = ({ isOpen, category, onClose, onSaved }) => {
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const fileInputRef = useRef(null);
	const titleId = 'mpl4e-cat-image-modal-title';

	useEffect(() => {
		if (!isOpen) {
			setError('');
			setIsSaving(false);
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

	const applyAttachment = async (attachmentLike) => {
		const image = toImagePayload(attachmentLike);
		if (!image) {
			setError('Invalid image selected.');
			return;
		}

		setIsSaving(true);
		setError('');
		try {
			const result = await saveCategoryImage(category.id, image.id);
			onSaved(result);
		} catch (err) {
			setError(err.message || 'Failed to set category image.');
		} finally {
			setIsSaving(false);
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
			await applyAttachment(normalized);
		} catch (err) {
			setError(err.message || 'Failed to upload image.');
			setIsSaving(false);
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
				<p className="mpl4e-cat-image-modal-subtitle">{category.name}</p>

				<div className="mpl4e-cat-image-modal-actions">
					<button type="button" onClick={handleChooseLibrary} disabled={isSaving}>
						Choose from Library
					</button>
					<button type="button" onClick={handleFileClick} disabled={isSaving}>
						Upload New
					</button>
					<button type="button" onClick={handleRemove} disabled={isSaving}>
						Remove Image
					</button>
				</div>

				<input
					type="file"
					accept="image/*"
					ref={fileInputRef}
					onChange={handleFileChange}
					style={{ display: 'none' }}
				/>

				{error ? <p className="mpl4e-cat-image-modal-error">{error}</p> : null}

				<div className="mpl4e-cat-image-modal-footer">
					<button type="button" onClick={onClose} disabled={isSaving}>Close</button>
				</div>
			</div>
		</div>
	);
};

export default CategoryImageModal;
