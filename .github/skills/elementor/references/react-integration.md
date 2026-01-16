# React Integration with Elementor

## Official Documentation

- **React Documentation**: https://react.dev/
- **Vite Build Tool**: https://vitejs.dev/

## Core Integration Pattern

### Why React in Elementor?

1. **Complex UI**: React handles stateful components better than PHP templates
2. **API Integration**: Easier async data fetching with hooks
3. **Reusability**: Components can be shared across widgets
4. **Modern DX**: Hot reload (limited), JSX, modern JavaScript

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Elementor Editor                        │
├─────────────────────────────────────────────────────────────┤
│  PHP Widget                                                 │
│  ├── register_controls() → Defines UI controls             │
│  ├── render() → Frontend HTML (empty for React)            │
│  └── content_template() → Editor template with React mount │
├─────────────────────────────────────────────────────────────┤
│  React Bundle (main.js)                                     │
│  ├── Listens for elementor/frontend/init                   │
│  ├── Hooks into frontend/element_ready/{widget}.default    │
│  └── Mounts React component into DOM wrapper               │
└─────────────────────────────────────────────────────────────┘
```

## Settings Bridge Pattern

Pass Elementor settings to React without re-rendering the container:

### PHP Side (content_template)
```php
protected function content_template() {
    ?>
    <# 
    const data = {
        title: settings.widget_title,
        columns: settings.columns,
        showImage: settings.show_image === 'yes'
    };
    #>
    <div class="widget-wrapper" data-widget-id="{{ view.model.id }}">
        <input type="hidden" class="settings-data" value="{{ JSON.stringify(data) }}" />
        <div class="react-root"></div>
    </div>
    <?php
}
```

### JavaScript Side (main.jsx)
```javascript
const initWidget = ($scope) => {
    const widgetId = $scope.data('id');
    const rootElement = $scope.find('.react-root')[0];
    const settingsInput = $scope.find('.settings-data');
    
    let settings = {};
    if (settingsInput.length && settingsInput.val()) {
        settings = JSON.parse(settingsInput.val());
    }
    
    // Mount or update React component
    MyWidgetReact.init(widgetId, rootElement, settings);
};
```

## Instance Registry Pattern

Prevent duplicate React roots and enable settings updates:

```javascript
window.MyWidgetReact = {
    instances: {},
    
    init: function(widgetId, rootElement, settings) {
        const existing = this.instances[widgetId];
        
        if (!existing || !existing.rootElement.isConnected) {
            // Create new root
            const root = createRoot(rootElement);
            let setSettings;
            
            const App = () => {
                const [state, setState] = useState(settings);
                setSettings = setState;
                return <MyWidget data={state} />;
            };
            
            root.render(<App />);
            
            this.instances[widgetId] = {
                root,
                rootElement,
                updateSettings: (newSettings) => setSettings?.(newSettings)
            };
        } else {
            // Update existing instance
            existing.updateSettings(settings);
        }
    }
};
```

## Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: path.resolve(__dirname, 'src/main.jsx'),
            output: {
                entryFileNames: 'js/[name].js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name.endsWith('.css')) {
                        return 'css/[name][extname]';
                    }
                    return 'assets/[name][extname]';
                },
            },
        },
        outDir: 'assets',
    },
});
```

## Common Patterns

### Data Fetching with useEffect
```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
    fetch('/wp-json/wp/v2/posts?per_page=10')
        .then(res => res.json())
        .then(setData)
        .finally(() => setLoading(false));
}, []);
```

### Conditional Rendering
```jsx
const MyWidget = ({ widgetData }) => {
    const { showTitle, title } = widgetData;
    
    return (
        <div className="my-widget">
            {showTitle && <h2>{title}</h2>}
            {/* ... */}
        </div>
    );
};
```

## Limitations & Workarounds

| Issue | Workaround |
|-------|------------|
| No HMR in editor | Use `npm run watch` + manual refresh |
| Iframe isolation | MutationObserver for DOM changes |
| Multiple instances | Widget ID registry pattern |
| Settings sync | Hidden input bridge pattern |
