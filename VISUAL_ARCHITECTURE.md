# Visual Architecture Diagrams

> **Companion to ARCHITECTURE.md** — Visual representations of the codebase structure, data flows, and component interactions for the Mosaic Contents for Elementor plugin.

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Dual-Bundle Architecture](#dual-bundle-architecture)
3. [Component Interaction](#component-interaction)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Widget Lifecycle](#widget-lifecycle)
6. [File Structure](#file-structure)
7. [WordPress Integration](#wordpress-integration)
8. [Saved Setups Feature](#saved-setups-feature)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Mosaic Contents for Elementor Plugin                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴──────────────────┐
                │                                      │
        ┌───────▼────────┐                    ┌────────▼─────────┐
        │   PHP Layer    │                    │   React Layer    │
        │   (Elementor)  │                    │   (UI Render)    │
        └──────┬─────────┘                    └────────┬─────────┘
               │                                       │
    ┌──────────┼────────────┐          ┌───────────────┼──────────────┐
    │          │            │          │               │              │
┌───▼───┐  ┌───▼────┐  ┌────▼────┐  ┌─────▼────┐ ┌─────▼─────┐ ┌──────▼──────┐
│Widget │  │Control │  │ Script  │  │ Frontend │ │   Editor  │ │  WordPress  │
│Classes│  │Classes │  │Enqueuing│  │  Bundle  │ │   Bundle  │ │  REST API   │
└───────┘  └────────┘  └─────────┘  └──────────┘ └───────────┘ └─────────────┘
                │
            ┌───▼────────────────────────────────────────┐
            │   Custom Controls (Panel)                  │
            ├──────────────┬──────────────┬──────────────┤
            │ Focal Point  │ Saved Setups │ Post-Type    │
            │ Element Sort │ (presets)    │ Select       │
            └──────────────┴──────────────┴──────────────┘
```

---

## Dual-Bundle Architecture

### Bundle Split Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
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
│   { 'content-layout': {…}, 'widgets-layout': {…} }                   │
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
         ◀────────────────────────────────────────┤
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
│ Registers content-layout   │
└──────────┬─────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│ frontend/element_ready/           │
│ content-layout.default            │
└──────────┬────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ createWidgetInitializer     │
│ (content-layout, 'display') │
└──────────┬──────────────────┘
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
│ Render ContentLayout     │
│ Component (Display Mode) │
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
│ view.renderUI()             │
│ Regenerates CSS (selectors) │
│ No DOM destruction          │
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
┌──────────────────────────┐
│ User Drags/Resizes Grid  │
│ Item in Editor           │
└──────────┬───────────────┘
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
│ ('content-layout', id,            │
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
│ $e.run('document/elements/  │
│ settings', { container,     │
│ settings })                 │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Fallback: model.setSetting()│
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
                  │  UNMOUNTED  │
                  └──────┬──────┘
                         │
        Widget added to page / drag & drop
                         │
                         ▼
                ┌───────────────────┐
                │   INITIALIZING    │
                │  • Extract DOM    │
                │  • Parse settings │
                └───────┬───────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │      MOUNTED           │
            │  • React root exists   │
            │  • Component rendered  │
            └──────┬─────────────────┘
                   │
         ┌─────────┼─────────┬────────────┐
         │         │         │            │
         │ Settings│    Core/│      DOM   │ Page
         │ Change  │ Advanced│   Replaced │ Unload
         │         │  Change │            │
         ▼         ▼         ▼            ▼
    ┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐
    │UPDATE  │ │REMOUNT │ │ RECREATE │ │ UNMOUNT │
    │(setState)│(Orig.  │ │(New Root)│ │ (GC)    │
    └───┬────┘ │renderOn│ └─────┬────┘ └─────────┘
        │      │Change) │       │
        │      └───┬────┘       │
        │          │            │
        └──────────┴────────────┘
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
    ┌─────────────────┐ ┌─────────────────┐
    │ Is changed key  │ │ If changed key  │
    │ widget-owned?   │ │ IS widget-owned:│
    └───┬───────────┬─┘ │ renderUI() for  │
        │           │   │ CSS only        │
    YES │           │ NO└─────────────────┘
        │           └─┐
        ▼             ▼
┌────────────────┐ ┌──────────────────┐
│ view.renderUI()│ │ Call original    │
│ (CSS only,     │ │ renderOnChange() │
│  React stays)  │ │ (Allow remount)  │
└────────────────┘ └──────────────────┘

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
│                                      │
├─ widgets/ ◄──────────────────────────┤ Widget Components
│  ├─ settings-mappers.js              │ createSettingsMapper() factory
│  └─ content-layout/                  │
│     ├─ content-layout.jsx            │
│     ├─ content-layout.scss           │
│     └─ react-settings.json ◄─────────┤ Settings source of truth
│                                      │
├─ shared/ ◄───────────────────────────┤ Shared Resources
│  ├─ layouts.json                     │
│  ├─ components/                      │
│  │  ├─ GridLayout.jsx                │
│  │  ├─ Pagination.jsx                │
│  │  ├─ ZIndexControls.jsx            │
│  │  └─ utils/events.js               │
│  ├─ utils/                           │
│  │  ├─ hooks.js  ◄───────────────────┤ useCssVariables(), useGridSettings()
│  │  ├─ addItem.js                    │
│  │  ├─ alignmentUtils.js             │
│  │  ├─ dataLoading.js                │
│  │  ├─ layoutUtils.js                │
│  │  ├─ layoutEditing.js              │
│  │  ├─ elementOrdering.js            │
│  │  ├─ LRUCache.js                   │
│  │  ├─ fetchHelpers.js               │
│  │  ├─ transformationUtils.js        │
│  │  ├─ visibleLayout.js              │
│  │  └─ generalUtils.js               │
│  └─ assets/                          │
│     ├─ _gridLayout.scss              │
│     ├─ _itemControls.scss            │
│     └─ _contentElements.scss         │
│                                      │
└─ controls/ ◄─────────────────────────┤ Custom Controls
   ├─ focal-point-control.jsx          │
   ├─ FocalPointControlView.jsx        │
   ├─ focal-point-control.scss         │
   ├─ saved-setups-control.jsx         │
   └─ saved-setups-control.scss        │


PHP Files (Root Level)                  │
│                                       │
├─ widgets/ ◄───────────────────────────┤ PHP Widgets
│  ├─ content-layout/content-layout.php │
│  └─ widgets-layout/widgets-layout.php │
│                                       │
├─ controls/ ◄──────────────────────────┤ PHP Controls
│  ├─ focal-point.php                   │
│  ├─ element-sorting.php               │
│  └─ saved-setups.php                  │
│                                       │
├─ includes/                            │
│  ├─ trait-widget-helpers.php          │ Shared render(), content_template()
│  └─ class-rest-api.php                │
│                                       │
└─ mosaic-contents-for-elementor.php ◄──┘ Main Plugin File


Build Output (Generated)

assets/
├─ js/
│  └─ main-frontend.js  ◄── Frontend Bundle
├─ css/
│  └─ main-frontend.css
└─ admin/
   ├─ js/
   │  ├─ main-editor.js ◄── Editor Bundle
   │  ├─ focal-point-control.js
   │  └─ saved-setups-control.js
   └─ css/
      ├─ main-editor.css
      ├─ focal-point-control.css
      └─ saved-setups-control.css
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

## WordPress Integration

### Post Fetch Flow

```
┌──────────────────────┐
│ Widget Component     │
│ Mounts (useEffect)   │
└──────────┬───────────┘
           │
           ▼
┌───────────────────────────────┐
│ Extract Query Parameters      │
│ • post_type                   │
│ • per_page                    │
│ • orderby, order              │
│ • category_ids                │
└──────────┬────────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│ fetch('/wp-json/wp/v2/posts')      │
│ + URLSearchParams                  │
│ + Headers: { Nonce: ... }          │
└──────────┬─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ WordPress REST API      │
│ Processes Request       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Returns Post Array      │
│ [{id, title, content,    │
│   excerpt, featured_media}] │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Component setState      │
│ Stores posts            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Render Post Grid        │
│ Map over posts          │
│ Assign to layout items  │
└─────────────────────────┘
```

### Authentication Flow

```
┌──────────────────────────┐
│ PHP Plugin Init          │
│ enqueue_rest_api_nonce() │
└──────────┬───────────────┘
           │
           ▼
┌─────────────────────────────┐
│ wp_create_nonce(            │
│   'wp_rest'                 │
│ )                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ wp_localize_script()        │
│ window.MC4E = {            │
│   restApiNonce: '...',      │
│   ajaxUrl: '...',           │
│   placeholderImg: '...'     │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ React Component             │
│ Reads window.MC4E          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Add to Request Headers      │
│ {                           │
│   'X-WP-Nonce': window.MC4E│
│               .restApiNonce │
│ }                           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ WordPress Verifies Nonce    │
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
│ getActiveBreakpointNames()      │
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
│   get_type() { return 'mc4e_focal_point'; }                │
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

### Saved Setups Control Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Elementor Panel                        │
└────────────────────────────┬────────────────────────────────┘
                            │  "Saved Setups" Section
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PHP: controls/saved-setups.php                              │
│ class Saved_Setups extends Base_Data_Control {              │
│   get_type() { return 'mc4e_saved_setups'; }               │
│   content_template() { /* hidden input + React mount div */ }│
│   enqueue() { /* loads saved-setups-control.js */ }          │
│ }                                                            │
└───────────────────────────┬─────────────────────────────────┘
                            │  Enqueue Script
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ saved-setups-control.js (IIFE, deps: wp-api-fetch, wp-i18n) │
└───────────────────────────┬─────────────────────────────────┘
                            │  initSavedSetupsControl()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ React: src/controls/saved-setups-control.jsx                │
│ • SavedSetupsUI component (select, input, save/delete btns) │
│ • captureSettingsFromModel() → reads all widget settings     │
│ • applySettingsToModel() → triggers mosaic:applySetup event  │
│ • wp.apiFetch → /wp/v2/settings (read/write mc4e_...setups) │
└───────────────────────────┬─────────────────────────────────┘
                            │  On load setup:
                            │  elementor.channels.editor
                            │  .trigger('mosaic:applySetup')
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ editor-hooks.js (preview iframe context)                    │
│ 1. Disable renderOnChange                                   │
│ 2. Disable change:mc4e_layout listener                     │
│ 3. settingsModel.set(setupSettings) ← atomic batch           │
│ 4. Restore renderOnChange                                   │
│ 5. Restore layout listener                                  │
│ 6. widgetManager.updateInstance() → React setState           │
│ 7. view.renderUI() → CSS regeneration                       │
│ 8. saver.setFlagEditorChange(true)                           │
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
'content-layout_abc123'

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
├─ MosaicContentsReact ◄─────────────── Widget Manager Singleton
│  ├─ instances {}                     Instance registry
│  ├─ modelGetters {}                  Editor model accessors
│  ├─ models {}                        Elementor models
│  ├─ updateModelSetting()             React → Elementor
│  ├─ updateInstance()                 Update React state
│  └─ getModel()                       Get Elementor model
│
├─ MC4E ◄──────────────────────────── Localized PHP Data
│  ├─ restApiNonce                     WordPress REST API auth
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
   │  ├─ trigger()                     Emit events
   │  └─ Custom Events:
   │     ├─ mosaic:resetLayout         Reset to predefined
   │     ├─ mosaic:addItem             Add new grid item
   │     └─ mosaic:applySetup          Batch-apply saved setup
   ├─ saver
   │  └─ setFlagEditorChange()         Mark as changed
   ├─ addControlView()                 Register custom control views
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
updateInstance → setState → view.renderUI() (CSS) → Re-render (No Remount)
```

### Path 3: Custom Layout Save
```
Drag Item → onLayoutChange → updateElementorSetting →
updateModelSetting → model.setSetting → setFlagEditorChange →
Enable Update Button
```

### Path 4: WordPress Posts
```
Component Mount → useEffect → fetch REST API → Parse Response →
setState(posts) → Map to Grid → Render
```

### Path 5: Saved Setup Load
```
Select Setup → apiFetch(/wp/v2/settings) → get setup.settings →
trigger('mosaic:applySetup') → disable renderOnChange →
settingsModel.set(batch) → restore handlers →
updateInstance (React) + renderUI (CSS) → saver.setFlagEditorChange
```

### Path 6: Saved Setup Save
```
Type Name + Click Save → captureSettingsFromModel(model) →
capture layout/style/CSS/group-control keys →
apiFetch POST /wp/v2/settings → persist to wp_options →
show toast notification

**End of Visual Architecture Diagrams**

> For detailed implementation notes, see [ARCHITECTURE.md](ARCHITECTURE.md)  
> For quick development reference, see [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
