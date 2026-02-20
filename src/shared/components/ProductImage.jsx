/**
 * WordPress dependencies.
 */
import { __ } from '@wordpress/i18n';
import { memo } from '@wordpress/element';
import PropTypes from 'prop-types';

import placeholderImgForBuild from '../woocommerce-placeholder-300x300.png';

// Get placeholder image URL from localized script data
const placeholderImg = window.MPL4E?.placeholderImg || '';

/**
 * Internal dependencies.
 */
import { getFeaturedImage } from '../utils/productUtils';

const getImageProperties = (images) => {

	if (!images?.[0]) return {};
	const featWcImage = images[0];

	return {
		srcset: featWcImage.srcset,
		src: featWcImage.src,
		sizes: featWcImage.sizes
	};
};

const ProductImage = ({ productId, name, images, featuredImageSize, style = {} }) => {

	// No productId, no image.
	if (!productId) return null;

	// Image fallback (WC placeholder image or notice.)
	const fallback = (
		<img
			src={typeof wc === 'object' ? wc?.wcSettings?.PLACEHOLDER_IMG_SRC : placeholderImg}
			alt={__('Product has no featured image', 'mosaic-product-layouts-for-elementor')}
		/>
	);

	// If "featuredImageSize" is set to 'automatic', use imgSrc (default).
	const isAuto = featuredImageSize === 'automatic';

	// Fallback for image alt attribute.
	const altFallback = __('Product image', 'mosaic-product-layouts-for-elementor');

	// Get featured image using custom hook
	// (only if not in 'automatic' mode, otherwise we get srcset and sizes from "images" prop)
	const { loadingFeaturedImg, featuredImage } = isAuto ? { loadingFeaturedImg: false, featuredImage: null } : getFeaturedImage(productId, featuredImageSize);

	// if (loadingFeaturedImg) {
	// 	return <div className='gradient-preloader' />;
	// }

	// Get image properties only if in 'automatic' mode
	const { srcset, src, sizes } = isAuto ? getImageProperties(images) : {};

	return (images.length) ? (
		<img
			{...(isAuto && srcset && { srcSet: srcset })}
			src={isAuto ? src : featuredImage}
			alt={(name || altFallback)}
			style={style}
			{...(sizes && isAuto && { sizes: sizes })}
			loading="lazy"
			className={`fade-in-image${!loadingFeaturedImg ? ' loaded' : ''}`}
		/>
	) : (
		<>{fallback}</>
	);
};

ProductImage.propTypes = {
	// Required props
	productId: PropTypes.oneOfType([
		PropTypes.string,
		PropTypes.number
	]).isRequired,

	// Optional props with specific shapes
	images: PropTypes.arrayOf(
		PropTypes.shape({
			id: PropTypes.number,
			src: PropTypes.string,
			srcset: PropTypes.string,
			sizes: PropTypes.string
		})
	),

	name: PropTypes.string,
	// String - accepts any registered WordPress image size name
	featuredImageSize: PropTypes.string,

	// Object for style
	style: PropTypes.object
};

// Default props (optional)
ProductImage.defaultProps = {
	images: [],
	featuredImageSize: 'automatic',
	style: {}
};

export default memo(ProductImage);
