import { useMemo } from 'react';
import './Pagination.scss';

const BREAK = 'break';

/**
 * Build the list of page entries to render, with BREAK markers where ellipsis should appear.
 * Mirrors the react-paginate algorithm:
 *   - Always show `marginPagesDisplayed` pages at each end.
 *   - Show a window of `pageRangeDisplayed` pages centred on currentPage.
 *   - Insert a BREAK where there is a gap > 0 between the margin and the window.
 *
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {number} pageRangeDisplayed  Pages shown around current page.
 * @param {number} marginPagesDisplayed  Pages always shown at start and end.
 * @returns {Array<number|'break'>}
 */
function buildPageList( currentPage, totalPages, pageRangeDisplayed = 5, marginPagesDisplayed = 1 ) {
	// Below this threshold every page fits without any ellipsis.
	const noBreakThreshold = pageRangeDisplayed + marginPagesDisplayed * 2 + 2;
	if ( totalPages <= noBreakThreshold ) {
		return Array.from( { length: totalPages }, ( _, i ) => i + 1 );
	}

	const halfRange = Math.floor( ( pageRangeDisplayed - 1 ) / 2 );

	// Preferred window start, clamped inside the non-margin zone.
	let rangeStart = Math.max( marginPagesDisplayed + 1, currentPage - halfRange );
	let rangeEnd   = rangeStart + pageRangeDisplayed - 1;

	// If the window extends into the right margin, shift it left.
	if ( rangeEnd > totalPages - marginPagesDisplayed ) {
		rangeEnd   = totalPages - marginPagesDisplayed;
		rangeStart = Math.max( marginPagesDisplayed + 1, rangeEnd - pageRangeDisplayed + 1 );
	}

	const pages = [];

	// Left margin.
	for ( let i = 1; i <= marginPagesDisplayed; i++ ) pages.push( i );

	// Left break — only when there is a gap of more than zero between the margin and the window.
	if ( rangeStart > marginPagesDisplayed + 1 ) pages.push( BREAK );

	// Window around current page.
	for ( let i = rangeStart; i <= rangeEnd; i++ ) pages.push( i );

	// Right break.
	if ( rangeEnd < totalPages - marginPagesDisplayed ) pages.push( BREAK );

	// Right margin.
	for ( let i = totalPages - marginPagesDisplayed + 1; i <= totalPages; i++ ) pages.push( i );

	return pages;
}

const Pagination = ( {
	currentPage          = 1,
	totalPages           = 1,
	total                = 0,
	itemsPerLayout       = 10,
	onPageChange,
	pageRangeDisplayed   = 5,
	marginPagesDisplayed = 2,
} ) => {
	const showPageNumbers = total > ( Number( itemsPerLayout ) || 0 ) * 2;

	const pageList = useMemo(
		() => buildPageList( currentPage, totalPages, pageRangeDisplayed, marginPagesDisplayed ),
		[ currentPage, totalPages, pageRangeDisplayed, marginPagesDisplayed ]
	);

	const goToPage = ( page ) => {
		if ( typeof onPageChange !== 'function' ) return;
		if ( page === currentPage ) return;
		if ( page < 1 || page > totalPages ) return;
		onPageChange( page );
	};

	if ( totalPages <= 1 ) {
		return null;
	}

	return (
		<nav className="mc4e-pagination" aria-label="Products pagination">
			<button
				type="button"
				className="mc4e-pagination-btn"
				onClick={ () => goToPage( currentPage - 1 ) }
				disabled={currentPage <= 1}
				title='Previous'
			>
				<i className="eicon-chevron-left" aria-hidden="true" />
			</button>

			{ showPageNumbers && (
				<div className="mc4e-pagination-pages" role="group" aria-label="Page numbers">
					{ pageList.map( ( page, index ) =>
						page === BREAK ? (
							<span
								key={ `break-${ index }` }
								className="mc4e-pagination-break"
								aria-hidden="true"
							>
								&hellip;
							</span>
						) : (
							<button
								type="button"
								key={ page }
								className={ `mc4e-pagination-page${ page === currentPage ? ' is-active' : '' }` }
								onClick={ () => goToPage( page ) }
								aria-current={ page === currentPage ? 'page' : undefined }
							>
								{ page }
							</button>
						)
					) }
				</div>
			) }

			<button
				type="button"
				className="mc4e-pagination-btn"
				onClick={ () => goToPage( currentPage + 1 ) }
				disabled={ currentPage >= totalPages }
				title='Next'
			>
				<i className="eicon-chevron-right" aria-hidden="true" />
			</button>
		</nav>
	);
};

export default Pagination;
