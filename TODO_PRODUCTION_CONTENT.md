# Production Content Checklist

Replace the following placeholders before deploying to production.

## URLs and Contact

| Item | Current Value | File |
|------|--------------|------|
| Amazon purchase URL | `https://www.amazon.in/Modern-Java-Mindset-Pradeep-Kumar-ebook` | `src/data/book.ts` |
| LinkedIn URL | `https://www.linkedin.com/in/lpradeepk` | `src/data/book.ts` |
| Email address | `admin@classpath.in` | `src/data/book.ts` |
| Canonical / production URL | `REPLACE_WITH_PRODUCTION_URL` | `index.html` |

## Image Assets

All asset paths are centralized in `src/data/assets.ts`.

| Asset | Path | Status |
|-------|------|--------|
| Horizontal logo | `public/assets/brand/modern-java-logo-horizontal.svg` | ✅ SVG |
| Book cover (3D) | `public/assets/hero/modern-java-3D.png` | ✅ Added |
| Author portrait | `public/assets/author/pradeep-kumar.png` | ⚠️ Mockup extract — replace with production PNG |
| Device montage | `public/assets/formats/available.png` | ✅ Added |
| Open Graph image | `public/assets/social/og-preview.svg` | ⚠️ SVG — add PNG fallback for social platforms |

## Optional

- ISBN (do not add to site until confirmed)
- Final high-resolution paperback PNG
- Final high-resolution author portrait
- Final high-resolution device montage
- Final Open Graph PNG (1200×630)
- Google Analytics or other tracking (not included by default)

## Noscript Fallback

Update purchase URLs and email in `index.html` `<noscript>` block when production values are confirmed.
