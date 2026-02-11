# Visual Architecture Diagrams

> **Companion to ARCHITECTURE.md** — Visual representations of the codebase structure, data flows, and component interactions.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Dual-Bundle Architecture](#dual-bundle-architecture)
3. [Component Interaction](#component-interaction)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Widget Lifecycle](#widget-lifecycle)
6. [File Structure](#file-structure)
7. [WooCommerce Integration](#woocommerce-integration)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Mosaic Product Layouts Plugin                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
        ┌───────▼────────┐                    ┌────────▼─────────┐
        │   PHP Layer    │                    │   React Layer    │
        │   (Elementor)  │                    │   (UI Render)    │
        └───────┬────────┘                    └────────┬─────────┘
                │                                      │
    ┌───────────┼──────────────┐          ┌───────────┼──────────────┐
    │           │              │          │           │              │
┌───▼───┐  ┌───▼────┐  ┌──────▼──┐  ┌───▼──────┐ ┌──▼─────┐ ┌──────▼──────┐
│Widget │  │Control │  │ Script  │  │ Frontend │ │ Editor │ │ WooCommerce │
│Classes│  │Classes │  │Enqueuing│  │  Bundle  │ │ Bundle │ │  Store API  │
└───────┘  └────────┘  └─────────┘  └──────────┘ └────────┘ └─────────────┘
```

---

## Dual-Bundle Architecture

### Bundle Split Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Vite Build Process                             │
└──────────┬──────────────────────────────────┬────────────────────────────┘
           │                                  │
           │                                  │
┌──────────▼──────────┐            ┌──────────▼──────────┐
│  main-frontend.jsx  │            │   main-editor.jsx   │
│   (Entry Point)     │            │    (Entry Point)    │
└──────────┬──────────┘            └──────────┬──────────┘
           │                                  │
           │                                  │
    ┌──────▼──────┐                    ┌──────▼──────┐
    │  Includes:  │                    │  Includes:  │
    │  • Core     │                    │  • Core     │
    │  • Widgets  │                    │  • Widgets  │
    │  • frontend-│                    │  • editor-  │
    │    hooks.js │                    │    hooks.js │
    │  • utils    │                    │  • utils    │
    └──────┬──────┘                    │  • RGL*     │
           │                           └──────┬──────┘
           │                                  │
           │                                  │
    ┌──────▼──────────┐              ┌───────▼──────────┐
    │ main-frontend.js│              │  main-editor.js  │
    │   ~150KB gzip   │              │   ~300KB gzip    │
    │   ~50KB zipped  │              │   ~100KB zipped  │
    └──────┬──────────┘              └───────┬──────────┘
           │                                 │
           │                                 │
    ┌──────▼──────────┐              ┌──────▼───────────┐
    │ Published Pages │              │ Elementor Editor │
    │ (wp_enqueue_    │              │ (preview iframe) │
    │  scripts)       │              │                  │
    └─────────────────┘              └──────────────────┘

    * RGL = react-grid-layout (drag/resize functionality)
```

### Script Loading Decision Tree

```
                        ┌─────────────────┐
                        │  Page Loads     │
                        └────────┬────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │ Is Elementor Editor?      │
                   └────┬─────────────────┬────┘
                        │                 │
                    YES │                 │ NO
                        │                 │
              ┌─────────▼────────┐   ┌────▼─────────────────┐
              │ Preview Iframe?  │   │ Built with Elementor?│
              └─────────┬────────┘   └────┬─────────────────┘
                        │                 │
                    YES │                 │ YES
                        │                 │
            ┌───────────▼──────────┐  ┌───▼──────────────┐
            │ Load main-editor.js  │  │ Load main-       │
            │ + main-editor.css    │  │ frontend.js +    │
            │ (Full functionality) │  │ frontend.css     │
            └──────────────────────┘  │ (Display only)   │
                                      └──────────────────┘
```

---

## Component Interaction

### Core System Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Widget Registry                             │
│  { 'products-layout': { component, settingsMapper } }                │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ Maps widget types
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│ Widget         │  │ Settings        │  │ Widget         │
│ Initializer    │  │ Mappers         │  │ Manager        │
│                │  │                 │  │ (Singleton)    │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        │ Creates init fn    │ Formats settings   │ Manages instances
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ React Widget     │
                    │ Component        │
                    │ (Rendered in DOM)│
                    └──────────────────┘
```

### Elementor ↔ React Communication

```
┌─────────────────────────┐              ┌─────────────────────────┐
│   Elementor Model       │              │   React Component       │
│   (PHP → JS)            │              │   (Widget UI)           │
└────────┬────────────────┘              └────────┬────────────────┘
         │                                        │
         │ 1. Settings Change                     │
         │    model.on('change')                  │
         ├────────────────────────────────────────┤
         │                                        │
         │ 2. Get New Settings                    │
         │    settingsMapper(model) ──────────────▶
         │                                        │
         │ 3. Update Instance                     │
         │    updateInstance() ───────────────────▶
         │                                        │
         │                                        │ 4. User Interaction
         │                                        │    (drag/resize)
         │                                        │
         │ 5. Update Model                        │
         ◀──────────────────────────────────────┤
         │    updateModelSetting()                │
         │                                        │
         │ 6. Trigger Save                        │
         │    setFlagEditorChange(true)           │
         └────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Initial Widget Render (Frontend)

```
┌───────────────┐
│  Page Loads   │
└───────┬───────┘
        │
        ▼
┌──────────────────────┐
│ WordPress Enqueues   │
│ main-frontend.js     │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────┐
│ elementor/frontend/init │
│ Event Fires             │
└──────────┬──────────────┘
           │
           ▼
┌────────────────────────────┐
│ registerFrontendHooks()    │
│ Registers all widget types │
└──────────┬─────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│ frontend/element_ready/           │
│ {widget-type}.default             │
└──────────┬────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│ createWidgetInitializer  │
│ (widgetType, 'display')  │
└──────────┬───────────────┘
           │
           ▼
┌─────────────────────┐
│ Extract from DOM:   │
│ • widgetId          │
│ • wrapper element   │
│ • react-root div    │
│ • settings JSON     │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────┐
│ widgetManager.init()     │
│ Creates React root       │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Render Widget Component  │
│ (Display Mode)           │
└──────────────────────────┘
```

### Settings Sync (Editor Only)

```
┌─────────────────────┐
│ User Changes Panel  │
│ Setting in Editor   │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────┐
│ Elementor Model          │
│ model.set('setting', val)│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ model.on('change')       │
│ Event Listener Fires     │
└──────────┬───────────────┘
           │
           ▼
┌─────────────────────────────┐
│ settingsMapper(model)       │
│ Extracts all settings       │
│ Handles responsive values   │
│ Converts types (bool/num)   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ widgetManager.updateInstance│
│ (widgetType, id, settings)  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ instance.updateSettings()   │
│ Calls React setState        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Component Re-renders        │
│ (No DOM Remount)            │
└─────────────────────────────┘
```

### Custom Layout Save (React → Elementor)

```
┌─────────────────────┐
│ User Drags Grid     │
│ Item in Editor      │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────────┐
│ GridLayout Component      │
│ onLayoutChange() callback │
└──────────┬────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Widget handleLayoutChange()  │
│ Transforms layout data       │
└──────────┬───────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│ updateElementorSetting()          │
│ ('products-layout', id,           │
│  'custom_layout', JSON)           │
└──────────┬────────────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│ widgetManager.updateModelSetting()│
└──────────┬────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ model.setSetting()          │
│ Updates Elementor model     │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ elementor.saver              │
│ .setFlagEditorChange(true)   │
└──────────┬───────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Update/Publish Button      │
│ Becomes Active             │
└────────────────────────────┘
```

---

## Widget Lifecycle

### Instance State Machine

```
                    ┌─────────────┐
                    │   UNMOUNTED │
                    └──────┬──────┘
                           │
              Widget added to page / drag & drop
                           │
                           ▼
                ┌──────────────────┐
                │   INITIALIZING   │
                │  • Extract DOM   │
                │  • Parse settings│
                └──────┬───────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │      MOUNTED        │
            │  • React root exists│
            │  • Component rendered│
            └──────┬──────────────┘
                   │
         ┌─────────┼─────────┬────────────┐
         │         │         │            │
         │ Settings│    Core/│      DOM   │ Page
         │ Change  │ Advanced│   Replaced │ Unload
         │         │  Change │            │
         ▼         ▼         ▼            ▼
    ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────┐
    │UPDATE  │ │REMOUNT │ │RECREATE │ │UNMOUNT │
    │(setState)│(Original│ │(New Root)│ │(GC)    │
    └───┬────┘ renderOn│ └────┬────┘ └────────┘
        │      Change) │      │
        │      └───┬───┘      │
        │          │          │
        └──────────┴──────────┘
                   │
                   ▼
            ┌─────────────┐
            │   MOUNTED   │
            │  (Updated)  │
            └─────────────┘
```

### Conditional RenderOnChange Logic (Editor)

```
┌───────────────────────────┐
│ Settings Change Detected  │
└────────────┬──────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Get changed attribute keys     │
└────────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Is changed key in      │
    │ widget-owned keys?*    │
    └───┬─────────────┬──────┘
        │             │
    YES │             │ NO
        │             │
        ▼             ▼
┌───────────────┐ ┌──────────────────┐
│ Return false  │ │ Call original    │
│ (React handles│ │ renderOnChange() │
│  update)      │ │ (Allow remount)  │
└───────────────┘ └──────────────────┘

* Widget-owned keys include:
  - All settings from settings schema
  - Responsive variants (_tablet, _mobile)
  - NOT core/advanced settings
```

---

## File Structure

### Source Code Organization

```
src/
│
├─ main-frontend.jsx ◄──────────────────┐ Entry Points
├─ main-editor.jsx   ◄──────────────────┤ (Vite Input)
├─ globalStyles.scss                    │
│                                       │
├─ core/ ◄──────────────────────────────┤ Core System
│  ├─ widget-registry.js               │ • Registry
│  ├─ widget-manager.jsx               │ • Manager
│  ├─ widget-initializer.js            │ • Initializer
│  ├─ frontend-hooks.js  ◄─────────────┤ • Hooks (split)
│  ├─ editor-hooks.js    ◄─────────────┤
│  └─ elementor-utils.js               │
│                                       │
├─ widgets/ ◄───────────────────────────┤ Widget Components
│  ├─ settings-mappers.js              │
│  └─ products-layout/                 │
│     ├─ products-layout.jsx           │
│     ├─ products-layout.scss          │
│     ├─ components/                   │
│     │  ├─ ProductImage.jsx           │
│     │  ├─ AddToCartButton.jsx        │
│     │  └─ RatingStars.jsx            │
│     └─ utils/                        │
│        └─ products-layout-settings.json
│                                       │
├─ shared/ ◄────────────────────────────┤ Shared Resources
│  ├─ layouts.json                     │
│  ├─ components/                      │
│  │  ├─ GridLayout.jsx                │
│  │  └─ utils/                        │
│  ├─ utils/                           │
│  │  ├─ addItem.js                    │
│  │  ├─ layoutUtils.js                │
│  │  ├─ productUtils.js               │
│  │  └─ generalUtils.js               │
│  └─ assets/                          │
│     ├─ _gridLayout.scss              │
│     └─ _productElements.scss         │
│                                       │
└─ controls/ ◄──────────────────────────┤ Custom Controls
   ├─ focal-point-control.jsx          │
   ├─ FocalPointControlView.jsx        │
   └─ focal-point-control.scss         │
                                        │
                                        │
PHP Files (Root Level)                  │
│                                       │
├─ widgets/ ◄───────────────────────────┤ PHP Widgets
│  └─ products-layout.php              │
│                                       │
├─ controls/ ◄──────────────────────────┤ PHP Controls
│  └─ focal-point.php                  │
│                                       │
└─ mosaic-product-layouts-for-         │
   elementor.php ◄──────────────────────┘ Main Plugin File


Build Output (Generated)
│
assets/
├─ js/
│  └─ main-frontend.js  ◄── Frontend Bundle
├─ css/
│  └─ main-frontend.css
└─ admin/
   ├─ js/
   │  ├─ main-editor.js ◄── Editor Bundle
   │  └─ focal-point-control.js
   └─ css/
      ├─ main-editor.css
      └─ focal-point-control.css
```

### Build Pipeline

```
┌─────────────────┐
│  package.json   │
│  npm run build  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│      vite.config.js             │
│  Multi-entry configuration      │
└────────┬────────────────────────┘
         │
         ├─────────────────┬────────────────┬──────────────────┐
         │                 │                │                  │
         ▼                 ▼                ▼                  ▼
┌──────────────┐  ┌───────────────┐  ┌─────────────┐  ┌──────────┐
│main-frontend │  │ main-editor   │  │focal-point  │  │ Global   │
│    .jsx      │  │    .jsx       │  │ -control.jsx│  │ Styles   │
└──────┬───────┘  └───────┬───────┘  └──────┬──────┘  └────┬─────┘
       │                  │                 │              │
       │ Vite Transform   │ Vite Transform  │ Transform    │ SCSS
       │ • JSX → JS       │ • JSX → JS      │              │ Compile
       │ • Tree shake     │ • Bundle RGL    │              │
       │ • Minify         │ • Minify        │              │
       │                  │                 │              │
       ▼                  ▼                 ▼              ▼
┌──────────────┐  ┌───────────────┐  ┌─────────────┐  ┌──────────┐
│ assets/js/   │  │ assets/admin/ │  │assets/admin/│  │assets/   │
│ main-        │  │ js/main-      │  │js/focal-    │  │css/      │
│ frontend.js  │  │ editor.js     │  │point-       │  │*.css     │
│              │  │               │  │control.js   │  │          │
└──────────────┘  └───────────────┘  └─────────────┘  └──────────┘

External Dependencies (Not Bundled)
├─ React        ──────► window.React (WordPress)
└─ ReactDOM     ──────► window.ReactDOM (WordPress)
```

---

## WooCommerce Integration

### Product Fetch Flow

```
┌──────────────────────┐
│ Widget Component     │
│ Mounts (useEffect)   │
└──────────┬───────────┘
           │
           ▼
┌───────────────────────────────┐
│ Extract Query Parameters      │
│ • category_ids                │
│ • per_page                    │
│ • orderby, order              │
│ • on_sale, featured           │
└──────────┬────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ fetch('/wp-json/wc/store/products')│
│ + URLSearchParams                  │
│ + Headers: { Nonce: ... }          │
└──────────┬─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ WooCommerce Store API   │
│ Processes Request       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Returns Product Array   │
│ [{id, name, price,      │
│   images, rating...}]   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Component setState      │
│ Stores products         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Render Product Grid     │
│ Map over products       │
│ Assign to layout items  │
└─────────────────────────┘
```

### Add to Cart Flow

```
┌──────────────────────┐
│ User Clicks Button   │
│ <AddToCartButton/>   │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────┐
│ Prepare Request             │
│ {                           │
│   id: productId,            │
│   quantity: 1               │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ POST /wp-json/wc/store/cart/     │
│      add-item                    │
│ Headers: { Nonce: ... }          │
└──────────┬───────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ WooCommerce Validates   │
│ • Nonce                 │
│ • Product exists        │
│ • Stock available       │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │           │
   SUCCESS     ERROR
     │           │
     ▼           ▼
┌─────────┐  ┌────────────┐
│ Add to  │  │ Return     │
│ Cart    │  │ Error Msg  │
└────┬────┘  └──────┬─────┘
     │              │
     ▼              ▼
┌─────────┐  ┌────────────┐
│ Return  │  │ Component  │
│ Success │  │ Shows Error│
│ Response│  └────────────┘
└────┬────┘
     │
     ▼
┌──────────────────┐
│ Component Shows  │
│ • Success notice │
│ • Update cart    │
│   count (if any) │
└──────────────────┘
```

### Authentication Flow

```
┌──────────────────────────┐
│ PHP Plugin Init          │
│ enqueue_store_api_nonce()│
└──────────┬───────────────┘
           │
           ▼
┌─────────────────────────────┐
│ wp_create_nonce(            │
│   'wc_store_api'            │
│ )                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ wp_localize_script()        │
│ window.MPL4E = {            │
│   storeApiNonce: '...',     │
│   cartUrl: '...',           │
│   placeholderImg: '...'     │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ React Component             │
│ Reads window.MPL4E          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Add to Request Headers      │
│ {                           │
│   'Nonce': window.MPL4E     │
│            .storeApiNonce   │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ WooCommerce Verifies Nonce  │
│ wp_verify_nonce()           │
└─────────────────────────────┘
```

---

## Responsive Breakpoints System

### Breakpoint Configuration Flow

```
┌───────────────────────────┐
│ Elementor Settings        │
│ (Site Settings > Layout)  │
└──────────┬────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ elementorFrontend.config        │
│ .responsive.activeBreakpoints   │
│ { mobile: {...},                │
│   tablet: {...} }               │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ getActiveBreakpoints()          │
│ Returns: ['desktop', 'tablet',  │
│           'mobile']             │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Settings Mapper                 │
│ • Reads base value (desktop)    │
│ • Reads key_tablet              │
│ • Reads key_mobile              │
│ Returns: {                      │
│   desktop: val,                 │
│   tablet: val,                  │
│   mobile: val                   │
│ }                               │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ React Component                 │
│ Uses breakpoint-specific values │
│ in CSS or inline styles         │
└─────────────────────────────────┘
```

---

## Custom Control Integration

### Focal Point Control Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Elementor Panel                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Register Control
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PHP: controls/focal-point.php                               │
│ class Focal_Point extends Base_Data_Control {               │
│   get_type() { return 'mpl4e_focal_point'; }                │
│   content_template() { /* Backbone template */ }            │
│ }                                                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Enqueue Script
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ focal-point-control.js (Built from React)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Render Control UI
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ React: src/controls/focal-point-control.jsx                 │
│ • Renders visual picker                                     │
│ • Handles click/drag interaction                            │
│ • Calculates x/y percentages                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Update Model
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Elementor Model                                             │
│ setValue({ x: '50%', y: '50%' })                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Development Workflow Diagram

```
┌────────────┐
│ npm run    │
│ watch      │
└─────┬──────┘
      │
      ▼
┌──────────────────────┐
│ Vite Watch Mode      │
│ Monitors: src/**/*   │
└──────────┬───────────┘
           │
      File Changes
           │
           ▼
┌──────────────────────┐
│ Auto Build           │
│ • Transform JSX      │
│ • Bundle modules     │
│ • Write to assets/   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     ┌────────────────┐
│ Manual Browser       │────▶│ See Changes    │
│ Refresh Required     │     │ (No HMR)       │
└──────────────────────┘     └────────────────┘
      │
      │ Why no HMR?
      ▼
┌──────────────────────────────────┐
│ Elementor runs in iframe         │
│ HMR cannot communicate           │
│ through iframe boundary          │
└──────────────────────────────────┘
```

---

## Key Patterns Summary

### Pattern: Compound Instance Keys
```
widgetType + '_' + widgetId
    ↓
'products-layout_abc123'

Prevents collisions when:
• Multiple widget types exist
• Same widget used multiple times
• Widget instances need unique React roots
```

### Pattern: Mode-Based Rendering
```
mode === 'edit'  → Full editor features
                   • Drag/resize
                   • Add/remove items
                   • Settings sync

mode === 'display' → Display only
                     • No interactions
                     • Lighter bundle
                     • Faster load
```

### Pattern: Conditional Remount
```
Change Source         | Action
──────────────────────┼──────────────────
Widget setting        | Update in place
Responsive variant    | Update in place
Core/Advanced setting | Allow Elementor remount
DOM disconnected      | Recreate React root
```

---

## Global Object References

```
window
├─ MosaicLayoutsReact ◄─────────────── Widget Manager Singleton
│  ├─ instances {}                     Instance registry
│  ├─ modelGetters {}                  Editor model accessors
│  ├─ models {}                        Elementor models
│  ├─ updateModelSetting()             React → Elementor
│  ├─ updateInstance()                 Update React state
│  └─ getModel()                       Get Elementor model
│
├─ MPL4E ◄──────────────────────────── Localized PHP Data
│  ├─ storeApiNonce                    WooCommerce auth
│  ├─ cartUrl                          Cart page URL
│  ├─ ajaxUrl                          AJAX endpoint
│  └─ placeholderImg                   Default image
│
├─ elementorFrontend ◄─────────────── Elementor Frontend API
│  ├─ hooks.addAction()                Register hooks
│  └─ config.responsive                Breakpoint config
│     └─ activeBreakpoints
│
└─ elementor ◄─────────────────────── Elementor Editor API
   ├─ hooks.addFilter()                Register filters
   ├─ hooks.addAction()                Register actions
   ├─ channels.editor                  Event bus
   │  ├─ on()                          Listen to events
   │  └─ trigger()                     Emit events
   ├─ saver
   │  └─ setFlagEditorChange()         Mark as changed
   └─ getPanelView()                   Active panel
```

---

## Summary: Critical Paths

### Path 1: Frontend Display
```
Page Load → Enqueue frontend.js → elementor/frontend/init → 
registerFrontendHooks → element_ready → createWidgetInitializer → 
widgetManager.init → Render Display Component
```

### Path 2: Editor Live Sync
```
Change Panel → model.set → model.on('change') → settingsMapper → 
updateInstance → setState → Re-render (No Remount)
```

### Path 3: Custom Layout Save
```
Drag Item → onLayoutChange → updateElementorSetting → 
updateModelSetting → model.setSetting → setFlagEditorChange → 
Enable Update Button
```

### Path 4: WooCommerce Products
```
Component Mount → useEffect → fetch Store API → Parse Response → 
setState(products) → Map to Grid → Render
```

---

**End of Visual Architecture Diagrams**

> For detailed implementation notes, see [ARCHITECTURE.md](ARCHITECTURE.md)  
> For quick development reference, see [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
