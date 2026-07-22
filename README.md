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
  hooks/            # Active section tracking, body scroll lock
  styles/           # Design tokens, reset, typography, layout, globals
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
```

All asset paths are centralized in `src/data/assets.ts`. Book content and purchase URLs live in `src/data/book.ts`.

## Replacing Book Links

Edit `src/data/book.ts`:

```ts
amazonUrl: 'https://...',
linkedinUrl: 'https://...',
email: 'you@example.com',
```

Also update the `<noscript>` block in `index.html` and `REPLACE_WITH_PRODUCTION_URL` for the canonical URL.

Paperback checkout uses the AWS SAM service in `backend/`. Follow
`backend/README.md` to deploy it, then set `VITE_ORDER_API_URL` in the website
environment to the deployed API URL.

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
| Book cover (3D) | `public/assets/hero/modern-java-3D.png` |
| Author portrait | `public/assets/author/pradeep-kumar.png` |
| Device montage | `public/assets/formats/available.png` |

No code changes are needed if filenames stay the same. For new filenames, update `src/data/assets.ts`.

## Deployment on AWS Amplify

1. Connect your Git repository in the Amplify console
2. Amplify detects `amplify.yml` automatically
3. Build command: `npm run build`
4. Output directory: `dist`
5. Before deploying, complete items in [`TODO_PRODUCTION_CONTENT.md`](./TODO_PRODUCTION_CONTENT.md)

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
