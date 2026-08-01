# Mobile Performance Implementation Plan

**Status:** Implemented locally (awaiting production deploy + remeasure)  
**Baseline commit:** `01495b7705a22027c3f36938baa6b8991e3d91b4`  
**Unrelated backend edits:** Leave untouched; do not include in performance commits.

## Goals (after deploy + 3-run median)

| Metric | Baseline (agent median) | Target | Local preview median (post-fix) |
| ------ | ----------------------: | -----: | ------------------------------: |
| Performance | 65 | > 80 | **97** |
| FCP | 4.1 s | < 2.5 s | **1.4 s** |
| LCP | 5.8 s | < 3.5 s | **2.4 s** |

Local `vite preview` Lighthouse ×3 (mobile, simulated slow 4G): scores 98 / 97 / 97; LCP discovery `requestDiscoverable: true`. Production CDN latency may score lower than localhost — redeploy and remeasure before declaring success.

## Sessions

| Session | Change | Measure |
| ------- | ------ | ------- |
| 1 | Hero image `<link rel="preload">` — stable `/assets/hero/…` public URL | LCP discovery + LCP |
| 2 | Self-host latin WOFF2; drop Google Fonts render-blocking CSS; preload hero fonts | FCP + LCP |
| 3 | Responsive hero + guide WebP (`srcset`/`sizes`); keep LCP eager/high | Image delivery + LCP |
| 4 | Amplify `customHttp.yml` + include in zip deploy | Repeat-visit cache headers |

## URL stability (Session 1)

Hero asset lives under `public/assets/hero/` and is referenced as a string path in `src/data/assets.ts`. Vite copies `public/` verbatim — **no content hash** in the filename. Preload `href` may safely use `/assets/hero/modern-java-3D*.webp`.

Hashed files (`/assets/index-*.js`, `/assets/index-*.css`) get long-lived immutable caching in Session 4.

## Out of scope

- Meta Pixel / Ads funnel validation
- Critical CSS extraction (revisit only if fonts are insufficient)
- Production deploy unless explicitly requested
