document.addEventListener("DOMContentLoaded", () => {
	const tocLinks = Array.from(document.querySelectorAll(".toc a"));
	const tocToggle = document.querySelector(".sidebar__toggle");
	const tocPanel = document.querySelector(".sidebar__panel");
	const mobileBreakpoint = window.matchMedia("(max-width: 1080px)");
	const viewport = window.visualViewport;

	/**
	 * Resolves whether the docs UI should use its compact navigation mode.
	 * This checks both layout viewport width and visual viewport width because
	 * embedded previews can report them differently.
	 *
	 * @return {boolean} True when the compact docs layout should be active.
	 */
	const isCompactViewport = () => {
		const visualWidth = viewport ? viewport.width : window.innerWidth;
		return Math.min(window.innerWidth, visualWidth) <= 1080;
	};

	/**
	 * Applies the body class that switches the docs UI into compact mode.
	 *
	 * @return {void}
	 */
	const syncCompactClass = () => {
		document.body.classList.toggle("docs-mobile", isCompactViewport());
	};

	/**
	 * Synchronizes the TOC panel visibility and expanded state for the current
	 * layout mode. The TOC stays open on larger screens and becomes collapsible
	 * in compact mode.
	 *
	 * @return {void}
	 */
	const syncTocPanel = () => {
		if (!tocToggle || !tocPanel) {
			return;
		}

		if (mobileBreakpoint.matches || document.body.classList.contains("docs-mobile")) {
			const isExpanded = tocToggle.getAttribute("aria-expanded") === "true";
			tocPanel.hidden = !isExpanded;
			return;
		}

		tocToggle.setAttribute("aria-expanded", "false");
		tocPanel.hidden = false;
	};

	if (tocToggle && tocPanel) {
		syncCompactClass();
		tocToggle.addEventListener("click", () => {
			const isExpanded = tocToggle.getAttribute("aria-expanded") === "true";
			tocToggle.setAttribute("aria-expanded", String(!isExpanded));
			syncTocPanel();
		});

		mobileBreakpoint.addEventListener("change", () => {
			syncCompactClass();
			syncTocPanel();
		});
		window.addEventListener("resize", () => {
			syncCompactClass();
			syncTocPanel();
		});
		if (viewport) {
			viewport.addEventListener("resize", () => {
				syncCompactClass();
				syncTocPanel();
			});
		}
		syncTocPanel();
	}

	const sections = tocLinks
		.map((link) => {
			const targetId = link.getAttribute("href");
			if (!targetId || !targetId.startsWith("#")) {
				return null;
			}

			const section = document.querySelector(targetId);
			if (!section) {
				return null;
			}

			return { link, section };
		})
		.filter(Boolean);

	if (!sections.length || !("IntersectionObserver" in window)) {
		return;
	}

	/**
	 * Marks the matching TOC link as active and exposes the current location to
	 * assistive technology.
	 *
	 * @param {string} activeId The fragment identifier for the active section.
	 * @return {void}
	 */
	const setActiveLink = (activeId) => {
		sections.forEach(({ link, section }) => {
			const isActive = `#${section.id}` === activeId;
			link.classList.toggle("is-active", isActive);
			if (isActive) {
				link.setAttribute("aria-current", "location");
			} else {
				link.removeAttribute("aria-current");
			}
		});
	};

	/**
	 * Observes section visibility so the sticky TOC can track the current section
	 * as the user scrolls through the page.
	 *
	 * @type {IntersectionObserver}
	 */
	const observer = new IntersectionObserver(
		(entries) => {
			const visibleEntries = entries
				.filter((entry) => entry.isIntersecting)
				.sort((left, right) => right.intersectionRatio - left.intersectionRatio);

			if (!visibleEntries.length) {
				return;
			}

			setActiveLink(`#${visibleEntries[0].target.id}`);
		},
		{
			rootMargin: "-20% 0px -60% 0px",
			threshold: [0.2, 0.35, 0.5, 0.75],
		}
	);

	sections.forEach(({ section }) => observer.observe(section));
	setActiveLink(window.location.hash || "#overview");

	tocLinks.forEach((link) => {
		link.addEventListener("click", () => {
			if (!tocToggle || !tocPanel || (!mobileBreakpoint.matches && !document.body.classList.contains("docs-mobile"))) {
				return;
			}

			tocToggle.setAttribute("aria-expanded", "false");
			syncTocPanel();
		});
	});
});
