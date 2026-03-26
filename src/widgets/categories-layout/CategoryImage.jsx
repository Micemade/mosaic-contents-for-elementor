/**
 * WordPress dependencies.
 */
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';

/**
 * Category Image Component.
 *
 * Renders category thumbnail from Store API data.
 *
 * @param {Object} props
 * @param {Object|null} props.image - Image object from Store API { src, thumbnail }
 * @param {string} props.name - Category name (for alt text)
 * @param {Object} props.style - CSS styles for img element
 */
const CategoryImage = ({ image, name, style = {} }) => {

	const placeholderImg = window.MPL4E?.placeholderImg || ''
	
	// Image fallback (WC placeholder image or local placeholder).
	const fallback = (
		<img
			src={placeholderImg}
			alt={__('No category image', 'mosaic-product-layouts-for-elementor')}
		/>
	);

	const [isLoaded, setIsLoaded] = useState(false);

	const imgSrcSet = image?.srcset || null;
	const imgSrc = image?.src || null;

	useEffect(() => {
		if (!imgSrc && !imgSrcSet) return;

		setIsLoaded(false); // Reset when image changes

		const img = new window.Image();
		if (imgSrcSet) img.srcset = imgSrcSet;
		if (imgSrc) img.src = imgSrc;
		img.onload = () => setIsLoaded(true);

		return () => {
			img.onload = null;
		};
	}, [imgSrc, imgSrcSet]);

	if (!imgSrc && !imgSrcSet) {
		return fallback;
	}

	return (
		<>
			{!isLoaded && <div className="gradient-preloader" />}
			{isLoaded && (
				<img
					src={imgSrc}
					{...(imgSrcSet ? { srcSet: imgSrcSet } : {})}
					alt={name}
					loading="lazy"
					className="fade-in-image"
					style={style}
				/>
			)}
		</>
	);
};

export default CategoryImage;
