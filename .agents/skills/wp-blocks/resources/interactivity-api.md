# Interactivity API: Detailed Code Reference

## Store, State, and Context

```js
import { store, getContext, getElement } from '@wordpress/interactivity';

const { state } = store( 'myPlugin', {
    // Global state (shared across all instances)
    state: {
        count: 0,
        get doubled() {
            return state.count * 2;
        },
    },

    // Actions (mutations)
    actions: {
        increment() {
            state.count++;
        },
        toggle() {
            const context = getContext();
            context.isOpen = ! context.isOpen;
        },
        *fetchData() {
            const { ref } = getElement();
            const response = yield fetch( state.apiUrl );
            state.items = yield response.json();
        },
    },

    // Callbacks (side effects for watch/init/run)
    callbacks: {
        logCount() {
            console.log( 'Count:', state.count );
        },
    },
} );
```

### State vs Context

- **State** is global, shared across all instances of the block. Define with `store()`.
- **Context** is per-element, scoped to the nearest `data-wp-context` ancestor. Access with `getContext()`.

## Server-Side Rendering (SSR)

Server-side rendering is **required** for correct behavior. The client hydrates the server-rendered markup.

### Enable directive processing in block.json

```json
{
  "supports": {
    "interactivity": true
  }
}
```

### Initialize state in PHP (render.php)

```php
<?php
$items = array( 'Apple', 'Banana', 'Cherry' );

wp_interactivity_state( 'myPlugin', array(
    'items'    => $items,
    'hasItems' => count( $items ) > 0,
) );

$context = array( 'isOpen' => false );
$wrapper = get_block_wrapper_attributes();
?>
<div <?php echo $wrapper; ?>
     data-wp-interactive="myPlugin"
     <?php echo wp_interactivity_data_wp_context( $context ); ?>>

    <button data-wp-on-async--click="actions.toggle">
        Toggle List
    </button>

    <ul data-wp-bind--hidden="!context.isOpen">
        <template data-wp-each="state.items">
            <li data-wp-text="context.item"></li>
        </template>
    </ul>

    <p data-wp-bind--hidden="state.hasItems">
        <?php esc_html_e( 'No items available.', 'my-plugin' ); ?>
    </p>
</div>
```

### Derived state with closures (for dynamic server evaluation)

```php
wp_interactivity_state( 'myPlugin', array(
    'items'    => array( 'apple', 'banana' ),
    'selected' => array( 'apple' ),
    'isSelected' => function() {
        $state   = wp_interactivity_state();
        $context = wp_interactivity_get_context();
        return in_array( $context['item'], $state['selected'] );
    },
) );
```

### Usage without block.json (themes/plugins)

```php
wp_interactivity_state( 'myTheme', array( 'menuOpen' => false ) );

ob_start();
?>
<nav data-wp-interactive="myTheme"
     data-wp-class--is-open="state.menuOpen">
    <button data-wp-on-async--click="actions.toggleMenu">Menu</button>
    <ul data-wp-bind--hidden="!state.menuOpen">
        <li><a href="/">Home</a></li>
    </ul>
</nav>
<?php
echo wp_interactivity_process_directives( ob_get_clean() );
```

## PHP Helper Functions

| Function                                          | Purpose                                          |
|---------------------------------------------------|--------------------------------------------------|
| `wp_interactivity_state( $ns, $state )`           | Initialize or get global state for a namespace   |
| `wp_interactivity_data_wp_context( $context )`    | Generate `data-wp-context` attribute string      |
| `wp_interactivity_get_context( $ns )`             | Get current context during directive processing  |
| `wp_interactivity_process_directives( $html )`    | Manually process directives (themes/plugins)     |
| `wp_interactivity_config( $ns, $config )`         | Set configuration data for a namespace           |

## Hydration Rules

- Client-side JavaScript must produce markup matching the server-rendered HTML.
- Derived state defined only in JavaScript (not in PHP) causes layout shift because attributes like `hidden` are not set on initial render.
- Ensure PHP and JS derived state logic matches exactly.

## WordPress 6.9 Interactivity Changes

- **`data-wp-ignore` is deprecated.** It broke context inheritance and client-side navigation. Avoid it; use conditional rendering or separate interactive regions instead.
- **Unique directive IDs:** Multiple directives of the same type on one element use the `---` separator:

```html
<button
  data-wp-on--click---plugin-a="actions.handleA"
  data-wp-on--click---plugin-b="actions.handleB"
>
```

- **`getServerState()` and `getServerContext()`** reset between client-side page transitions. Do not rely on stale values persisting.
- **Router regions** support `attachTo` for rendering overlays (modals, pop-ups) dynamically.
- **New TypeScript types:** `AsyncAction<ReturnType>` and `TypeYield<T>` for async action typing.
