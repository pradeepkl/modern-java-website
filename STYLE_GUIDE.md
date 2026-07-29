# Modern Java Website — Style Guide

Documentation for recreating the **Modern Java: The Mindset Shift** landing page visual system. Source of truth: `src/styles/tokens.css`, layout/typography globals, and section component CSS.

---

## 1. Website metadata (summary)

| Item | Value |
|------|--------|
| **Layout** | Single-page fixed-width shell: **1240px** max (`--page-max-width`). Page sits centered on a soft gray canvas (`#e9edf4`); shell is white with a light frame shadow. |
| **Content width** | **1200px** (`--content-max-width` / `--section-container-max-width`). Inner horizontal padding: **48px** desktop → **24px** ≤800px → **16px** ≤560px (header/sample). |
| **Mobile / responsive** | Yes. Breakpoints used: **1100px**, **980–960px**, **900–860px**, **820–800px**, **640–560px**, **480–400px**. Desktop nav hides ≤800px; hamburger + slide-down mobile menu. Touch targets ≥44px. |
| **Menu links** | **4** — About, Inside the Book, Formats, Author. Font: **Inter** (body), 0.95rem / weight 500; muted `#5e6878`, active/hover `#0b3f9f`. |
| **Fonts** | Display / headings: **Space Grotesk**. Body / UI / nav: **Inter**. Weights loaded: 400, 500, 600, 700. |
| **Hero** | See §4. |
| **Sections** | **8** always on landing (+ optional Paperback Waitlist = **9**). Alternating soft / white / navy bands. See §5. |

---

## 2. Brand & visual direction

- **Product:** Technical book for experienced Java developers.
- **Palette idea:** Charcoal ink, paper white, technical cobalt / ink blue (book-cover inspired).
- **Not:** Purple gradients, cream+serif editorial, broadsheet newspaper layouts, glow-heavy dark UI.
- **Atmosphere:** White shell on cool gray page; soft blue-tinted surfaces; navy gradient bands for CTAs/trust; circuit watermark art in hero at low opacity.

---

## 3. Design tokens

### 3.1 Color

```css
/* Navy / blue */
--color-navy-950: #17191d;
--color-navy-900: #082f80;
--color-navy-850: #0a3a94;
--color-blue-800: #073486;
--color-blue-700: #0b3f9f;   /* primary buttons, links, active nav */
--color-blue-600: #1556c0;   /* eyebrows, accents */
--color-blue-500: #2874d8;
--color-blue-200: #b9cbee;
--color-blue-100: #e6efff;
--color-blue-050: #f3f7ff;

/* Text */
--color-ink: #17191d;
--color-text: #252a33;
--color-muted: #5e6878;
--color-muted-light: #747e8f;
--color-section-heading: #0b3f9f;

/* Surfaces */
--color-white / --color-surface: #ffffff;
--color-surface-soft: #f4f7fc;
--color-card-bg: #f8faff;
--color-card-text: #2d3440;

/* Borders */
--color-border: #d7e0ef;
--color-border-strong: #aebfdd;

/* Amazon CTA */
--color-amazon-yellow: #ffd814;
--color-amazon-yellow-hover: #f7ca00;
--color-amazon-yellow-border: #fcd200;
--color-amazon-ink: #0f1111;
```

**Page chrome**

| Role | Color |
|------|--------|
| Body (outside shell) | `#e9edf4` (full white ≤480px) |
| Site shell | `#ffffff` |
| Theme color (meta) | `#04183f` |

### 3.2 Typography

| Role | Font stack | Typical use |
|------|------------|-------------|
| `--font-display` | `'Space Grotesk', 'Inter', sans-serif` | Hero H1 |
| `--font-heading` / `--font-section` | `'Space Grotesk', 'Inter', sans-serif` | Section titles, H2/H3 |
| `--font-body` | `'Inter', 'Segoe UI', sans-serif` | Body, nav, buttons, eyebrows often use body |

**Base body:** Inter, `1rem`, line-height `1.55`, color `#252a33`.

**Google Fonts import:**

```
Inter:wght@400;500;600;700
Space+Grotesk:wght@400;500;600;700
```

### 3.3 Spacing scale

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96` px (`--space-1` … `--space-24`).

**Section vertical rhythm (desktop):** typically `padding: 72px 0 80px`; mobile ≤560px often `48px 0 64px`.

### 3.4 Radii, shadows, motion

| Token | Value |
|-------|--------|
| `--radius-sm` | 5px (buttons, inputs) |
| `--radius-md` | 9px |
| `--radius-lg` | 14px |
| `--radius-card` | 11px |
| Card / feature radius (common) | 12–14px; sample card 18px |
| `--shadow-book` | `0 30px 50px rgba(4, 25, 70, 0.22)` |
| `--shadow-card` | `0 8px 22px rgba(11, 38, 91, 0.06)` |
| `--transition-fast` | 150ms ease |
| `--transition-normal` | 220ms ease |
| `--header-height` | 104px |
| `--scroll-margin` | header + 12px |

### 3.5 Layout widths

| Token | Value |
|-------|--------|
| `--page-max-width` | **1240px** (fixed shell) |
| `--content-max-width` | 1200px |
| `--section-container-max-width` | 1200px |
| `--editorial-max-width` | 760px |
| `--reading-max-width` | 720px |

Shell classes: `.site-shell`, `.page-container` (48px inline pad), `.section-inner` / `.section-container`.

---

## 4. Header & navigation

### Header

- Sticky, white, `min-height: 104px`, bottom border `#d7e0ef`.
- Scrolled: soft shadow `0 4px 18px rgba(11, 38, 91, 0.08)`.
- Logo: clamp **240–300px** wide (mobile clamp **210–280px**).
- Grid: logo | nav | (menu button on mobile).

### Menu links (4)

1. About → `#why-this-book`
2. Inside the Book → `#inside-the-book`
3. Formats → `#formats`
4. Author → `#author`

| Property | Value |
|----------|--------|
| Font | Inter |
| Size | 0.95rem |
| Weight | 500 |
| Color | `#5e6878` |
| Hover / active | `#0b3f9f` |

Mobile (≤800px): hamburger (22×2px bars), overlay menu Inter 1rem / 500.

---

## 5. Hero section

| Element | Font | Size | Weight | Color | Notes |
|---------|------|------|--------|-------|-------|
| Background | — | — | — | `#ffffff` | Circuit watermarks ~8–10% opacity |
| Eyebrow | Inter | 0.82rem (0.68rem ≤560px) | 700 | `#1556c0` | Uppercase, letter-spacing 0.16em |
| Title (H1) | Space Grotesk | clamp **3.6–5.4rem** (down to ~2.6–3.6rem mobile) | 700 | `#17191d` | Accent span `#0b3f9f`; tracking -0.05em; LH 1.02 |
| Lead | Inter | clamp 1.1–1.25rem | 400 | `#5e6878` | LH 1.6 |
| Secondary line | Inter | 1.02rem | ~650 | `#252a33` | LH 1.5 |
| CTA | Inter | 0.98rem | 700 | White on `#0b3f9f` | Min-height 54px; radius 8px; large primary button |
| Meta | Inter | 0.83rem | 400 | `#747e8f` | Under CTA |
| Product context | Inter | 0.82rem | 400 | `#747e8f` | Under book image |
| Book image | — | max ~620px / 78vh | — | — | 3D cover, object-fit contain |

**Layout:** 2-column grid (~0.82fr / 1.18fr), gap clamp 36–56px, padding-block 48px / 44px. Stacks to 1 column ≤820px (copy then image).

**Copy pattern:** Brand/product strength via cover visual + “Write Java *with intent.*” — one headline, one lead, one secondary, one CTA, format meta.

---

## 6. Sections inventory

Default landing order (from `App.tsx`). **Paperback Waitlist** renders only when `VITE_PAPERBACK_WAITLIST_ENABLED=true` and sales is off.

| # | Section | ID / role | Background | Heading font / size / color | Body |
|---|---------|-----------|------------|-----------------------------|------|
| 1 | **Hero** | `#top` | `#ffffff` | Space Grotesk clamp 3.6–5.4rem / `#17191d` (+ blue accent) | Inter muted / text |
| 2 | **Purpose** | `#why-this-book` | `#f4f7fc` | Space Grotesk clamp 2–3rem / `#082f80` | Inter 1rem `#5e6878`; point titles 1.04rem / 700 |
| 3 | **Guide** | about the guide | `#ffffff` | Space Grotesk clamp 1.75–2.25rem / `#082f80` | Inter 1rem muted; features in white cards |
| 4 | **Inside the Book** | `#inside-the-book` | `#f4f7fc` | Space Grotesk clamp 1.85–2.35rem / `#082f80` | TOC/preview cards white; preview title `#0b2f72` |
| 5 | **Sample Chapter** | sample / email | `#ffffff` shell; **card** navy gradient | Space Grotesk clamp 2–3rem / `#ffffff` | Light text on dark; form glass panel |
| 6 | **Author** | `#author` | `#f4f7fc` + top border | Space Grotesk clamp 2–3.1rem / `#082f80` | Intro 1.1rem / 600 text; bio 1rem muted |
| 7 | **Trust** | trust points | Navy gradient `#17191d` → `#0b2f70` + blue radial | Space Grotesk clamp 2–3.15rem / `#ffffff` | Copy rgba white 0.72; points white / 600 |
| 8 | **Formats** | `#formats` | `#ffffff` (or `#f4f7fc` if waitlist on) | Space Grotesk clamp 1.85–2.35rem / `#082f80` | Cards white, 14px radius |
| 9* | **Paperback Waitlist** | `#paperback-waitlist` | `#ffffff` + soft blue radial | Space Grotesk clamp 1.55–2rem / `#082f80` | Lead 1.05rem / 600 navy; body muted |
| — | **Footer** | site footer | Top `#f4f7fc`; bottom bar `#ffffff` | Inter 0.95rem / 700 navy for “Links” | Links 0.92rem muted |

\*Optional / feature-flagged.

### Shared section patterns

**Eyebrow (most light sections)**

- Font: Inter, **0.78rem**, weight **700**, uppercase, letter-spacing **0.12em**
- Color: `#1556c0` (on dark bands: `#9fc3ff` / `#a9c9ff`)
- Optional SVG mask line ornaments via `.section-eyebrow`

**Ornamented section headings** (shared component variants)

- Default: Space Grotesk, clamp 1.25–1.65rem, uppercase, tracking 0.08em, `#0b3f9f`, line+dot ornaments
- Editorial / landing variants: see `shared.css` (`.section-heading--editorial`, `--landing`)

---

## 7. Component systems

### Buttons

| Class | Background | Text | Border |
|-------|------------|------|--------|
| `.button-primary` | `#0b3f9f` | white | same |
| `.button-primary:hover` | `#073486` | white | same |
| `.button-secondary` | white | `#0b3f9f` | `#0b3f9f` |
| `.button-amazon` | `#ffd814` | `#0f1111` | `#fcd200` |

- Min-height **44px** (large **56px**); padding ~0.7rem 1.35rem; radius **5px**; Inter **0.95rem** / **600**.
- Focus: `outline: 3px solid rgba(20, 91, 199, 0.35)`.

### Cards (formats, TOC, features)

- White surface, border `#d7e0ef`, radius **12–14px**, light blue-tinted shadow.
- Format card headline: Space Grotesk **1.35rem** / 700 / `#082f80`.

### Sample chapter CTA card

```
background:
  radial-gradient(circle at 8% 15%, rgba(90, 151, 238, 0.3), transparent 32%),
  linear-gradient(135deg, #17191d, #073486);
border-radius: 18px;
```

Form panel: `rgba(255,255,255,0.1)` + white border 18% opacity. Submit uses Amazon yellow.

### Trust band

```
background:
  radial-gradient(circle at 12% 20%, rgba(40, 116, 216, 0.22), transparent 30%),
  linear-gradient(135deg, #17191d, #0b2f70);
```

---

## 8. Responsive behavior (checklist)

| Breakpoint | Behavior |
|------------|----------|
| ≤1100px | Hero / formats / guide grids tighten |
| ≤900–860px | Two-column sections stack; sticky intros become static |
| ≤820–800px | Hero stacks; desktop nav → hamburger; page pad 24px |
| ≤640–560px | Section padding shrinks; full-width CTAs; tighter type |
| ≤480px | Shell shadow off; body bg matches white shell |
| ≤400px | Sample card tighter padding |

---

## 9. Recreate checklist

1. Load **Inter** + **Space Grotesk** (400–700).
2. Apply CSS variables from §3 into `:root`.
3. Build **1240px** white `.site-shell` centered on `#e9edf4`.
4. Sticky **104px** header + **4** Inter nav links.
5. Hero: white, 2-col, Space Grotesk display title with blue accent phrase, primary CTA, book cover.
6. Alternate section backgrounds: soft → white → soft → white → soft → navy → white (footer soft/white).
7. Eyebrows: 0.78rem / 700 / uppercase / `#1556c0`.
8. Section titles: Space Grotesk ~clamp 1.85–3rem / `#082f80` on light; white on navy.
9. Body: Inter 1rem / `#5e6878` or `#252a33`.
10. Primary actions: `#0b3f9f`; Amazon actions: `#ffd814`.
11. Make all major grids single-column under ~860–900px; hide desktop nav ≤800px.

---

## 10. File map (implementation)

| Concern | Path |
|---------|------|
| Tokens | `src/styles/tokens.css` |
| Layout shell | `src/styles/layout.css` |
| Typography base | `src/styles/typography.css` |
| Buttons / links | `src/styles/globals.css` |
| Shared headings | `src/components/shared/shared.css` |
| Nav data | `src/data/navigation.ts` |
| Page composition | `src/App.tsx` |
| Fonts / SEO | `index.html` |

---

*Generated from the living codebase. Prefer tokens and component CSS over this doc if they diverge.*
