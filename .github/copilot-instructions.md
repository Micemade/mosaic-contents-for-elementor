# Mosaic Product Layouts for Elementor

**Elementor plugin using React for widget rendering** — PHP defines controls, React handles UI.

## Quick Reference

| Path | Purpose |
|------|---------|
| `widgets/*.php` | Elementor widget classes (controls, wrapper template) |
| `src/widgets/*/*.jsx` | React components for each widget |
| `src/main.jsx` | Widget initialization and Elementor hooks |
| `assets/` | Built output (do not edit directly) |

## Development Commands

```bash
npm run watch    # Recommended: auto-rebuild on save, refresh browser manually
npm run build    # Production build
```

## Essential Patterns

- **Widget naming**: PHP class `PascalCase` → `get_name()` returns `kebab-case`
- **Hook pattern**: `frontend/element_ready/{widget-name}.default`
- **No HMR**: Elementor iframe prevents hot reload — use watch + manual refresh

## Skill Reference

For detailed Elementor/React integration patterns, widget creation workflows, and API documentation, see:
→ [skills/elementor/SKILL.md](skills/elementor/SKILL.md)
