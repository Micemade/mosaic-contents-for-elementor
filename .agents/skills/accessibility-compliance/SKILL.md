---
name: accessibility-compliance
description: Use when building web interfaces, HTML templates, forms, navigation, modals, dynamic content, media players, or any user-facing UI — WCAG 2.1, WCAG 2.2, Level A, Level AA, POUR principles, alt text, aria-label, aria-describedby, role, tabindex, focus management, color contrast, 4.5:1 ratio, screen reader, NVDA, VoiceOver, axe, lighthouse, ARIA roles, semantic HTML, keyboard navigation
---

## 1. Overview

WCAG (Web Content Accessibility Guidelines) 2.1/2.2 are the international standards published by the W3C for making web content accessible to people with disabilities. Approximately 15% of the world population — over 1 billion people — live with some form of disability, including visual, auditory, motor, and cognitive impairments. Accessibility is also a legal requirement in many jurisdictions: the Americans with Disabilities Act (ADA) in the US, the European Accessibility Act (EAA) in the EU, and Section 508 for US federal agencies. WCAG defines three conformance levels: **Level A** (minimum baseline, must fix), **Level AA** (the standard target for legal compliance and production websites), and **Level AAA** (enhanced accessibility, aspirational for most sites). All code produced should target **WCAG 2.1 Level AA** at minimum, incorporating 2.2 criteria where applicable.

## 2. The Four Principles (POUR)

Every WCAG success criterion falls under one of four principles:

| Principle | Meaning | Key Success Criteria |
|---|---|---|
| **Perceivable** | Information and UI must be presentable in ways users can perceive | 1.1.1 Non-text Content, 1.2.x Time-based Media, 1.3.x Adaptable, 1.4.3 Contrast (Minimum), 1.4.4 Resize Text, 1.4.11 Non-text Contrast |
| **Operable** | UI components and navigation must be operable by all users | 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order, 2.4.7 Focus Visible, 2.5.5 Target Size, 2.5.8 Target Size (Minimum) |
| **Understandable** | Information and UI operation must be understandable | 3.1.1 Language of Page, 3.2.1 On Focus, 3.2.2 On Input, 3.3.1 Error Identification, 3.3.2 Labels or Instructions |
| **Robust** | Content must be compatible with current and future assistive technologies | 4.1.1 Parsing, 4.1.2 Name/Role/Value, 4.1.3 Status Messages |

## 3. Semantic HTML (Foundation)

Semantic HTML is the single most impactful accessibility practice. Native HTML elements carry built-in roles, keyboard behavior, and screen reader announcements that no amount of ARIA can fully replicate. Always prefer native elements over custom constructs.

> Full code examples: `resources/semantic-html.md`

| Rule | WCAG SC | Wrong | Right |
|---|---|---|---|
| Use `<button>` for actions | 4.1.2, 2.1.1 | `<div class="btn" onclick>` | `<button type="submit">` |
| Use landmark elements | 1.3.1, 2.4.1 | `<div class="header">` | `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` |
| Label multiple `<nav>`/`<aside>` | 1.3.1 | Unlabeled duplicate landmarks | `<nav aria-label="Main navigation">` |
| Heading hierarchy, no skipping | 1.3.1 | `<h1>` then `<h3>` | `<h1>` > `<h2>` > `<h3>` sequentially |
| One `<h1>` per page | 1.3.1 | Multiple `<h1>` or none | Exactly one `<h1>` |
| Data tables with `<caption>` and `<th scope>` | 1.3.1 | Layout tables, missing headers | `<caption>`, `<th scope="col/row">` |
| Explicit `<label for>` on inputs | 1.3.1, 3.3.2 | `<input placeholder="Email">` | `<label for="email">Email</label><input id="email">` |
| Group related inputs with `<fieldset>`/`<legend>` | 1.3.1 | Ungrouped radio/checkbox sets | `<fieldset><legend>` wrapping the group |
| `<a href>` for navigation, `<button>` for actions | 4.1.2 | `<a href="#">` for actions | `<a>` navigates; `<button>` acts |
| Use `<ol>`/`<ul>` for groups | 1.3.1 | Flat divs for nav items | `<nav><ol><li>` for breadcrumbs, etc. |

## 4. ARIA (When Semantic HTML Is Not Enough)

**First rule of ARIA: do not use ARIA if a native HTML element provides the semantics you need.** ARIA overrides native semantics and adds complexity. Misused ARIA is worse than no ARIA at all.

> Full component code examples: `resources/aria-patterns.md`

### 4.1 Common ARIA Roles and States

| Widget | Roles | Required States/Properties |
|---|---|---|
| Tabs | `tablist`, `tab`, `tabpanel` | `aria-selected`, `aria-controls`, `aria-labelledby` |
| Modal Dialog | `dialog` | `aria-modal="true"`, `aria-labelledby` |
| Accordion | (native elements) | `aria-expanded`, `aria-controls` |
| Dropdown Menu | `menu`, `menuitem` | `aria-haspopup`, `aria-expanded` |
| Alert | `alert` | (auto-announced, assertive) |
| Status Message | `status` | (polite announcement) |
| Progress Bar | `progressbar` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` |
| Live Region | (container) | `aria-live="polite"` or `aria-live="assertive"` |
| Toggle Button | `button` | `aria-pressed="true/false"` |
| Switch | `switch` | `aria-checked="true/false"` |
| Tree View | `tree`, `treeitem` | `aria-expanded`, `aria-selected`, `aria-level` |
| Combobox | `combobox`, `listbox`, `option` | `aria-expanded`, `aria-activedescendant`, `aria-autocomplete` |

### 4.2 Live Regions (SC 4.1.3)

```html
<!-- Polite: announced after current speech finishes -->
<div aria-live="polite" id="status-region" class="sr-only"></div>

<!-- Assertive: interrupts current speech immediately -->
<div role="alert" id="error-region"></div>
```

```javascript
// Announce a status message
function announceStatus(message) {
  const region = document.getElementById('status-region');
  region.textContent = message; // Screen reader announces change
}

// Usage
announceStatus('3 results found');
announceStatus('File uploaded successfully');
```

## 7. Color and Contrast

### 7.1 Contrast Ratios (SC 1.4.3, 1.4.6, 1.4.11)

| Element | Minimum Ratio (AA) | Enhanced Ratio (AAA) |
|---|---|---|
| Normal text (below 18pt / 14pt bold) | 4.5:1 | 7:1 |
| Large text (18pt+ or 14pt+ bold) | 3:1 | 4.5:1 |
| UI components and graphical objects | 3:1 | N/A |
| Disabled controls and decorative elements | No requirement | No requirement |

### 7.2 Never Use Color Alone (SC 1.4.1)

```html
<!-- WRONG: only color differentiates error -->
<input style="border-color: red;">

<!-- RIGHT: color + icon + text -->
<div class="form-group has-error">
  <label for="username">Username</label>
  <input id="username" aria-invalid="true" aria-describedby="username-error">
  <p id="username-error" class="error-message">
    <svg aria-hidden="true" class="icon-error"><!-- error icon --></svg>
    Username is already taken
  </p>
</div>
```

```css
/* Links: use underline in addition to color */
a {
  color: #0055cc;
  text-decoration: underline;
}

/* Don't remove underline unless another visual cue exists */
a:hover {
  text-decoration: underline;
  color: #003d99;
}
```

### 7.3 High Contrast and User Preferences (SC 1.4.3)

```css
/* Respect user's color scheme preference */
@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #e0e0e0;
    --bg-color: #121212;
    --link-color: #80b4ff;
  }
}

/* Respect user's contrast preference */
@media (prefers-contrast: more) {
  :root {
    --text-color: #000;
    --bg-color: #fff;
    --border-color: #000;
  }

  button, input, select {
    border: 2px solid #000;
  }
}

/* Windows High Contrast Mode (forced-colors) */
@media (forced-colors: active) {
  .custom-checkbox .checkmark {
    forced-color-adjust: none;
    border: 2px solid ButtonText;
  }

  :focus-visible {
    outline: 3px solid Highlight;
  }
}
```

### 7.4 Charts and Data Visualization (SC 1.4.1)

```css
/* Use patterns in addition to colors for chart bars */
.bar-revenue {
  background-color: #2563eb;
  background-image: repeating-linear-gradient(
    45deg, transparent, transparent 5px,
    rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px
  );
}

.bar-expenses {
  background-color: #dc2626;
  background-image: repeating-linear-gradient(
    -45deg, transparent, transparent 5px,
    rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px
  );
}
```

Always provide a data table alternative alongside charts.

## 10. Responsive and Mobile

### 10.1 Touch Target Size (SC 2.5.5, 2.5.8)

```css
/* Minimum 44x44 CSS pixels for all interactive elements */
button, a, input[type="checkbox"], input[type="radio"],
select, [role="button"], [role="tab"], [role="menuitem"] {
  min-height: 44px;
  min-width: 44px;
}

/* For inline links within text, add padding to increase target */
p a {
  padding: 0.25em 0;
}
```

### 10.2 Viewport and Zoom (SC 1.4.4, 1.4.10)

```html
<!-- RIGHT: allows zoom -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- WRONG: prevents zoom (violates SC 1.4.4) -->
<meta name="viewport" content="width=device-width, initial-scale=1,
  maximum-scale=1, user-scalable=no">
```

### 10.3 Content Reflow (SC 1.4.10)

Content must reflow without horizontal scrolling at 320px CSS width (equivalent to 1280px at 400% zoom):

```css
/* Use relative units and flexible layouts */
.container {
  max-width: 80rem;
  width: 100%;
  padding: 0 1rem;
}

/* Use rem/em, never fixed px for text */
body {
  font-size: 1rem;      /* RIGHT */
  /* font-size: 16px; */  /* WRONG: won't scale with user preferences */
}

h1 {
  font-size: 2rem;       /* RIGHT: scales proportionally */
}

/* Flexible grids that reflow naturally */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: 1rem;
}
```

### 10.4 Orientation (SC 1.3.4)

Never lock orientation unless essential to the content (e.g., a piano keyboard app):

```css
/* WRONG: forcing portrait only via CSS */
@media (orientation: landscape) {
  body {
    transform: rotate(-90deg); /* Never do this */
  }
}
```

Do not use `screen.orientation.lock()` unless the specific content genuinely requires a fixed orientation.

## 11. Testing Checklist

Manual accessibility checks every developer should perform before shipping. No external tools required.

### 11.1 Keyboard Navigation

- [ ] Tab through the entire page from first to last focusable element
- [ ] Confirm every interactive element (link, button, input, select) receives focus
- [ ] Confirm focus order matches visual reading order
- [ ] Confirm all focused elements have a visible focus indicator
- [ ] Confirm buttons activate with both Enter and Space
- [ ] Confirm dialogs/modals trap focus inside them
- [ ] Confirm Escape closes modals, menus, and popups
- [ ] Confirm you can use the entire page without a mouse

### 11.2 Screen Reader Quick Check

- [ ] Turn on VoiceOver (macOS: Cmd+F5) or NVDA (Windows: free download)
- [ ] Navigate by headings (VO: Ctrl+Option+Cmd+H / NVDA: H key) — is the hierarchy logical?
- [ ] Navigate by landmarks (VO: Ctrl+Option+U / NVDA: D key) — are all regions labeled?
- [ ] Navigate through a form — are all labels announced?
- [ ] Trigger an error state — is the error announced?
- [ ] Open a modal — is the modal title announced?

### 11.3 Visual Checks

- [ ] Zoom browser to 200% — does all content remain visible without horizontal scrolling?
- [ ] Zoom browser to 400% — does content reflow to single column?
- [ ] Disable all CSS (browser dev tools) — does the content read in logical order?
- [ ] Check that no information is conveyed by color alone
- [ ] Verify text against backgrounds has sufficient contrast (use browser dev tools color picker)
- [ ] Check that all images have alt text (inspect in dev tools)

### 11.4 Content Checks

- [ ] Confirm `<html lang="en">` (or appropriate language) is set
- [ ] Confirm page `<title>` is unique and descriptive
- [ ] Confirm every form input has a visible `<label>`
- [ ] Confirm error messages are descriptive and linked to their fields
- [ ] Confirm decorative images use `alt=""`
- [ ] Confirm no `tabindex` value greater than 0 exists in the markup
- [ ] Confirm skip navigation link is present and functional

## 12. Common Mistakes

| Mistake | WCAG SC | Impact | Fix |
|---|---|---|---|
| `<div onclick>` instead of `<button>` | 4.1.2, 2.1.1 | Not focusable, no keyboard support, no role | Use `<button>` element |
| Missing `alt` attribute on images | 1.1.1 | Screen readers read filename or nothing | Add descriptive `alt` text or `alt=""` for decorative |
| `outline: none` on `:focus` | 2.4.7 | Keyboard users cannot see where they are | Use `:focus-visible` with visible outline |
| Color as sole indicator | 1.4.1 | Color-blind users miss information | Add icon, text, pattern, or border in addition to color |
| Missing `<label>` on form inputs | 1.3.1, 3.3.2 | Screen readers announce nothing for the field | Add `<label for="...">` or `aria-label` |
| Auto-playing audio/video | 1.4.2 | Disorients users, interferes with screen readers | Never autoplay; or autoplay muted with stop control |
| Fixed font sizes in `px` | 1.4.4 | Text does not scale with browser zoom settings | Use `rem` or `em` units |
| Missing `lang` attribute on `<html>` | 3.1.1 | Screen readers use wrong pronunciation rules | Add `<html lang="en">` (or appropriate code) |
| Skipping heading levels | 1.3.1 | Breaks heading navigation for screen reader users | Use sequential `h1` through `h6` |
| No skip navigation link | 2.4.1 | Keyboard users must tab through entire header every page | Add hidden-until-focused skip link to `#main-content` |
| `tabindex` greater than 0 | 2.4.3 | Creates unpredictable, unmaintainable tab order | Use DOM order; only use `tabindex="0"` or `tabindex="-1"` |
| Mouse-only interactions (hover menus) | 2.1.1 | Keyboard and touch users cannot access content | Ensure all hover interactions work on focus/click |
| No focus management in modals | 2.1.2, 2.4.3 | Users tab behind modal, get lost in page | Trap focus inside modal, restore focus on close |
| Missing `aria-expanded` on toggles | 4.1.2 | Screen readers do not know if panel is open/closed | Add `aria-expanded="true/false"` and update on toggle |
| `placeholder` as the only label | 1.3.1, 3.3.2 | Placeholder disappears on input, low contrast | Use a real `<label>` element; placeholder is supplementary |
| `maximum-scale=1` in viewport meta | 1.4.4 | Prevents pinch-to-zoom on mobile | Remove `maximum-scale` and `user-scalable=no` |

## 13. Quick Reference

### DO

- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<label>`, `<table>`)
- Provide text alternatives for all non-text content
- Maintain heading hierarchy (`h1` > `h2` > `h3`, no skipping)
- Ensure 4.5:1 contrast ratio for text, 3:1 for UI components
- Make all functionality available via keyboard
- Show visible focus indicators on all interactive elements
- Use `aria-live` regions to announce dynamic content changes
- Link form errors to their inputs with `aria-describedby`
- Set `<html lang="...">` on every page
- Use `rem`/`em` for font sizes and spacing
- Test with keyboard only before every release
- Provide captions for video and transcripts for audio
- Include a skip navigation link
- Use `autocomplete` attributes on personal data inputs
- Trap focus inside modals, restore on close
- Respect `prefers-reduced-motion` and `prefers-contrast`

### DO NOT

- Use `<div>` or `<span>` for interactive elements
- Remove focus outlines without replacement (`outline: none`)
- Convey information through color alone
- Use `tabindex` greater than 0
- Disable browser zoom (`maximum-scale=1`, `user-scalable=no`)
- Use fixed pixel sizes for text
- Autoplay audio or video with sound
- Use ARIA when native HTML provides the same semantics
- Rely on placeholder text as the field label
- Create mouse-only interactions (hover-dependent menus/tooltips)
- Skip heading levels or use headings for visual styling
- Use `title` attribute as a replacement for visible labels
- Put interactive elements inside other interactive elements (nested links/buttons)
- Use `role="presentation"` or `aria-hidden="true"` on visible, meaningful content
- Remove list semantics with `list-style: none` without restoring via `role="list"`

### Screen-Reader-Only CSS Class

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Use this class to hide content visually while keeping it accessible to screen readers. Common uses: skip links (visible on focus), form hints, live region containers, icon button labels.

### Minimum Accessible Page Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Descriptive Page Title - Site Name</title>
</head>
<body>
  <a href="#main" class="skip-link sr-only" style="position:absolute">
    Skip to main content
  </a>

  <header>
    <nav aria-label="Main">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>

  <main id="main" tabindex="-1">
    <h1>Page Title</h1>
    <!-- Primary content -->
  </main>

  <footer>
    <p>Copyright 2026 Company Name</p>
  </footer>

  <!-- Live region for dynamic announcements -->
  <div aria-live="polite" id="announcements" class="sr-only"></div>
</body>
</html>
```

## 14. Tailwind CSS Accessibility Patterns

When using Tailwind CSS, leverage built-in utilities and variants for accessible implementations.

### 14.1 Screen-Reader-Only Content

Tailwind provides `sr-only` and `not-sr-only` utilities:

```html
<!-- Hidden visually, announced by screen readers -->
<span class="sr-only">Edit profile for John Smith</span>

<!-- Skip navigation link: hidden until focused -->
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50
   focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium">
  Skip to main content
</a>

<!-- Icon button with accessible label -->
<button class="p-2 rounded-md hover:bg-gray-100">
  <svg aria-hidden="true" class="size-5"><!-- icon --></svg>
  <span class="sr-only">Close menu</span>
</button>
```

### 14.2 Focus Indicators

| Pattern | Tailwind Classes | WCAG SC |
|---|---|---|
| Keyboard-only focus ring | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600` | 2.4.7 |
| Always-visible focus | `focus:ring-2 focus:ring-indigo-600` | 2.4.7 |
| Remove default + replace | `outline-none focus-visible:ring-2 focus-visible:ring-indigo-600` | 2.4.7 |
| Never remove without replacement | Do NOT use `outline-none` alone | 2.4.7 |
| Forced colors focus | `forced-colors:outline forced-colors:outline-[Highlight]` | 1.4.11 |

### 14.3 User Preference Variants

| Variant | Purpose | WCAG SC |
|---|---|---|
| `motion-safe:` | Apply animations only when user allows motion | 2.3.3 |
| `motion-reduce:` | Override/remove animations for reduced-motion preference | 2.3.3 |
| `contrast-more:` | Enhance contrast for high-contrast preference | 1.4.3 |
| `contrast-less:` | Reduce contrast for sensitivity (rare) | — |
| `forced-colors:` | Adapt for Windows High Contrast Mode | 1.4.11 |
| `prefers-color-scheme` (via `dark:`) | Respect OS dark mode setting | 1.4.3 |

```html
<!-- Reduced motion: disable transitions -->
<div class="transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none">

<!-- High contrast: add borders -->
<button class="bg-indigo-600 text-white contrast-more:border-2 contrast-more:border-indigo-900">

<!-- Forced colors: ensure visibility -->
<div class="bg-gray-100 forced-colors:border forced-colors:border-[ButtonText]">
```

### 14.4 Touch Target Sizing

```html
<!-- Minimum 44x44px via padding expansion -->
<button class="min-h-[44px] min-w-[44px] p-2">
  <svg class="size-5" aria-hidden="true"><!-- icon --></svg>
  <span class="sr-only">Action</span>
</button>

<!-- Input device adaptation (v4.1) -->
<button class="p-2 pointer-coarse:p-3 pointer-coarse:min-h-[48px]">
  Tap-friendly on touch, compact on mouse
</button>
```

### 14.5 ARIA Variants in Tailwind

Tailwind provides built-in ARIA state variants:

| Variant | Targets | Use Case |
|---|---|---|
| `aria-checked:` | `aria-checked="true"` | Custom checkboxes, toggles |
| `aria-disabled:` | `aria-disabled="true"` | Disabled interactive elements |
| `aria-expanded:` | `aria-expanded="true"` | Accordions, dropdowns |
| `aria-hidden:` | `aria-hidden="true"` | Hidden content styling |
| `aria-pressed:` | `aria-pressed="true"` | Toggle buttons |
| `aria-selected:` | `aria-selected="true"` | Tab panels, list selections |
| `aria-required:` | `aria-required="true"` | Required form fields |
| `group-aria-*:` | Parent ARIA state | Child styling based on parent state |
| `peer-aria-*:` | Sibling ARIA state | Adjacent element styling |

```html
<!-- Toggle button with ARIA styling -->
<button aria-pressed="false" class="bg-gray-200 aria-pressed:bg-indigo-600">

<!-- Accordion with group ARIA -->
<div class="group" aria-expanded="false">
  <svg class="transition group-aria-expanded:rotate-180"><!-- chevron --></svg>
</div>
```

### 14.6 Form Validation with Post-Interaction States (v4.1)

```html
<!-- Only show validation after user interaction, not on page load -->
<input type="email" required
  class="border border-gray-300
         user-valid:border-green-500 user-valid:ring-green-500
         user-invalid:border-red-500 user-invalid:ring-red-500">

<!-- Better than invalid: which fires immediately on required empty fields -->
```

### 14.7 HeadlessUI Accessible Components

When building interactive widgets with Tailwind CSS, use HeadlessUI for built-in accessibility:

| Component | Built-in A11y | What It Handles |
|---|---|---|
| Dialog | Focus trap, inert background, Escape close, `aria-modal`, `aria-labelledby` | SC 2.1.2, 2.4.3, 4.1.2 |
| Disclosure | `aria-expanded`, keyboard toggle | SC 4.1.2 |
| Listbox | `aria-selected`, arrow key navigation, type-ahead | SC 4.1.2, 2.1.1 |
| Combobox | `aria-activedescendant`, `aria-autocomplete`, arrow keys | SC 4.1.2, 2.1.1 |
| Menu | `aria-haspopup`, `role="menu"`, arrow keys, type-ahead | SC 4.1.2, 2.1.1 |
| Switch | `role="switch"`, `aria-checked`, Space toggle | SC 4.1.2, 2.1.1 |
| RadioGroup | Arrow key navigation, `aria-checked` | SC 4.1.2, 2.1.1 |
| Tabs | `role="tablist"`, `aria-selected`, arrow keys | SC 4.1.2, 2.1.1 |

Using HeadlessUI is strongly preferred over building custom interactive widgets. It eliminates the most common accessibility mistakes (missing focus traps, keyboard handling, ARIA states).

## Resources

Detailed code examples for each topic area:

- `resources/semantic-html.md` — Buttons, landmarks, headings, tables, forms, fieldsets, links, lists
- `resources/aria-patterns.md` — Modal dialog with focus trap, tab component with roving tabindex, dropdown menu with keyboard navigation
- `resources/keyboard-forms.md` — Focus visibility, skip navigation, tab order, key bindings, focus management, complete form example, inline validation, error summaries, autocomplete
- `resources/images-media-dynamic.md` — Alt text patterns, SVG accessibility, video/audio requirements, reduced motion, route change announcements, loading states, toast notifications, infinite scroll
