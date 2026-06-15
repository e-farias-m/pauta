---
name: ui-ux-consistency
description: Use when editing UI code in src/ui.js, src/education.js, src/design-system.css, or any inline styles/templates that generate HTML dialogs, modals, exercise menus, or score UI. Provides design token references and component patterns for visual consistency.
---

# UI/UX Consistency

When editing UI code in Pauta, follow the project's design system defined in `src/design-system.css`.

## Design Tokens

Use CSS variables instead of hardcoded values:

### Colors
| Token | Value | Use for |
|-------|-------|---------|
| `var(--pauta-primary)` | #c05621 | Primary accents, headings, active states |
| `var(--pauta-primary-light)` | #e06850 | Hover states, category rhythm color |
| `var(--pauta-primary-dark)` | #9c4221 | Dark variant |
| `var(--pauta-success)` | #22c55e | Correct answers, completion |
| `var(--pauta-warning)` | #e6a817 | Warnings, near-misses |
| `var(--pauta-error)` | #e06850 | Errors (same as primary-light) |
| `var(--pauta-bg)` | #f0ebe3 | Page background |
| `var(--pauta-bg-card)` | #fff | Card backgrounds |
| `var(--pauta-text)` | #2d3748 | Body text |
| `var(--pauta-text-muted)` | rgba(74,85,104,0.7) | Secondary text |
| `var(--pauta-text-subtle)` | rgba(74,85,104,0.5) | Metadata |

### Category Colors
| Token | Color | Category |
|-------|-------|----------|
| `var(--pauta-cat-rhythm)` | #e06850 | Rhythm exercises |
| `var(--pauta-cat-pitch)` | #c05621 | Pitch exercises |
| `var(--pauta-cat-ear)` | #22c55e | Ear training |
| `var(--pauta-cat-theory)` | #4a5568 | Theory exercises |

### Spacing
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px

### Border Radius
- sm: 6px, md: 10px, lg: 12px, pill: 16px, full: 9999px

### Typography
- Sizes: xs:10px, sm:11px, md:12px, lg:13px, xl:14px, 2xl:16px, 3xl:20px

## Component Patterns

### Modals
Always use `makeModal(innerHTML)`. Content structure:
```html
<h2>Title</h2>
<p class="dialog-hint">Optional subtitle</p>
<!-- body content -->
<button class="modal-btn secondary" data-action="closeModal">Cancel</button>
```

Consider using CSS classes from design-system.css instead of inline styles:
- `.pauta-modal`, `.pauta-modal-header`, `.pauta-modal-body`, `.pauta-modal-footer`
- `.pauta-actions` for button groups
- `.pauta-hero` / `.pauta-hero-title` / `.pauta-hero-desc` for hero sections
- `.pauta-category` / `.pauta-category-title` for category groupings
- `.pauta-grid` for 2-column card layouts
- `.pauta-card` / `.pauta-card-title` / `.pauta-card-desc` / `.pauta-card-meta` for cards
- `.pauta-pills` / `.pauta-pill` for pill/tab selectors
- `.pauta-stats` / `.pauta-stat-num` for stats display

### Button types
- Primary action: `<button class="modal-btn primary">` (orange bg)
- Secondary/dismiss: `<button class="modal-btn secondary">` (outline)
- Wide panel: `<button class="panel-btn-wide">`
- Active/pressed: use `transform: scale(0.97)` or `var(--press-scale)`

### Exercise MC grid
Use `_showMCGrid(options, handler)` which creates a 2-column button grid with `.mc-btn`.

### Palette buttons
`.dur-btn.active` for selected durations. `.note-btn` for note palette buttons.

## Anti-patterns to Avoid
- Hardcoded orange hex values besides #c05621 or #e06850 (e.g., #dd6b20, #ed8932)
- Raw `#333`, `#666`, `#999` for text (use `--pauta-text` variants)
- `border-radius: 5px` or `8px` (use `--pauta-radius-sm` 6px or `--pauta-radius-md` 10px)
- `padding: 10px` (use `--pauta-space-sm` 8px or `--pauta-space-md` 12px)
- `font-size: 13px` (use `--pauta-text-lg`)
- Custom `display: grid` with inline styles — use `.pauta-grid`
- Inline `@media` queries — add to design-system.css instead
- Hardcoded font-family stacks — use `var(--pauta-font-sans)`
