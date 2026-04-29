# Keyboard Navigation and Forms — Full Code Examples

Detailed keyboard navigation and form accessibility code. See the main SKILL.md for testing checklists and key binding tables.

## Focus Visibility (SC 2.4.7, 2.4.11, 2.4.12)

```css
/* WRONG: removing focus outline entirely */
*:focus {
  outline: none; /* Never do this */
}

/* RIGHT: visible, high-contrast focus indicator */
:focus-visible {
  outline: 3px solid #1a73e8;
  outline-offset: 2px;
}

/* Optional: remove outline for mouse clicks, keep for keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

WCAG 2.4.11 (AA in 2.2) requires the focus indicator to have a minimum contrast ratio and area. Use a 3px solid outline for reliable compliance.

## Skip Navigation Link (SC 2.4.1)

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header><!-- site header and nav --></header>
  <main id="main-content" tabindex="-1">
    <!-- page content -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 0.75rem 1.5rem;
  background: #000;
  color: #fff;
  z-index: 10000;
  font-size: 1rem;
}

.skip-link:focus {
  top: 0;
}
```

## Tab Order (SC 2.4.3)

```html
<!-- WRONG: using positive tabindex to force order -->
<input tabindex="3" name="email">
<input tabindex="1" name="name">
<input tabindex="2" name="phone">

<!-- RIGHT: DOM order determines tab order -->
<input name="name">
<input name="email">
<input name="phone">
```

Never use `tabindex` values greater than 0. Use only `tabindex="0"` (add to tab order) and `tabindex="-1"` (programmatically focusable, not in tab order).

## Key Bindings (SC 2.1.1)

All interactive elements must respond to expected keys:

| Element | Expected Keys |
|---|---|
| Button | `Enter`, `Space` (activates) |
| Link | `Enter` (activates) |
| Checkbox | `Space` (toggles) |
| Radio group | `Arrow` keys (moves selection) |
| Tab list | `Arrow Left/Right` (moves between tabs) |
| Menu | `Arrow Up/Down` (navigates items), `Escape` (closes) |
| Dialog | `Escape` (closes), `Tab` (cycles within) |
| Combobox | `Arrow Down` (opens list), `Escape` (closes) |
| Slider | `Arrow Left/Right` (decrease/increase), `Home/End` (min/max) |

## Focus Management in SPAs (SC 2.4.3)

```javascript
// After client-side route change, move focus to new content
function onRouteChange(pageTitle) {
  document.title = pageTitle;

  const main = document.querySelector('main');
  main.setAttribute('tabindex', '-1');
  main.focus();

  // Announce the route change to screen readers
  announceRouteChange(pageTitle);
}

function announceRouteChange(title) {
  let announcer = document.getElementById('route-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'route-announcer';
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = title;
  });
}
```

## Programmatic Focus Movement

```javascript
// Move focus after dynamic content insertion
function addItemToList(item) {
  const list = document.getElementById('item-list');
  const li = document.createElement('li');
  li.textContent = item.name;
  li.setAttribute('tabindex', '-1');
  list.appendChild(li);
  li.focus(); // Move focus to newly added item
  announceStatus(`${item.name} added to list`);
}

// Move focus after deletion
function removeItem(itemElement) {
  const nextFocus = itemElement.nextElementSibling
    || itemElement.previousElementSibling
    || itemElement.parentElement;
  itemElement.remove();
  if (nextFocus) {
    nextFocus.setAttribute('tabindex', '-1');
    nextFocus.focus();
  }
}
```

## Complete Accessible Form (SC 1.3.1, 3.3.1, 3.3.2, 3.3.3)

```html
<form novalidate aria-labelledby="form-title">
  <h2 id="form-title">Create Account</h2>

  <!-- Error summary (shown after failed submission) -->
  <div id="error-summary" role="alert" hidden>
    <h3>There are 2 errors in this form:</h3>
    <ul>
      <li><a href="#name">Full name is required</a></li>
      <li><a href="#email">Enter a valid email address</a></li>
    </ul>
  </div>

  <div class="form-group">
    <label for="name">
      Full name <span aria-hidden="true">*</span>
    </label>
    <input type="text" id="name" name="name"
           required aria-required="true"
           autocomplete="name"
           aria-describedby="name-error">
    <p id="name-error" class="error-message" hidden>
      Full name is required
    </p>
  </div>

  <div class="form-group">
    <label for="email">
      Email address <span aria-hidden="true">*</span>
    </label>
    <input type="email" id="email" name="email"
           required aria-required="true"
           autocomplete="email"
           aria-describedby="email-hint email-error">
    <p id="email-hint" class="hint">We will send a confirmation to this address</p>
    <p id="email-error" class="error-message" hidden>
      Enter a valid email address (example: name@domain.com)
    </p>
  </div>

  <fieldset>
    <legend>Account type <span aria-hidden="true">*</span></legend>
    <label>
      <input type="radio" name="account-type" value="personal" required>
      Personal
    </label>
    <label>
      <input type="radio" name="account-type" value="business">
      Business
    </label>
  </fieldset>

  <div class="form-group">
    <label for="password">
      Password <span aria-hidden="true">*</span>
    </label>
    <input type="password" id="password" name="password"
           required aria-required="true"
           autocomplete="new-password"
           aria-describedby="password-requirements">
    <p id="password-requirements" class="hint">
      At least 8 characters, one uppercase, one number
    </p>
  </div>

  <button type="submit">Create Account</button>
</form>
```

## Inline Validation (SC 3.3.1, 4.1.3)

```javascript
function validateField(input) {
  const errorEl = document.getElementById(`${input.id}-error`);
  let message = '';

  if (input.validity.valueMissing) {
    message = `${input.labels[0].textContent.trim()} is required`;
  } else if (input.validity.typeMismatch) {
    message = `Enter a valid ${input.type}`;
  }

  if (message) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    errorEl.hidden = true;
  }
}

// Validate on blur (not on every keystroke)
document.querySelectorAll('input[required]').forEach((input) => {
  input.addEventListener('blur', () => validateField(input));
});
```

## Error Summary on Submission (SC 3.3.1)

```javascript
function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errors = [];

  form.querySelectorAll('input[required]').forEach((input) => {
    validateField(input);
    if (input.getAttribute('aria-invalid') === 'true') {
      const label = input.labels[0].textContent.trim();
      errors.push({ id: input.id, message: `${label} is required` });
    }
  });

  const summary = document.getElementById('error-summary');
  if (errors.length > 0) {
    const list = errors
      .map((err) => `<li><a href="#${err.id}">${err.message}</a></li>`)
      .join('');
    summary.textContent = '';
    summary.insertAdjacentHTML('afterbegin',
      `<h3>There are ${errors.length} errors in this form:</h3><ul>${list}</ul>`
    );
    summary.hidden = false;
    summary.focus();
  } else {
    summary.hidden = true;
    // Proceed with form submission
  }
}
```

## Autocomplete Attributes (SC 1.3.5)

Always set `autocomplete` on inputs that accept user personal data:

```html
<input type="text" autocomplete="given-name">
<input type="text" autocomplete="family-name">
<input type="email" autocomplete="email">
<input type="tel" autocomplete="tel">
<input type="text" autocomplete="street-address">
<input type="text" autocomplete="postal-code">
<input type="text" autocomplete="country-name">
<input type="text" autocomplete="organization">
<input type="password" autocomplete="new-password">
<input type="password" autocomplete="current-password">
<input type="text" autocomplete="one-time-code">
```
