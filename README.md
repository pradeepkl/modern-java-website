# Modern Java: The Mindset Shift — Book Launch Website

A responsive single-page landing site for **Modern Java: The Mindset Shift** by Pradeep Kumar L.

Built with React, Vite, and TypeScript. Designed for static hosting on AWS Amplify, S3 + CloudFront, Netlify, Cloudflare Pages, Vercel, or GitHub Pages.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to preview locally.

## Build & Quality Checks

```bash
npm run lint
npm run build
```

Output is written to `dist/`. Preview the production build:

```bash
npm run preview
```

## Project Structure

```
src/
  components/       # Page sections (Header, Hero, etc.) and shared UI
  data/             # Centralized book metadata, navigation, and assets manifest
  hooks/            # Active section tracking, engagement analytics, body scroll lock
  lib/              # Analytics (GA4/Clarity), Razorpay helpers
  styles/           # Design tokens, reset, typography, layout, globals
docs/
  ANALYTICS.md      # GA4 key events, Clarity, privacy notes
public/
  assets/
    brand/          # Logo, mark, favicon
    hero/           # Radial/circuit decorations, paperback PNG
    topic-icons/    # Hero topic SVG icons
    learning-icons/ # Learning section SVG icons
    formats/        # Device montage PNG + format icon references
    author/         # Author portrait PNG
    decorations/    # Section ornaments, footer circuit
    social/         # Open Graph preview
    icons/          # Format, brand, and social utility icons
assets/
  books/            # Sample chapter PDF source (uploaded to private S3)
backend/            # SAM API for orders, sample chapter, and digital delivery
scripts/            # Production deploy helpers (Amplify zip pipeline)
```

All asset paths are centralized in `src/data/assets.ts`. Book content and purchase URLs live in `src/data/book.ts`.

## Replacing Book Links

Canonical purchase and contact values live in `src/data/book.ts`:

```ts
amazonUrl: 'https://www.amazon.in/dp/B0H6R4334W',
linkedinUrl: 'https://www.linkedin.com/in/lpradeepk',
email: 'admin@classpath.in',
```

Keep these in sync whenever the Amazon listing changes:

- `src/data/book.ts` → `amazonUrl` (used by CTAs, formats, testimonials)
- `index.html` → JSON-LD Kindle offer `url` and the `<noscript>` Amazon link

Canonical, Open Graph, and Twitter meta tags should use the live site URL
(`https://modern-java.classpath.in/`).

Paperback checkout uses the AWS SAM service in `backend/`. Follow
`backend/README.md` to deploy it, then set `VITE_ORDER_API_URL` in the website
environment to the deployed API URL.

### Paperback waitlist (build-time flags)

Vite feature flags control whether the formats card shows purchase, waitlist, or
unavailable. Changing them requires a **frontend rebuild and Amplify redeploy**.

Production Amplify deploys default to:

```env
VITE_PAPERBACK_SALES_ENABLED=false
VITE_PAPERBACK_WAITLIST_ENABLED=true
```

Restore paperback ordering:

```bash
VITE_PAPERBACK_SALES_ENABLED=true VITE_PAPERBACK_WAITLIST_ENABLED=false npm run deploy
```

Existing Razorpay/order APIs remain deployed; only the frontend surface switches.

The free sample chapter PDF lives at `assets/books/modern-java-preview.pdf`.
After the backend stack is deployed, upload it to the private digital-assets
bucket with:

```bash
cd backend
npm run upload:assets
```

Sample requests then receive a time-limited S3 download link by email.

## Replacing Raster Assets

Drop replacement files into the normalized paths (same filenames):

| Asset | Path |
|-------|------|
| Book cover (3D) | `public/assets/hero/modern-java-3D.webp` |
| Author portrait | `public/assets/author/pradeep_author.webp` |
| Device montage | `public/assets/formats/formats.webp` |

No code changes are needed if filenames stay the same. For new filenames, update `src/data/assets.ts`.

## Deployment on AWS Amplify

Production hosts at [https://modern-java.classpath.in](https://modern-java.classpath.in)
on Amplify app `modern-java` (manual zip deploy to the `main` branch — the app is
not Git-connected).

### One-command deploy

Requires the AWS CLI configured for account access in `ap-south-1`, plus
`curl`, `zip`, and `python3`.

```bash
npm run deploy
```

This script:

1. Builds the site with `VITE_ORDER_API_URL`
2. Zips `dist/`
3. Creates an Amplify deployment, uploads the zip, and starts it
4. Polls until the job succeeds or fails

```bash
# Rebuild skipped if dist/ is already current
SKIP_BUILD=1 npm run deploy

# Override defaults when needed
AMPLIFY_APP_ID=... AMPLIFY_BRANCH=main VITE_ORDER_API_URL=https://... npm run deploy
```

Defaults (overridable via env):

| Variable | Default |
|----------|---------|
| `AMPLIFY_APP_ID` | `dd9kgrhw8x8dv` |
| `AMPLIFY_BRANCH` | `main` |
| `AWS_REGION` | `ap-south-1` |
| `VITE_ORDER_API_URL` | Order API URL used by checkout |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (sample + digital checkout) |
| `VITE_GA_MEASUREMENT_ID` | GA4 measurement ID (optional; consent-gated; loaded from `.env.local` on deploy) |
| `VITE_CLARITY_ID` | Microsoft Clarity project ID (optional; consent-gated) |
| `VITE_PAPERBACK_SALES_ENABLED` | Build-time flag (default `false` on deploy) |
| `VITE_PAPERBACK_WAITLIST_ENABLED` | Build-time flag (default `true` on deploy) |
| `DEPLOY_SITE_URL` | `https://modern-java.classpath.in` |

Analytics setup, conversion events, and GA4 key-event configuration are documented in [`docs/ANALYTICS.md`](./docs/ANALYTICS.md).

The deploy script lives at `scripts/deploy-amplify.sh`. Run
`./scripts/deploy-amplify.sh --help` for the full option list.

Before the first production cut, complete items in
[`TODO_PRODUCTION_CONTENT.md`](./TODO_PRODUCTION_CONTENT.md).

`amplify.yml` remains available if you later connect the repo for CI builds.

## Responsive Testing

Test at these viewport sizes (no horizontal scroll expected):

- 320×568, 375×812, 390×844 (mobile)
- 768×1024, 1024×768 (tablet)
- 1280×800, 1440×900, 1536×1024, 1920×1080 (desktop)

Use browser DevTools responsive mode or capture screenshots in `screenshots/` for visual regression.

## Features

- Responsive layout (320px – 1920px+)
- Sticky header with accessible mobile drawer navigation
- Semantic HTML with WCAG accessibility targets
- SEO metadata, Open Graph, Twitter cards, and JSON-LD book schema
- Reduced-motion support
- Noscript fallback with essential content and purchase links

## Tech Stack

- React 18
- Vite 6
- TypeScript
- Lucide React (audience icons and check marks)
- Plain CSS with design tokens (no Tailwind, no component library)

## License

© 2026 Pradeep Kumar L. All rights reserved.
