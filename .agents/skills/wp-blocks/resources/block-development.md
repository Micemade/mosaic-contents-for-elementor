# Block Development: Detailed Code Reference

## edit.js + save.js Pattern

```jsx
// edit.js
import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function Edit( { attributes, setAttributes } ) {
    const blockProps = useBlockProps();
    return (
        <div { ...blockProps }>
            <RichText
                tagName="p"
                value={ attributes.content }
                onChange={ ( content ) => setAttributes( { content } ) }
                placeholder="Enter text..."
            />
        </div>
    );
}
```

```jsx
// save.js
import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function Save( { attributes } ) {
    const blockProps = useBlockProps.save();
    return (
        <div { ...blockProps }>
            <RichText.Content tagName="p" value={ attributes.content } />
        </div>
    );
}
```

## Dynamic Render (render.php)

```php
<?php
$wrapper = get_block_wrapper_attributes( array( 'class' => 'my-custom-class' ) );
?>
<div <?php echo $wrapper; ?>>
    <p><?php echo esc_html( $attributes['content'] ); ?></p>
</div>
```

## InnerBlocks Composition

### edit.js

```jsx
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';

export default function Edit() {
    const blockProps = useBlockProps();
    const innerBlocksProps = useInnerBlocksProps( blockProps, {
        allowedBlocks: [ 'core/paragraph', 'core/image', 'core/heading' ],
        template: [
            [ 'core/heading', { level: 2, placeholder: 'Title' } ],
            [ 'core/paragraph', { placeholder: 'Content...' } ],
        ],
        templateLock: false, // false | 'all' | 'insert' | 'contentOnly'
    } );

    return <div { ...innerBlocksProps } />;
}
```

### save.js

```jsx
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';

export default function Save() {
    const blockProps = useBlockProps.save();
    const innerBlocksProps = useInnerBlocksProps.save( blockProps );
    return <div { ...innerBlocksProps } />;
}
```

### InnerBlocks Rules

- Only one `InnerBlocks` instance per block.
- Use `templateLock` intentionally -- too strict is frustrating.
- Changing wrapper structure around inner blocks can invalidate existing content; add deprecations.

## Block Supports (Full Example)

```json
{
  "supports": {
    "color": {
      "background": true,
      "text": true,
      "gradients": true,
      "link": true
    },
    "typography": {
      "fontSize": true,
      "lineHeight": true,
      "fontFamily": true
    },
    "spacing": {
      "margin": true,
      "padding": true,
      "blockGap": true
    },
    "border": {
      "color": true,
      "radius": true,
      "style": true,
      "width": true
    },
    "align": true,
    "anchor": true,
    "html": false,
    "interactivity": true
  }
}
```

Support-generated classes and inline styles are applied automatically through `useBlockProps()` / `get_block_wrapper_attributes()`.

## Block Variations

```js
import { registerBlockVariation } from '@wordpress/blocks';

registerBlockVariation( 'core/embed', {
    name: 'youtube',
    title: 'YouTube',
    icon: 'youtube',
    attributes: { providerNameSlug: 'youtube' },
    isActive: ( blockAttributes ) =>
        blockAttributes.providerNameSlug === 'youtube',
} );
```

## Block Styles

```js
import { registerBlockStyle } from '@wordpress/blocks';

registerBlockStyle( 'core/quote', {
    name: 'fancy',
    label: 'Fancy',
} );
```

This adds an `is-style-fancy` class. Define the CSS in your stylesheet. Avoid creating too many custom styles -- prefer block supports where possible.

## Block Deprecations and Migrations

**Critical for preventing "Invalid block" errors.** When you change `save()` output or attribute shapes, you must add a deprecation entry.

```js
// index.js
import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';

const deprecated = [
    {
        // Version 1: old save output
        attributes: {
            content: { type: 'string', source: 'html', selector: 'p' },
        },
        save( { attributes } ) {
            return <p>{ attributes.content }</p>;
        },
        migrate( attributes ) {
            // Transform old attributes to new shape if needed
            return {
                ...attributes,
                alignment: 'none',
            };
        },
    },
];

registerBlockType( metadata.name, {
    edit: Edit,
    save: Save,
    deprecated,
} );
```

### Deprecation Rules

- Order: newest deprecated first, oldest last.
- Each entry needs `save` matching the old output.
- `migrate` is optional; use it to transform attributes.
- **Never change `save()` output without adding a deprecation entry.**
- Keep fixture content for each deprecated version to test migrations.

## Registration (PHP)

Prefer metadata-based registration:

```php
// Plugin: register on init
add_action( 'init', function() {
    register_block_type_from_metadata( __DIR__ . '/build/blocks/my-block' );
} );
```

For dynamic blocks with a separate render callback:

```php
register_block_type_from_metadata(
    __DIR__ . '/build/blocks/my-block',
    array(
        'render_callback' => 'my_plugin_render_block',
    )
);
```
