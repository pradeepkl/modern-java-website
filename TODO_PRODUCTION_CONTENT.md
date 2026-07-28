# Production Content Checklist

Track remaining production polish before / after marketing launch.

## URLs and Contact

| Item | Current Value | File | Status |
|------|--------------|------|--------|
| Amazon purchase URL | `https://www.amazon.in/dp/B0H6R4334W` | `src/data/book.ts` | ✅ |
| LinkedIn URL | `https://www.linkedin.com/in/lpradeepk` | `src/data/book.ts` | ✅ |
| Email address | `admin@classpath.in` | `src/data/book.ts` | ✅ |
| Canonical / production URL | `https://modern-java.classpath.in/` | `index.html` | ✅ |

## SEO

| Item | Path | Status |
|------|------|--------|
| `robots.txt` | `public/robots.txt` | ✅ |
| `sitemap.xml` | `public/sitemap.xml` | ✅ |
| Open Graph image (1200×630) | `public/assets/social/og-preview.jpg` | ✅ |
| Absolute OG / Twitter / JSON-LD URLs | `index.html` | ✅ |

## Image Assets

All asset paths are centralized in `src/data/assets.ts`.

| Asset | Path | Status |
|-------|------|--------|
| Horizontal logo | `public/assets/brand/modern-java-logo-horizontal.svg` | ✅ SVG |
| Book cover (3D) | `public/assets/hero/modern-java-3D.webp` | ✅ Added |
| Author portrait | `public/assets/author/pradeep_author.webp` | ⚠️ Replace with final production portrait |
| Device montage | `public/assets/formats/formats.webp` | ✅ Added |
| Open Graph image | `public/assets/social/og-preview.jpg` | ✅ |

## Analytics (required before paid ads)

Set in `.env.local`, then `npm run deploy` (script loads and bakes these at build time):

| Variable | Purpose | Status |
|----------|---------|--------|
| `VITE_GA_MEASUREMENT_ID` | GA4 measurement ID | ⚠️ Still empty — create property and set |
| `VITE_CLARITY_ID` | Microsoft Clarity (optional) | Optional |
| `VITE_META_PIXEL_ID` | Meta Pixel (`1844493498903023`) | Set in `.env.prod` before prod deploy |

See `docs/ANALYTICS.md`. Mark `sample_form_success`, `purchase`, and `amazon_exit` as GA4 key events after IDs ship.

## Optional

- ISBN (do not add to site until confirmed)
- Final high-resolution author portrait
- Paid digital PDF/ePub upload to S3 (`backend/npm run upload:assets`)

## Chapter preview

| Asset | Path | Status |
|-------|------|--------|
| Preview PDF (repo source) | `assets/books/modern-java-preview.pdf` | ✅ Added |
| S3 object key | `sample/modern-java-preview.pdf` | ✅ Upload via `backend/npm run upload:assets` |

## Noscript Fallback

Purchase URLs and contact email in `index.html` `<noscript>` are aligned with production.
