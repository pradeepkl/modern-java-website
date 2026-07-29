# Modern Java — Brand Guide

**Product:** *Modern Java: The Mindset Shift*  
**Author:** Pradeep Kumar L  
**Use this file for:** Instagram posts, Facebook covers, LinkedIn creatives, ads, book front/back covers, and any off-site collateral that must match the website and book.

Source of truth for the live site: `src/styles/tokens.css`, Google Fonts in `index.html`, and the book cover art in `public/assets/hero/`.

---

## 1. Brand essence

| Attribute | Direction |
|-----------|-----------|
| **Personality** | Precise, architectural, intent-driven — not playful or flashy |
| **Audience** | Experienced Java developers and technical leads |
| **Look** | Charcoal ink + paper white + technical cobalt; circuit / schematic motifs at low opacity |
| **Avoid** | Purple gradients, cream + serif editorial looks, neon glow, emoji clutter, soft “startup pastel” palettes |

**One-line theme:** Clean technical professionalism — whitespace, geometric precision, and strong navy–cobalt contrast.

---

## 2. Fonts (use these names exactly)

| Role | Font name | Weights | Where to use |
|------|-----------|---------|--------------|
| **Display / titles** | **Space Grotesk** | 400, 500, 600, **700** | Hero headlines, section titles, ad headlines, cover title hierarchy |
| **Body / UI** | **Inter** | 400, 500, **600**, **700** | Body copy, captions, CTAs, nav, eyebrows, metadata |

**Google Fonts URL:**

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap
```

**Stacks (if a tool needs fallbacks):**

- Display: `'Space Grotesk', 'Inter', sans-serif`
- Body: `'Inter', 'Segoe UI', sans-serif`

**Cover / print note:** The physical book cover uses bold geometric sans (all-caps title). For digital creatives that must match the *website*, prefer **Space Grotesk** for titles and **Inter** for body. For print covers matching existing art, keep the cover’s established bold sans hierarchy (MODERN in black, JAVA in navy).

---

## 3. Typography system

### Hierarchy (web-aligned)

| Level | Font | Size guidance | Weight | Color | Notes |
|-------|------|---------------|--------|-------|-------|
| **Hero / campaign H1** | Space Grotesk | Large, tight | 700 | `#17191d` | Letter-spacing ≈ −0.05em; accent phrase in `#0b3f9f` |
| **Section / ad headline** | Space Grotesk | Medium–large | 700 | `#082f80` (light bg) or `#ffffff` (navy bg) | |
| **Eyebrow / label** | Inter | ~11–13px | 700 | `#1556c0` | UPPERCASE, letter-spacing ~0.12–0.16em |
| **Body** | Inter | 15–18px | 400 | `#252a33` or `#5e6878` | Line-height ~1.5–1.6 |
| **CTA** | Inter | ~15–16px | 600–700 | White on `#0b3f9f` | |
| **Meta / caption** | Inter | ~12–13px | 400 | `#747e8f` | |

### Book-cover typography (front)

| Element | Treatment | Color |
|---------|-----------|-------|
| **MODERN** | Heavy, all-caps | `#17191d` (charcoal / black) |
| **JAVA** | Extra-bold, larger, all-caps | Primary navy / cobalt (`#0b3f9f`–`#082f80`) |
| **THE MINDSET SHIFT** | Bold, all-caps, letterspaced, ruled with end dots | Navy |
| **Tagline** | Sentence case, regular | Charcoal |
| **Author** | All-caps, tracked | Charcoal |
| **Footer bar labels** | Small all-caps | White on navy bar |

### Accent pattern for ads

Highlight the *outcome* half of a from→to line in cobalt (same idea as the OG image):

> From Implementation-Oriented Code → **to Intent-Oriented Design** (`#2874d8` or `#0b3f9f` on dark)

---

## 4. Full website color palette

### Core brand blues & ink

| Token / role | Hex | Use |
|--------------|-----|-----|
| Ink / charcoal | `#17191d` | Primary text, dark bands, cover “MODERN”, back-cover field |
| Deep navy (headings) | `#082f80` | Section titles, strong brand navy |
| Navy mid | `#0a3a94` | Intermediate navy |
| Blue 800 | `#073486` | Button hover / deep gradient stop |
| **Primary brand blue** | `#0b3f9f` | CTAs, links, active nav, accent spans, “JAVA” |
| Accent / eyebrow blue | `#1556c0` | Eyebrows, secondary accents |
| Signal / highlight blue | `#2874d8` | Soft highlights, circuit glow on dark creatives |
| Blue 200 | `#b9cbee` | Soft strokes, muted icons |
| Blue 100 | `#e6efff` | Light tint fills |
| Blue 050 | `#f3f7ff` | Softest blue wash |

### Text

| Role | Hex |
|------|-----|
| Ink | `#17191d` |
| Body text | `#252a33` |
| Muted | `#5e6878` |
| Muted light | `#747e8f` |
| Section heading (token) | `#0b3f9f` |
| Card text | `#2d3440` |

### Surfaces & backgrounds

| Role | Hex | Use |
|------|-----|-----|
| White / surface | `#ffffff` | Site shell, hero, front-cover field, light ads |
| Soft surface | `#f4f7fc` | Alternating section bands, light creative bg |
| Card bg | `#f8faff` | Card fills |
| Page chrome (outside shell) | `#e9edf4` | Cool gray canvas behind white content |
| Theme / browser chrome | `#04183f` | Deep navy meta theme-color |
| Soft border | `#d7e0ef` | Dividers, card edges |
| Strong border | `#aebfdd` | Emphasized borders |

### Dark / CTA bands (gradients)

```
linear-gradient(135deg, #17191d, #0b2f70)
linear-gradient(135deg, #17191d, #073486)
```

Optional radial wash: `rgba(40, 116, 216, 0.22)` or `rgba(90, 151, 238, 0.3)` at ~8–15% of the frame.

### Commerce-only (Amazon CTA — do not use as brand accent)

| Role | Hex |
|------|-----|
| Amazon yellow | `#ffd814` |
| Amazon yellow hover | `#f7ca00` |
| Amazon yellow border | `#fcd200` |
| Amazon ink | `#0f1111` |

---

## 5. Suggested 5-color creative palette

Use this reduced set for Instagram, Facebook covers, ads, and book front/back covers so assets stay consistent without the full token list.

| # | Name | Hex | Role |
|---|------|-----|------|
| 1 | **Ink Charcoal** | `#17191d` | Dark backgrounds, primary text on light, back cover, spine base |
| 2 | **Brand Cobalt** | `#0b3f9f` | Primary brand, CTAs, “JAVA”, accent words, links |
| 3 | **Deep Navy** | `#082f80` | Secondary brand, titles on light, footer bar, spine accent |
| 4 | **Paper White** | `#ffffff` | Front-cover field, light creatives, reverse text on navy |
| 5 | **Signal Blue** | `#2874d8` | Highlights, circuit lines, “intent” accent on dark ads |

**Supporting (optional sixth for light layouts):** Soft Mist `#f4f7fc` — light post backgrounds and card areas without competing with Paper White.

### Palette usage map

| Surface | Background | Primary type | Accent |
|---------|------------|--------------|--------|
| **Light ad / IG feed** | `#ffffff` or `#f4f7fc` | `#17191d` | `#0b3f9f` |
| **Dark ad / story / FB cover** | `#17191d` → `#082f80` | `#ffffff` | `#2874d8` |
| **Book front cover** | `#ffffff` | `#17191d` + `#0b3f9f` | Navy footer bar `#082f80` / `#0b3f9f` |
| **Book back cover** | `#17191d` or soft `#f4f7fc` with navy header | White or charcoal | Cobalt for ISBN block / URL |
| **Spine** | `#0b3f9f` or `#082f80` | White title | Light blue subtitle |

---

## 6. Theme & visual motifs

- **Circuit / schematic art:** Thin cobalt lines, nodes, concentric “target” circles, dot grids — opacity **8–15%** on light; slightly stronger on dark social art.
- **Ornaments:** Thin rules with end dots (as in “THE MINDSET SHIFT” and section eyebrows).
- **Imagery:** Prefer the real 3D book mockup (`modern-java-3D.webp`) over abstract stock.
- **Corners:** Soft, not pill-shaped — creative radius ~8–14px if needed; covers stay mostly square/rectilinear.
- **Shadows (optional):** Book drop shadow `0 30px 50px rgba(4, 25, 70, 0.22)`.

---

## 7. Creative templates (quick specs)

### Instagram feed (1080 × 1080)

- Background: Paper White or Soft Mist; or full Ink Charcoal for launch posts.
- Brand name / book title: Space Grotesk 700.
- One headline + one short line + book cover visual (full or 3D).
- Accent one phrase in Brand Cobalt; keep CTA in cobalt pill/button if needed.

### Instagram story / Reel cover (1080 × 1920)

- Dark navy gradient background + faint circuit watermark.
- Title in white; subtitle letterspaced in Signal Blue or white.
- Book cover centered in upper/mid third; leave safe margins for UI chrome.

### Facebook / LinkedIn cover (~1200 × 630)

- Match existing OG treatment: dark navy field, 3D book left, copy right.
- Title white; accent the “intent” half of the tagline in Signal Blue.
- Do not overload with stats or multiple CTAs.

### Book front cover

- White field; **MODERN** charcoal + **JAVA** cobalt; subtitle navy with rules.
- Lower schematic illustration in light blue-gray strokes.
- Solid navy footer bar with white topic icons/labels (Records, Pattern Matching, Streams, Structured Concurrency).

### Book back cover

- Prefer **Ink Charcoal** full bleed *or* Soft Mist with a navy top/bottom bar for contrast with the white front.
- Blurb in Inter (or matching print sans), white or charcoal depending on field.
- Author bio, barcode, site URL in muted hierarchy; URL/CTA in Brand Cobalt.
- Keep circuit motif subtle; do not repeat the full front illustration at full strength.

---

## 8. Do / Don’t

**Do**

- Lead with the book title / brand, not a generic “developer tips” headline.
- Use Space Grotesk + Inter as the digital pair.
- Stay in charcoal–navy–cobalt–white.
- Use Amazon yellow only on Amazon buy buttons.

**Don’t**

- Introduce purple, teal, orange, or cream as brand colors.
- Place floating badges/stickers over the cover art.
- Use Inter/Roboto as the only display face when Space Grotesk is available for web/social.
- Fill the first frame with stats, schedules, or multiple competing blocks.

---

## 9. Asset references

| Asset | Path |
|-------|------|
| 3D cover (hero) | `public/assets/hero/modern-java-3D.webp` |
| Paperback 3D | `public/assets/hero/paperback-3D.webp` |
| OG / social preview | `public/assets/social/og-preview.jpg` |
| Logo mark | `public/assets/brand/modern-java-mark.svg` |
| Horizontal logo | `public/assets/brand/modern-java-logo-horizontal.svg` |
| Circuit decorations | `public/assets/hero/hero-circuit-*.svg` |

**Live site:** https://modern-java.classpath.in/

---

*Aligned with website tokens and cover art. If code and this guide diverge, prefer `src/styles/tokens.css` and the printed cover.*
