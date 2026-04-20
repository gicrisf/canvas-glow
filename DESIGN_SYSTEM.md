# IBM Corporate Terminal Design System

This document defines the design language and implementation patterns for the Canvas Glow ASR frontend.

## Design Principles

### 1. Vertical Rhythm
All heights and spacing derive from a `1.4em` base line-height. This creates predictable alignment and visual consistency.

**Rule**: Use spacing variables (`--space-xs`, `--space-sm`, `--space-md`, `--space-lg`) for all margins, padding, and gaps.

### 2. Flat Design
No decoration, shadows, or gradients. Interface elements are defined by borders and color contrast only.

**Rule**: No `box-shadow`, no `background: linear-gradient()`, no `filter: drop-shadow()`.

### 3. Minimal Rounding
Border radius limited to `2px` for subtle corner softening without distraction.

**Rule**: Always use `border-radius: var(--border-radius)` or `var(--border-radius)` directly (never hardcoded values > 2px).

### 4. Instant Feedback
State changes are immediate. No transitions or animations except for functional indicators (like recording state).

**Rule**: No `transition` properties on interactive elements. Remove all `@keyframes` animations.

### 5. Monospace Typography
Single font family throughout: `var(--font-mono)` (monospace).

**Rule**: No font-family overrides. All text uses the same typeface.

---

## CSS Custom Properties Reference

Defined in `src/index.css`:

### Vertical Rhythm
```css
--line-height: 1.4em          /* Base line height */
--space-unit: 1.4em           /* Base spacing unit */
--space-xs: 0.35em            /* 0.25 × unit */
--space-sm: 0.7em             /* 0.5 × unit */
--space-md: 1.4em             /* 1 × unit */
--space-lg: 2.1em             /* 1.5 × unit */
```

### Typography
```css
--font-mono: monospace
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-base: 1rem
```

### Colors
```css
--color-bg: #0a0a0a
--color-border: rgba(255, 255, 255, 0.12)
--color-border-subtle: rgba(255, 255, 255, 0.06)
--color-text: rgba(255, 255, 255, 0.87)
--color-text-muted: rgba(255, 255, 255, 0.5)
--color-text-dim: rgba(255, 255, 255, 0.3)
--color-ok: #4ade80
--color-error: #f87171
--color-warning: #fbbf24
--color-processing: #9370db
--color-recording: #ff69b4
--color-idle: #6b7280
```

### Layout Constants
```css
--input-height: var(--line-height)    /* All inputs same height */
--input-bg: #1a1a1a
--input-border: #333
--border-radius: 2px
--navbar-height: 2em
--footer-height: 1.8em
--column-min-width: 400px
```

---

## Layout Patterns

### Navbar
- Fixed height: `var(--navbar-height)` (2em)
- Sticky positioning: `top: 0`
- Status indicator: `● STATUS` format (bullet + text)
- No backdrop blur, no transitions

### Footer
- Fixed height: `var(--footer-height)` (1.8em)
- Sticky positioning: `bottom: 0`
- Single-line display with `text-overflow: ellipsis`

### Columns
- Auto-fit grid: `repeat(auto-fit, minmax(var(--column-min-width), 1fr))`
- Stacks automatically on narrow screens
- Vertical dividers: `border-right: 1px solid var(--color-border-subtle)`

### Hero Section
- Collapsible with `▶`/`▼` indicators
- Instant toggle (no animation)
- Collapsed state shows minimal control bar

---

## Form Control Patterns

Defined in `src/components/panels/FormControls.css`.

### Layout Classes

| Class            | Purpose                                     |
|------------------|---------------------------------------------|
| `.form-stack`    | Vertical flex with `gap: var(--space-sm)`   |
| `.form-row`      | Horizontal flex with `gap: var(--space-xs)` |
| `.form-row-wrap` | Same as row but with `flex-wrap: wrap`      |

### Input Classes

| Class                | Purpose                                    |
|----------------------|--------------------------------------------|
| `.form-input`        | Standard input with rhythm-based height    |
| `.form-input-flex`   | Flexes to fill available space             |
| `.form-input-narrow` | Fixed 3.5rem width, centered text          |
| `.form-input-number` | Fixed 4rem width, centered text            |
| `.form-select`       | Standard select dropdown                   |
| `.form-textarea`     | Multi-line text input with vertical resize |

### Button Classes

| Class                            | Purpose                             |
|----------------------------------|-------------------------------------|
| `.form-button`                   | Standard button with minimal border |
| `.form-button-toggle`            | Toggle button (ON/OFF state)        |
| `.form-button-toggle.active`     | Active state (green background)     |
| `.form-button-toggle.vad-active` | VAD active state (blue background)  |

### Status Classes

| Class                  | Color                                  |
|------------------------|----------------------------------------|
| `.form-status-ok`      | Green (`var(--color-ok)`)              |
| `.form-status-error`   | Red (`var(--color-error)`)             |
| `.form-status-warning` | Yellow (`var(--color-warning)`)        |
| `.form-status-unknown` | Muted grey (`var(--color-text-muted)`) |
|                        |                                        |

### Utility Classes

| Class                    | Purpose                             |
|--------------------------|-------------------------------------|
| `.form-label`            | Label with consistent spacing       |
| `.form-label-inline`     | Label with min-width for alignment  |
| `.form-hint`             | Small muted helper text             |
| `.form-divider`          | Top border with spacing             |
| `.form-section-disabled` | Dim section (opacity 0.4)           |
| `.form-grid-2col`        | Two-column grid for parameter pairs |

---

## Collapsible Sections

### Implementation Pattern
1. Store section state in Zustand: `sectionState: Record<string, boolean>`
2. Add action: `setSectionOpen(section: string, isOpen: boolean)`
3. Persist state in localStorage via `partialize`
4. Use `▶`/`▼` indicators (NOT `+`/`−`)

### Section Header
```tsx
<button className="settings-section-header" onClick={onToggle}>
  <span>{title}</span>
  <span className="settings-section-toggle">{isOpen ? '▼' : '▶'}</span>
</button>
```

---

## Component Guidelines

### Server Settings
- URL input + status indicator + check button
- Status colors: ok (green), error (red), loading (yellow), unknown (grey)

### ASR Settings
- Language dropdown (flex to fill)
- System prompt textarea (syncs on blur)
- Checkbox controls with inline hints

### Audio Settings
- Toggle buttons with clear ON/OFF state
- Range slider with percentage display
- Audio preview players in divider section
- Disabled section dims when no recording available

### VAD Settings
- Disabled state when realtime mode is off
- Two-column grid for parameter pairs
- Number inputs with unit suffixes (ms)

---

## State Indicators

### Color Coding
- **Idle**: Grey (`var(--color-idle)`)
- **Recording**: Hot pink (`var(--color-recording)`)
- **Processing**: Medium purple (`var(--color-processing)`)
- **Success**: Green (`var(--color-ok)`)
- **Error**: Red (`var(--color-error)`)

### Format
Always use: `● STATE` (bullet + uppercase text)

Example:
```tsx
<span style={{ color: statusColor }}>● {statusText.toUpperCase()}</span>
```

---

## What NOT To Do

### ❌ Avoid
- Inline styles for spacing (use CSS classes)
- Hardcoded colors (use CSS custom properties)
- Transitions on state changes
- Box shadows or drop shadows
- Rounded corners > 2px
- Multiple font families
- Background gradients
- Animations (except functional indicators)
- Arbitrary spacing values (use rhythm units)

### ✅ Instead
- Use form control classes from `FormControls.css`
- Reference color variables from `:root`
- Instant state changes
- Borders only for separation
- `border-radius: var(--border-radius)`
- `font-family: var(--font-mono)` everywhere
- Solid background colors
- Static appearance
- Spacing from `--space-*` variables

---

## File Organization

```
src/
├── index.css                      # Global styles + CSS custom properties
├── App.css                        # App-level layout
├── components/
│   ├── layout/
│   │   ├── Layout.css            # Main layout grid + hero
│   │   ├── Navbar.css            # Top bar (2em fixed height)
│   │   ├── Hero.tsx              # Collapsible visualizer section
│   │   └── Footer.tsx            # Bottom bar (1.8em fixed height)
│   └── panels/
│       ├── FormControls.css      # Shared form component styles
│       ├── SettingsPanel.tsx     # Collapsible settings sections
│       ├── SettingsPanel.css     # Section container styles
│       ├── ServerSettings.tsx    # Server URL + health check
│       ├── ASRSettings.tsx       # Language + prompt settings
│       ├── AudioSettings.tsx     # Audio capture controls
│       ├── VADSettings.tsx       # VAD parameters
│       └── TranscriptPanel.tsx   # Footer transcript display
```

---

## Quick Reference

### Adding a new input field
```tsx
<input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="form-input form-input-flex"
/>
```

### Adding a toggle button
```tsx
<button
  onClick={toggle}
  className={`form-button form-button-toggle ${isActive ? 'active' : ''}`}
>
  Feature: {isActive ? 'ON' : 'OFF'}
</button>
```

### Adding a collapsible section
1. Add to `sectionState` initial value: `mySection: false`
2. Add to `partialize` in Store.ts
3. Use Section component pattern in SettingsPanel.tsx

### Adding status indicator
```tsx
<span className={
  status === 'ok' ? 'form-status-ok' :
  status === 'error' ? 'form-status-error' :
  'form-status-unknown'
}>
  {status}
</span>
```

---

## Verification Checklist

Before committing changes:

- [ ] No inline `style` objects for spacing/layout
- [ ] All colors use CSS custom properties
- [ ] All spacing uses `--space-*` variables
- [ ] No `transition` or `animation` properties
- [ ] No `border-radius` values > 2px
- [ ] Input heights use `var(--input-height)`
- [ ] Font sizes use `var(--font-size-*)` or relative units
- [ ] `bun run build` passes TypeScript check
- [ ] Visual rhythm maintained (1.4em baseline)
- [ ] Collapsible sections persist state
- [ ] No console errors in browser

---

**Last Updated**: Implementation of IBM Corporate Terminal design system (2026-04-17)
