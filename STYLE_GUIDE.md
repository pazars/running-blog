# Style guide

The visual reference for the site. Tokens are CSS custom properties in
`src/styles/global.css`; use them instead of hard-coded values.

The look is minimal and typographic: system fonts, lots of whitespace, a navy and
white palette with one blue accent (`#283cff`), and faint borders and shadows.
Hierarchy comes from size, weight and muted color, not from decoration.

## Color

Green (`--color-bg-success`) is only for the pulsing "currently working" dot.

### Light mode

| Token                    | Value                       | Usage                              |
|--------------------------|-----------------------------|-------------------------------------|
| `--color-fg-default`     | `#090e24` (dark navy)       | Primary text, headings              |
| `--color-fg-muted`       | `#757676` (warm gray)       | Secondary text, descriptions, icons |
| `--color-fg-emphasis`    | `#283cff` (saturated blue)  | Links with emphasis, accent color   |
| `--color-fg-inverse`     | `#ffffff`                   | Text on dark backgrounds            |
| `--color-bg-default`     | `#ffffff`                   | Page background                     |
| `--color-bg-subtle`      | `#f6f7f9` (cool off-white)  | Cards, list items, hover states     |
| `--color-bg-emphasis`    | `rgb(241, 242, 246)`        | Stronger hover, active nav          |
| `--color-bg-success`     | `#1dab62` (green)           | Pulsing "currently working" dot     |
| `--color-border-default` | `#e7eaf1`                   | Card borders, dividers              |
| `--color-border-subtle`  | `rgba(0, 0, 0, 0.075)`     | Very faint borders                  |
| `--color-line-default`   | `#e6e7e7`                   | Link underlines (default)           |
| `--color-line-emphasis`  | `#757676`                   | Link underlines (hover)             |

### Dark mode

| Token                    | Value                       |
|--------------------------|-----------------------------|
| `--color-fg-default`     | `#e2e8f0` (soft light gray) |
| `--color-bg-default`     | `#121212` (near-black)      |
| `--color-bg-subtle`      | `#1c1c1c`                   |
| `--color-bg-emphasis`    | `#1f1f22`                   |
| `--color-bg-inverse`     | `#303036`                   |
| `--color-border-default` | `rgba(255, 255, 255, 0.141)`|
| `--color-border-subtle`  | `rgba(255, 255, 255, 0.086)`|
| `--color-line-default`   | `rgba(255, 255, 255, 0.204)`|

Images get `filter: brightness(0.9) contrast(1.2)` in dark mode.

Dark mode follows `prefers-color-scheme`, and the theme toggle overrides it with a
`.light` or `.dark` class on `<html>`, saved in `localStorage`.

## Typography

System font stack, no web fonts. All text is antialiased.

```
--system-ui: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"
```

| Element        | Mobile   | Desktop  | Weight | Letter-spacing | Line-height |
|----------------|----------|----------|--------|----------------|-------------|
| h1             | 24px     | 28px     | 600    | -0.03em        | 1.25        |
| h2             | 20px     | 24px     | 600    | -0.03em        | 1.25        |
| h3             | 18px     | 20px     | 400*   | -              | -           |
| Body           | 14px     | 16px     | 400    | -              | 1.6         |
| Body large     | -        | 18px     | -      | -              | -           |
| Extra large    | 22px     | 24px     | -      | -              | 1.3–1.4     |
| Small          | 14px     | 14px     | -      | -              | -           |
| Extra small    | 12px     | 12px     | -      | -              | -           |

*h3 becomes `font-weight: 600` when followed by a description element.

### Weight tokens

| Token                   | Value |
|-------------------------|-------|
| `--font-weight-light`   | 300   |
| `--font-weight-default` | 400   |
| `--font-weight-medium`  | 500   |
| `--font-weight-semibold`| 600   |

- Section headers ("Recent ships") are small, medium weight and muted.
- Blockquotes use the extra-large size with no border or background.

## Spacing

4px base unit. Grid row gap 32px, column gap 16px. The content column maxes out
at `64em` from 768px and `60em` from 1012px.

| Level | Value | Usage example               |
|-------|-------|-----------------------------|
| 1     | 4px   | Tight gaps, icon margins    |
| 2     | 8px   | List item gaps, small pads  |
| 3     | 12px  | Component internal padding  |
| 4     | 16px  | Card padding, grid col gap  |
| 5     | 20px  | Body padding (mobile)       |
| 6     | 24–32px | Section margin-bottom     |
| 7     | 40px  | Major section spacing       |
| 8     | 60px  | Body padding (tablet)       |
| 9     | 80px  | Body padding (desktop), hero section top padding |
| 10    | 120px | Footer top margin           |

## Borders, radius, shadows

| Token                | Value | Usage                         |
|----------------------|-------|-------------------------------|
| `--border-rounded`   | 12px  | Cards, list items, images     |
| `--border-rounded-sm`| 4px   | Small UI elements             |
| `--border-rounded-lg`| 20px  | Avatar container, nav pills   |
| `--border-radius`    | 6px   | Buttons, dropdown items       |
| `--border-width`     | 1.5px | Dividers, top borders         |

Borders are faint: `rgba(0, 0, 0, 0.075)` light, `rgba(255, 255, 255, 0.086)` dark.

- Cards and dropdowns: `0 4px 8px #424a5308`
- General and active nav pill: `0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)`
- Avatar ring: `0 0 0 1px rgba(31, 35, 40, 0.15)`

## Components

- **Header:** 40px round avatar, name and role on the left; nav pills, email
  dropdown and theme toggle on the right. Below 544px the nav becomes a hamburger menu.
- **Cards:** image (12px radius) above a semibold title and a 14px muted line. The
  image wrapper scales to 0.98 on hover. External links get a muted 14px ↗ icon.
- **Grid:** CSS grid areas. The first two items span full width and the rest form
  columns; `-equal` gives an even 2-column grid; 3 columns from 544px.
- **List items:** full-width rows on `--color-bg-subtle`, 12px radius, 16px
  padding, 8px apart. Linked rows shift to `--color-bg-emphasis` on hover.
- **Buttons:** icon buttons are transparent circles (40px mobile, 32px desktop).
  Pressing scales them to 0.95.
- **Tooltips:** inverse background, 12px text, 8px radius, fade in. 544px and up only.
- **Dropdowns:** 12px radius, faint border and shadow, 6px-radius items.
- **Footer:** 120px top margin; copyright left, links and socials right.

## Links

Links inherit the text color and have a light underline
(`--color-line-default`, offset `0.25em`) that darkens to `--color-line-emphasis`
on hover. Nav and card links have no underline and use a background change instead.

## Icons

Inline [Lucide](https://lucide.dev) SVGs: 16x16 viewBox, `stroke-width: 2`, round
caps and joins, `currentColor`.

## Motion

| Interaction          | Effect                                      | Duration/Easing                          |
|----------------------|----------------------------------------------|------------------------------------------|
| Button press         | `scale(0.95)`                                | `0.2s cubic-bezier(0.55, 0.085, 0.68, 0.53)` |
| Card image hover     | Wrapper `scale(0.98)`                        | `0.2s`                                   |
| List item hover      | Background color shift                       | Instant (CSS transition)                 |
| Nav link hover       | Subtle background color                      | Instant                                  |
| Tooltip appear       | `opacity: 0 → 1`                             | `0.2s ease-in-out`                       |
| Mobile nav open      | Slide from right + staggered link fade-in    | `0.3s cubic-bezier(0.33, 1.6, 0.66, 1)` |
| Pulsing dot          | Scale 0.9→1 + expanding shadow ring          | `3s infinite`                            |
| Link underline hover | Underline color darkens                      | Instant                                  |

## Breakpoints

Mobile first. Larger screens add space, not features.

| Breakpoint | Width   | Key changes                                           |
|------------|---------|-------------------------------------------------------|
| Base       | < 544px | Single column, hamburger nav, smaller text, 20px pad  |
| Small      | 544px   | Nav becomes horizontal pills, 3-col grid available    |
| Medium     | 768px   | Body text 16px, body padding 60px, max-width 64em     |
| Large      | 1012px  | Max-width 60em, body padding 80px, section header anchor icons visible |
