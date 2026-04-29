# Images, Media, and Dynamic Content — Full Code Examples

Detailed examples for images, media, and SPA dynamic content patterns. See the main SKILL.md for testing checklists.

## Alt Text (SC 1.1.1)

```html
<!-- Informative image: describe content -->
<img src="chart-q3.png" alt="Q3 revenue chart showing 23% growth over Q2">

<!-- Decorative image: empty alt -->
<img src="divider-line.png" alt="">

<!-- Image that is a link: describe destination -->
<a href="/profile">
  <img src="avatar.jpg" alt="Your profile">
</a>

<!-- Complex image: long description -->
<figure>
  <img src="org-chart.png" alt="Company organization chart"
       aria-describedby="org-chart-desc">
  <figcaption id="org-chart-desc">
    The CEO oversees three divisions: Engineering (VP Jane Smith, 45 staff),
    Marketing (VP John Doe, 22 staff), and Operations (VP Lisa Park, 30 staff).
  </figcaption>
</figure>
```

## SVG Accessibility (SC 1.1.1, 4.1.2)

```html
<!-- Informative SVG: needs accessible name -->
<svg role="img" aria-labelledby="svg-title svg-desc"
     viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <title id="svg-title">Warning</title>
  <desc id="svg-desc">Yellow triangle with exclamation mark</desc>
  <path d="M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6z"/>
  <path d="M11 10h2v5h-2zm0 6h2v2h-2z"/>
</svg>

<!-- Decorative SVG icon: hide from assistive tech -->
<button type="button">
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
  </svg>
  Menu
</button>
```

When SVG icons appear inside buttons or links with visible text, mark the SVG `aria-hidden="true"` and add `focusable="false"` (for IE/Edge legacy).

## Video and Audio (SC 1.2.1, 1.2.2, 1.2.3, 1.2.5)

```html
<figure>
  <video controls aria-label="Product demo video">
    <source src="demo.mp4" type="video/mp4">
    <track kind="captions" src="demo-en.vtt" srclang="en"
           label="English captions" default>
    <track kind="descriptions" src="demo-desc-en.vtt" srclang="en"
           label="English audio descriptions">
    <p>Your browser does not support video.
       <a href="demo.mp4">Download the video</a> or
       <a href="transcript.html">read the transcript</a>.</p>
  </video>
  <figcaption>
    <a href="transcript.html">Full transcript of this video</a>
  </figcaption>
</figure>
```

### Requirements by Media Type

| Media | Level A | Level AA |
|---|---|---|
| Pre-recorded video with audio | Captions OR transcript | Captions AND audio descriptions |
| Pre-recorded audio only | Transcript | Transcript |
| Pre-recorded video only | Text alternative or audio track | Audio descriptions |
| Live video with audio | Captions | Captions |

## Reduced Motion (SC 2.3.1, 2.3.3)

```css
/* Default: provide animations */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

/* Respect user preference to reduce motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Any content that blinks, flashes, or auto-scrolls must have pause/stop controls. Nothing should flash more than 3 times per second (SC 2.3.1).

## Route Change Announcements (SC 4.1.3)

When a SPA changes routes without a full page reload, screen readers do not automatically announce the new content. You must programmatically manage this:

```javascript
// Pattern: visually hidden live region for route announcements
const ANNOUNCER_STYLES = [
  'position: absolute',
  'width: 1px',
  'height: 1px',
  'padding: 0',
  'margin: -1px',
  'overflow: hidden',
  'clip: rect(0, 0, 0, 0)',
  'white-space: nowrap',
  'border: 0',
].join(';');

function createRouteAnnouncer() {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('style', ANNOUNCER_STYLES);
  document.body.appendChild(el);
  return el;
}

const routeAnnouncer = createRouteAnnouncer();

function navigateTo(path, title) {
  // Render new content...
  document.title = title;

  // Clear then set (ensures re-announcement even if same text)
  routeAnnouncer.textContent = '';
  setTimeout(() => {
    routeAnnouncer.textContent = `Navigated to ${title}`;
  }, 100);

  // Move focus to main content
  const main = document.querySelector('main');
  main.setAttribute('tabindex', '-1');
  main.focus();
}
```

## Loading States (SC 4.1.3)

```html
<div id="content-area" aria-busy="false">
  <!-- Dynamic content here -->
</div>
<div id="loading-status" aria-live="polite" class="sr-only"></div>
```

```javascript
async function loadContent(url) {
  const area = document.getElementById('content-area');
  const status = document.getElementById('loading-status');

  area.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading content...';

  try {
    const data = await fetch(url).then((r) => r.json());
    area.setAttribute('aria-busy', 'false');
    // Render content into area...
    status.textContent = 'Content loaded';
  } catch {
    area.setAttribute('aria-busy', 'false');
    status.textContent = 'Failed to load content';
  }
}
```

## Toast Notifications (SC 4.1.3)

```html
<!-- Container for toast messages -->
<div id="toast-container" aria-live="polite" aria-relevant="additions">
</div>
```

```javascript
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-dismiss after 5 seconds (but never for errors)
  if (type !== 'error') {
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
}
```

## Infinite Scroll Alternative (SC 2.1.1, 2.4.1)

```html
<!-- Always provide a pagination alternative to infinite scroll -->
<nav aria-label="Results navigation">
  <ul>
    <li><a href="?page=1" aria-current="page">1</a></li>
    <li><a href="?page=2">2</a></li>
    <li><a href="?page=3">3</a></li>
  </ul>
</nav>

<!-- If using infinite scroll, announce new content -->
<div aria-live="polite" id="scroll-status" class="sr-only"></div>
```

```javascript
function onNewItemsLoaded(count) {
  document.getElementById('scroll-status').textContent =
    `${count} more items loaded. Total items: ${getTotalCount()}.`;
}
```
