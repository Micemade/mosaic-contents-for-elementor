/**
 * WordPress dependencies.
 */
import { __ } from '@wordpress/i18n';
import { memo } from '@wordpress/element';
import PropTypes from 'prop-types';
import placeholderImg from '../../shared/woocommerce-placeholder-300x300.png';

/**
 * Internal dependencies.
 */
import getProduct from '../utils/getProduct';
import getFeaturedImage from '../utils/getFeaturedImage';

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
			alt={__('Product has no featured image', 'mosaic-product-layouts')}
		/>
	);

	// If "featuredImageSize" is set to 'automatic', use imgSrc (default).
	const isAuto = featuredImageSize === 'automatic';

	// Fallback for image alt attribute.
	const altFallback = __('Product image', 'mosaic-product-layouts');

	// Only fetch product and featured image if not in 'automatic' mode
	const { product, loading } = isAuto ? { product: null, loading: false } : getProduct(productId);
	const { loadingFeaturedImg, featuredImage } = isAuto ? { loadingFeaturedImg: false, featuredImage: null } : getFeaturedImage(productId, featuredImageSize);

	if (loading || loadingFeaturedImg) {
		return <div className='gradient-preloader' />;
	}

	// Get image properties only if in 'automatic' mode
	const { srcset, src, sizes } = isAuto ? getImageProperties(images) : {};

	return (images.length) ? (
		<img
			{...(srcset && isAuto && { srcSet: srcset })}
			src={isAuto ? src : featuredImage}
			alt={isAuto ? (name || altFallback) : (product?.name || altFallback)}
			style={style}
			{...(sizes && isAuto && { sizes: sizes })}
			loading="lazy"
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
	// String with specific values
	featuredImageSize: PropTypes.oneOf([
		'automatic',
		'thumbnail',
		'medium',
		'large',
		'full'
	]),

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
