# Semantic HTML — Full Code Examples

Detailed examples for each semantic HTML rule. See the main SKILL.md for the quick-reference table.

## Buttons vs Divs (SC 4.1.2, 2.1.1)

```html
<!-- WRONG: div with click handler -->
<div class="btn" onclick="submitForm()">Submit</div>

<!-- RIGHT: native button element -->
<button type="submit" class="btn">Submit</button>
```

A `<div>` has no role, no keyboard focusability, no Enter/Space activation. A `<button>` provides all three natively.

## Landmark Elements (SC 1.3.1, 2.4.1)

```html
<!-- RIGHT: semantic landmarks -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main id="main-content">
  <article>
    <h1>Page Title</h1>
    <!-- primary content -->
  </article>
  <aside aria-label="Related articles">
    <!-- supplementary content -->
  </aside>
</main>

<footer>
  <p>Copyright 2026</p>
</footer>
```

When multiple `<nav>` or `<aside>` elements exist on a page, distinguish them with `aria-label`.

## Heading Hierarchy (SC 1.3.1)

```html
<!-- WRONG: skipping heading levels -->
<h1>Site Name</h1>
<h3>Section Title</h3>   <!-- skipped h2 -->
<h5>Subsection</h5>      <!-- skipped h4 -->

<!-- RIGHT: sequential heading levels -->
<h1>Site Name</h1>
  <h2>Section Title</h2>
    <h3>Subsection</h3>
    <h3>Another Subsection</h3>
  <h2>Another Section</h2>
```

Every page must have exactly one `<h1>`. Never skip heading levels. Headings create a navigable document outline for screen reader users.

## Data Tables (SC 1.3.1)

```html
<table>
  <caption>Monthly Revenue by Region</caption>
  <thead>
    <tr>
      <th scope="col">Region</th>
      <th scope="col">Q1</th>
      <th scope="col">Q2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">North America</th>
      <td>$1.2M</td>
      <td>$1.4M</td>
    </tr>
  </tbody>
</table>
```

Always use `<caption>` for table purpose, `<th scope>` for header associations. Never use tables for layout.

## Form Labels (SC 1.3.1, 3.3.2)

```html
<!-- WRONG: placeholder as label -->
<input type="email" placeholder="Email address">

<!-- RIGHT: explicit label -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" autocomplete="email">
```

## Fieldsets and Legends (SC 1.3.1)

```html
<fieldset>
  <legend>Notification Preferences</legend>
  <label>
    <input type="checkbox" name="notify" value="email"> Email
  </label>
  <label>
    <input type="checkbox" name="notify" value="sms"> SMS
  </label>
  <label>
    <input type="checkbox" name="notify" value="push"> Push notification
  </label>
</fieldset>
```

## Links vs Buttons (SC 4.1.2)

```html
<!-- Link: navigates to a URL -->
<a href="/settings">Account Settings</a>

<!-- Button: performs an action -->
<button type="button" onclick="openPanel()">Open Settings Panel</button>
```

Use `<a href>` for navigation (changes URL or scrolls to anchor). Use `<button>` for actions (toggles, submissions, UI state changes). Never use `<a href="#">` or `<a href="javascript:void(0)">` for actions.

## Lists for Groups (SC 1.3.1)

```html
<!-- RIGHT: nav items as list -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li aria-current="page">Widget Pro</li>
  </ol>
</nav>
```

Screen readers announce "list, 3 items" — giving users a count and structure context.
