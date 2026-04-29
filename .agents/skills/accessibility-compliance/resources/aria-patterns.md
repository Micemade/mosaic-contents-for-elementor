# ARIA Patterns — Full Component Code Examples

Detailed ARIA component implementations. See the main SKILL.md for the roles/states reference table.

## Accessible Modal Dialog (SC 2.1.2, 2.4.3)

### HTML Structure

```html
<button type="button" id="open-modal-btn">Delete Account</button>

<div id="confirm-dialog" role="dialog" aria-modal="true"
     aria-labelledby="dialog-title" hidden>
  <h2 id="dialog-title">Confirm Account Deletion</h2>
  <p id="dialog-desc">This action cannot be undone. All data will be permanently removed.</p>
  <div class="dialog-actions">
    <button type="button" id="confirm-btn">Delete</button>
    <button type="button" id="cancel-btn">Cancel</button>
  </div>
</div>
```

### JavaScript — Focus Management and Focus Trap

```javascript
const dialog = document.getElementById('confirm-dialog');
const openBtn = document.getElementById('open-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
let previouslyFocused = null;

function openModal() {
  previouslyFocused = document.activeElement;
  dialog.hidden = false;
  dialog.querySelector('h2').focus();
  document.addEventListener('keydown', trapFocus);
}

function closeModal() {
  dialog.hidden = true;
  document.removeEventListener('keydown', trapFocus);
  if (previouslyFocused) {
    previouslyFocused.focus(); // Restore focus to trigger element
  }
}

function trapFocus(e) {
  if (e.key === 'Escape') {
    closeModal();
    return;
  }
  if (e.key !== 'Tab') return;

  const focusable = dialog.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      last.focus();
      e.preventDefault();
    }
  } else {
    if (document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
}

openBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
```

## Accessible Tabs with Roving Tabindex (SC 2.1.1, 4.1.2)

### HTML Structure

```html
<div class="tabs">
  <div role="tablist" aria-label="Account settings">
    <button role="tab" id="tab-profile" aria-selected="true"
            aria-controls="panel-profile" tabindex="0">
      Profile
    </button>
    <button role="tab" id="tab-security" aria-selected="false"
            aria-controls="panel-security" tabindex="-1">
      Security
    </button>
    <button role="tab" id="tab-billing" aria-selected="false"
            aria-controls="panel-billing" tabindex="-1">
      Billing
    </button>
  </div>

  <div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile"
       tabindex="0">
    <!-- Profile content -->
  </div>
  <div role="tabpanel" id="panel-security" aria-labelledby="tab-security"
       tabindex="0" hidden>
    <!-- Security content -->
  </div>
  <div role="tabpanel" id="panel-billing" aria-labelledby="tab-billing"
       tabindex="0" hidden>
    <!-- Billing content -->
  </div>
</div>
```

### JavaScript — Roving Tabindex Pattern

```javascript
const tablist = document.querySelector('[role="tablist"]');
const tabs = tablist.querySelectorAll('[role="tab"]');

tablist.addEventListener('keydown', (e) => {
  const currentIndex = Array.from(tabs).indexOf(document.activeElement);
  let newIndex;

  switch (e.key) {
    case 'ArrowRight':
      newIndex = (currentIndex + 1) % tabs.length;
      break;
    case 'ArrowLeft':
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  e.preventDefault();
  activateTab(tabs[newIndex]);
});

function activateTab(newTab) {
  tabs.forEach((tab) => {
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
    document.getElementById(tab.getAttribute('aria-controls')).hidden = true;
  });

  newTab.setAttribute('aria-selected', 'true');
  newTab.setAttribute('tabindex', '0');
  newTab.focus();
  document.getElementById(newTab.getAttribute('aria-controls')).hidden = false;
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab));
});
```

## Accessible Dropdown Menu (SC 2.1.1, 4.1.2)

### HTML Structure

```html
<div class="menu-container">
  <button type="button" aria-haspopup="true" aria-expanded="false"
          aria-controls="actions-menu" id="menu-trigger">
    Actions
  </button>
  <ul role="menu" id="actions-menu" aria-labelledby="menu-trigger" hidden>
    <li role="menuitem" tabindex="-1">Edit</li>
    <li role="menuitem" tabindex="-1">Duplicate</li>
    <li role="separator"></li>
    <li role="menuitem" tabindex="-1">Delete</li>
  </ul>
</div>
```

### JavaScript — Keyboard Navigation

```javascript
const trigger = document.getElementById('menu-trigger');
const menu = document.getElementById('actions-menu');
const items = menu.querySelectorAll('[role="menuitem"]');

function openMenu() {
  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  items[0].focus();
}

function closeMenu() {
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.focus();
}

trigger.addEventListener('click', () => {
  menu.hidden ? openMenu() : closeMenu();
});

menu.addEventListener('keydown', (e) => {
  const currentIndex = Array.from(items).indexOf(document.activeElement);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      items[(currentIndex + 1) % items.length].focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length].focus();
      break;
    case 'Escape':
      closeMenu();
      break;
    case 'Home':
      e.preventDefault();
      items[0].focus();
      break;
    case 'End':
      e.preventDefault();
      items[items.length - 1].focus();
      break;
  }
});
```
