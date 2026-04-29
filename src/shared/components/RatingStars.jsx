/**
 * Wordpress dependencies
 */
import { __ } from "@wordpress/i18n";

const RatingStars = ({ rating, reviewCount }) => {

	const widthPerc = (rating / 5) * 100;

	const starDivs = Array(5).fill().map((_, index) => (<div key={index} className="star" />));

	// Add review count text for single or multiple reviews.
	const reviewCountText = reviewCount === 1 ?
		`${reviewCount} ${__(" review", "mosaic-contents-for-elementor")} ` :
		`${reviewCount} ${__(" reviews", "mosaic-contents-for-elementor")} `;
	// Add average rating text and rating.
	const average = reviewCount && `${__("with average product rating:", "mosaic-contents-for-elementor")} ${rating}`;
	// Final review text or no reviews.
	const reviewCountTextAverage = reviewCount ? `${reviewCountText}${average}` : __("No reviews yet.", "mosaic-contents-for-elementor");

	return (
		<>
			<div
				className="rating-stars"
				aria-label={`${reviewCountTextAverage}`}
				title={`${reviewCountTextAverage}`}
			>
				<div className="rated-perc" style={{ width: `${widthPerc}%` }}>
					<div className="stars">{starDivs}</div>
				</div>

				<div className="stars placeholder">{starDivs}</div>

			</div>
		</>
	)
}

export default RatingStars;
