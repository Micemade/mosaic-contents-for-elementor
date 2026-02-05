# WordPress Interactivity API - Directives Reference

## Overview

Directives are special HTML attributes that define interactive behaviors. They follow the pattern `data-wp-{directive}` or `data-wp-{directive}--{suffix}`.

## Core Directives

### data-wp-interactive

Declares the namespace for an interactive region. All child elements inherit this namespace.

```html
<div data-wp-interactive="my-namespace">
    <!-- All directives here use 'my-namespace' -->
</div>
```

With JSON configuration:
```html
<div data-wp-interactive='{"namespace":"my-namespace"}'>
```

---

### data-wp-context

Defines local context data for an element and its descendants.

```html
<div data-wp-context='{"isOpen": false, "count": 0}'>
```

PHP helper:
```php
<div <?php echo wp_interactivity_data_wp_context(['isOpen' => false]); ?>>
```

---

### data-wp-on--{event}

Binds an action to a DOM event.

```html
<!-- Click handler -->
<button data-wp-on--click="actions.handleClick">Click me</button>

<!-- Form submit -->
<form data-wp-on--submit="actions.handleSubmit">

<!-- Input change -->
<input data-wp-on--change="actions.handleChange">

<!-- Animation end -->
<div data-wp-on--animationend="actions.handleAnimationEnd">
```

Async actions with generator syntax:
```javascript
actions: {
    *handleClick() {
        yield someAsyncOperation();
        const context = getContext();
        context.isLoading = false;
    }
}
```

---

### data-wp-bind--{attribute}

Binds an HTML attribute to a state value.

```html
<!-- Bind hidden attribute -->
<span data-wp-bind--hidden="!state.isVisible">Content</span>

<!-- Bind disabled attribute -->
<button data-wp-bind--disabled="state.isLoading">Submit</button>

<!-- Bind href attribute -->
<a data-wp-bind--href="state.url">Link</a>

<!-- Bind aria attributes -->
<button data-wp-bind--aria-expanded="context.isOpen">Toggle</button>
```

---

### data-wp-class--{classname}

Conditionally toggles a CSS class.

```html
<!-- Toggle 'active' class -->
<div data-wp-class--active="state.isActive">

<!-- Toggle 'loading' class -->
<button data-wp-class--loading="state.isLoading">

<!-- Animation classes -->
<span 
    data-wp-class--wc-block-slide-in="state.slideInAnimation"
    data-wp-class--wc-block-slide-out="state.slideOutAnimation"
>
```

---

### data-wp-style--{property}

Sets inline CSS properties dynamically.

```html
<div data-wp-style--display="state.display">
<div data-wp-style--color="state.textColor">
<div data-wp-style--background-color="state.bgColor">
```

---

### data-wp-text

Sets the text content of an element.

```html
<span data-wp-text="state.buttonText">Fallback text</span>
<span data-wp-text="context.message"></span>
```

---

### data-wp-init

Runs an action when the element is first rendered.

```html
<div data-wp-init="actions.initialize">
<div data-wp-init="callbacks.fetchData">
```

---

### data-wp-watch

Runs a callback when its dependencies change (reactive).

```html
<div data-wp-watch="callbacks.onCountChange">
```

```javascript
callbacks: {
    onCountChange() {
        const context = getContext();
        // This runs whenever context.count changes
        console.log('Count:', context.count);
    }
}
```

---

### data-wp-run

Runs a callback on every render, including initial render.

```html
<span data-wp-run="callbacks.syncTempQuantityOnLoad">
```

---

### data-wp-each

Iterates over an array to render multiple elements.

```html
<template data-wp-each="state.items">
    <li data-wp-text="context.item.name"></li>
</template>
```

---

## Namespace Prefixes

Reference other namespaces with prefix:

```html
<button 
    data-wp-on--click="woocommerce/add-to-cart-with-options::actions.addToCart"
    data-wp-bind--disabled="woocommerce/add-to-cart-with-options::!state.isFormValid"
>
```

---

## Expression Syntax

Directives support simple JavaScript expressions:

```html
<!-- Negation -->
<span data-wp-bind--hidden="!state.isVisible">

<!-- Property access -->
<span data-wp-text="state.cart.itemCount">

<!-- Ternary (limited support) -->
<span data-wp-class--active="state.count > 0">
```

---

## Best Practices

1. **Use context for instance-specific data** (product ID, local state)
2. **Use state for global/computed values** (cart totals, shared state)
3. **Keep actions simple** - complex logic should be in callbacks
4. **Use generators for async operations** in actions
5. **Namespace your store** to avoid conflicts
