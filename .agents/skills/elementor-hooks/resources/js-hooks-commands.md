# JS Hooks and Commands Code Examples

Code examples for Sections 4-8 of the Elementor Hooks Reference.

---

## JS Frontend Hooks (Section 4)

### Actions

```js
// Run code when any element is ready
elementorFrontend.hooks.addAction( 'frontend/element_ready/global', function( $scope ) {
    if ( $scope.data( 'shake' ) ) {
        $scope.shake();
    }
});

// Run code when a specific widget (image, default skin) is ready
elementorFrontend.hooks.addAction( 'frontend/element_ready/image.default', function( $scope ) {
    if ( $scope.find( 'a' ) ) {
        $scope.find( 'a' ).lightbox();
    }
});

// Run code when a widget with a custom skin is ready
elementorFrontend.hooks.addAction( 'frontend/element_ready/google-maps.satellite', function( $scope ) {
    var $iframe = $scope.find( 'iframe' );
    $iframe.attr( 'src', $iframe.attr( 'src' ) + '&maptype=satellite' );
});

// Run code on frontend init
elementorFrontend.hooks.addAction( 'elementor/frontend/init', function() {
    // elementorFrontend object is now available
});
```

### Filters

```js
// Adjust menu anchor scroll offset (e.g. for a fixed header)
jQuery( function( $ ) {
    if ( window.elementorFrontend ) {
        elementorFrontend.hooks.addFilter(
            'frontend/handlers/menu_anchor/scroll_top_distance',
            function( scrollTop ) { return scrollTop - 80; }
        );
    }
});
```

---

## JS Editor Hooks (Section 5)

### Actions

```js
// Run code when any widget panel opens
elementor.hooks.addAction( 'panel/open_editor/widget', function( panel, model, view ) {
    console.log( 'Editing widget:', model.get( 'widgetType' ) );
});

// Run code when the slider widget panel opens
elementor.hooks.addAction( 'panel/open_editor/widget/slider', function( panel, model, view ) {
    var $element = view.$el.find( '.elementor-selector' );
    if ( $element.length ) {
        $element.click( function() {
            alert( 'Slider clicked' );
        });
    }
});
```

---

## JS Commands API (Section 6)

### Creating a Custom Component with Command

```js
class ExampleCommand extends $e.modules.CommandBase {
    apply( args ) {
        console.log( 'ExampleCommand:', args );
        return { example: 'result from ExampleCommand' };
    }
}

class CustomComponent extends $e.modules.ComponentBase {
    getNamespace() {
        return 'custom-component';
    }

    defaultCommands() {
        return {
            example: ( args ) => ( new ExampleCommand( args ) ).run(),
        };
    }
}

// Register and run
$e.components.register( new CustomComponent() );
result = $e.run( 'custom-component/example', { property: 'value' } );
```

### Importing Commands (File Structure)

Override `defaultCommands`, `defaultCommandsInternal`, or `defaultData` in your component:

```js
import * as commands from './commands/';

export class Component extends $e.modules.ComponentBase {
    getNamespace() {
        return 'component-name';
    }
    defaultCommands() {
        return this.importCommands( commands );
    }
}
```

---

## JS Components API (Section 7)

```js
class CustomComponent extends $e.modules.ComponentBase {
    getNamespace() {
        return 'custom-component';
    }
    defaultCommands() {
        return {
            example: ( args ) => { console.log( args ); },
        };
    }
}
$e.components.register( new CustomComponent() );
```

---

## JS Hooks API (Section 8)

### Hook Convention

```js
import HookUIAfter from 'elementor-api/modules/hooks/ui/after';

export class FooterSaverRefreshMenu extends HookUIAfter {
    getCommand() {
        return 'document/elements/settings';
    }
    getId() {
        return 'footer-saver-refresh-menu--document/elements/settings';
    }
    getContainerType() {
        return 'document'; // optional, improves performance
    }
    getConditions( args ) {
        return args.settings && 'undefined' !== typeof args.settings.post_status;
    }
    apply( args ) {
        const { footerSaver } = $e.components.get( 'document/save' );
        footerSaver.setMenuItems( args.container.document );
        footerSaver.refreshWpPreview();
    }
}
export default FooterSaverRefreshMenu;
```

### Importing Hooks in a Component

Import hooks via `defaultHooks()` in your component:

```js
import * as hooks from './hooks/';

export class Component extends $e.modules.ComponentBase {
    getNamespace() {
        return 'component-name';
    }
    defaultHooks() {
        return this.importHooks( hooks );
    }
}
```
