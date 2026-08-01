# Mobile Performance Investigation — Modern Java Landing Page

**Website:** https://modern-java.classpath.in  
**Investigation date:** 1 August 2026  
**Repository commit inspected:** `01495b7705a22027c3f36938baa6b8991e3d91b4` (branch `main`)  
**Scope:** Analysis only — no source, asset, Amplify, or deployment changes were made as part of this investigation.

**Documentation location:** `docs/performance/` (alongside existing `docs/ANALYTICS.md`).

---

## 13.1 Executive summary

Under Google PageSpeed Insights (mobile, Moto G Power, slow 4G), the landing page scores **Performance 68**, with **FCP 3.2 s** and **LCP 6.7 s**. Accessibility (96), Best Practices (100), and SEO (100) are healthy. **TBT 0 ms** and **CLS 0** indicate JavaScript long tasks and layout shift are not the primary mobile bottlenecks.

**Exact LCP element (confirmed):** the hero 3D book-cover `<img>` rendered by `Hero` (`src/components/Hero/Hero.tsx`), selector `section#top > div.hero-inner > div.hero-visual > img`, asset `/assets/hero/modern-java-3D.webp`.

### Top three root causes

| # | Finding | Relative impact | Confidence |
| - | ------- | --------------- | ---------- |
| 1 | **Late LCP discovery via the React SPA chain** — LCP image is absent from the initial HTML and is only requested after the main JS bundle executes and React mounts `Hero` | Highest — Lighthouse estimated ~1.3–1.4 s LCP savings from preload/discovery alone; dominates the 6–7 s LCP | Confirmed |
| 2 | **Render-blocking Google Fonts CSS + monolithic app CSS** — blocks first paint; PSI ~1,060 ms / lab median ~1.5–1.7 s estimated savings | High — drives slow FCP (3–4 s) and delays hero paint | Confirmed |
| 3 | **Oversized image delivery (no `srcset`/`sizes`)** — hero 1200×1200 WebP shown ~364×364; guide mockup 1600×1067 shown ~364×243; ~160 KiB estimated savings | Medium for LCP bytes (~50–63 KiB on hero); larger total payload waste on below-fold guide image | Confirmed |

These are **confirmed website loading-performance problems**. They do **not** prove that performance alone explains any Meta Ads gap between link clicks and landing-page views. Meta Pixel measurement, low-intent clicks, and privacy/network effects require a **separate investigation**.

---

## 13.2 Baseline

### PageSpeed Insights (provided, 1 August 2026)

| Category | Score |
| -------- | ----: |
| Performance | 68 |
| Accessibility | 96 |
| Best Practices | 100 |
| SEO | 100 |

| Metric | Value |
| ------ | ----: |
| First Contentful Paint | 3.2 s |
| Largest Contentful Paint | 6.7 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 4.7 s |

**Test conditions (PSI):** Mobile, emulated Moto G Power, slow 4G.  
**Chrome User Experience Report (field data):** Not available in the supplied report (lab-only baseline).

### Agent Lighthouse retests (production URL)

Tool: `lighthouse@12.8.2`, form factor mobile, simulated throttling, cache disabled equivalent (lab cold load), headless Chrome. Three runs:

| Run | Perf | FCP | LCP | TBT | CLS | Speed Index | Render-blocking est. | Image delivery est. |
| --: | ---: | --: | --: | --: | --: | ----------: | -------------------: | ------------------: |
| 1 | 73 | 3.4 s | 4.5 s | 0 ms | 0 | 5.9 s | 1,662 ms | ~136–160 KiB |
| 2 | 65 | 4.1 s | 6.0 s | 30 ms | 0 | 6.0 s | 1,536 ms | ~136–160 KiB |
| 3 | 65 | 4.1 s | 5.8 s | 20 ms | 0 | 6.1 s | 1,517 ms | ~136–160 KiB |
| **Median** | **65** | **4.1 s** | **5.8 s** | **20 ms** | **0** | **6.0 s** | **~1,536 ms** | **~160 KiB** |

Lab values vary by run and host network; **do not treat any single run as universal**. The PSI LCP of 6.7 s and the agent median LCP of 5.8 s are consistent in severity (poor LCP) even though absolute numbers differ.

---

## 13.3 Finding 1 — Render-blocking requests

**Severity:** High (FCP / early paint)  
**Confidence:** Confirmed  
**PSI estimated savings:** ~1,060 ms  
**Agent median estimated savings:** ~1,500–1,660 ms

### Exact resources

| Resource | Type | Source location | Blocking reason | Above-fold requirement | Estimated priority | Evidence |
| -------- | ---- | --------------- | --------------- | ---------------------- | ------------------ | -------- |
| Google Fonts CSS (`Inter` 400/500/600/700 + `Space Grotesk` 400/500/600/700, `display=swap`) | External stylesheet | `index.html` lines 48–53 | Classic render-blocking `<link rel="stylesheet">` in `<head>` | Partial — hero uses Space Grotesk 700 + Inter body; many weights unused above fold | Critical (chain) / Deferrable (unused weights) | Production HTML; Lighthouse render-blocking audit (~830–850 ms wasted on this URL) |
| Inter latin woff2 (~48 KiB transfer) | Font file | Discovered via Google Fonts CSS → `fonts.gstatic.com` | Not directly render-blocking, but on critical font chain after CSS | Body text | Important | Network dependency tree; third-party summary |
| Space Grotesk woff2 files (~19 KiB + ~22 KiB) | Font files | Same CSS | Same | Hero heading / headings | Important | Network tree shows two Space Grotesk files fetched |
| `/assets/index-BL-md07O.css` (~12.8 KiB gzip / 73.6 KiB raw) | App stylesheet | Injected by Vite into production `index.html` (`<link rel="stylesheet">`); source entry `src/main.tsx` → `src/styles/globals.css` + every component CSS imported by the landing tree | Render-blocking CSS for initial route | Partial — hero/header critical; below-fold section CSS bundled together | Critical (subset) / Deferrable (below-fold CSS) | Production HTML line with `index-BL-md07O.css`; build output; Lighthouse ~300 ms wasted |
| `/assets/index-BJNnI5rD.js` (~78–84 KiB gzip / ~280 KiB raw) | Module script | Production `index.html` `<script type="module">` | Module scripts are deferred (do not block HTML parse like classic sync scripts) but **gate all React content**, including LCP `<img>` | Required for current SPA architecture | Critical for LCP discovery | Production HTML; initiator chain for LCP image |
| JSON-LD `<script type="application/ld+json">` | Structured data | `index.html` | Non-blocking | SEO only | Unnecessary for paint | `index.html` |
| GA4 / Clarity / Meta Pixel | Third-party scripts | `src/lib/analytics.ts`, `src/lib/metaPixel.ts`, `MetaPageViewTracker` | Loaded **only after analytics consent** (`async`); not on first paint for declined/unknown consent | No | Unnecessary during initial render (until consent) | Consent-gated `initAnalytics()`; not in cold-load third-party list as primary LCP blockers |
| Cloudflare Turnstile | Third-party script | `SampleChapterSection` → `TurnstileWidget` → `loadTurnstile()` | Async; competes for bandwidth/main thread after React mount | No (below-fold form) | Deferrable / Unnecessary during initial render | Lighthouse third-party: `challenges.cloudflare.com` ~27 KiB |

### Font-specific findings

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Families | `Inter` (body), `Space Grotesk` (display/heading/section) | `src/styles/tokens.css` `--font-*`; `index.html` Google Fonts URL |
| Weights requested | 400, 500, 600, 700 for **both** families | `index.html` `css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700` |
| Styles | Normal only (no italic requested) | Fonts URL |
| Hosting | External (Google Fonts / gstatic) | `fonts.googleapis.com`, `fonts.gstatic.com` |
| `font-display` | `swap` (via Google CSS) | Fetched CSS `@font-face { font-display: swap; }`; Lighthouse `font-display` audit passed |
| Unused weights | Likely — CSS uses 400/500/600/700 and one non-standard `650` (maps toward 600/700); Space Grotesk 400/500 may be lightly used | `rg font-weight` across CSS; hero title is 700 |
| Preconnect | Yes to both Google origins | `index.html` lines 48–49 |
| Preload of woff2 | No | Production HTML has no `rel=preload` for fonts |
| Duplicate formats | Google serves woff2 per unicode-range; latin files dominate mobile English page | Network requests show 3 font files (~91 KiB total third-party fonts transfer) |

### Dependency order (critical path excerpt)

```text
HTML document
  → render-blocking: fonts.googleapis.com CSS
      → fonts.gstatic.com Inter + Space Grotesk woff2
  → render-blocking: /assets/index-*.css (full app CSS)
  → deferred module: /assets/index-*.js
      → React bootstrap → full landing tree
```

### Recommended remediation direction (do not implement here)

- Self-host a minimal font subset (latin, only weights actually used) with `font-display: swap`, or use `media="print" onload` / non-blocking pattern for non-critical font CSS.
- Split or inline a small critical CSS set for header + hero; defer below-fold component CSS.
- Avoid loading the full Google Fonts combinatorial URL on the critical path.

---

## 13.4 Finding 2 — LCP and request discovery

**Severity:** P0  
**Confidence:** Confirmed

### Exact LCP element

| Field | Value |
| ----- | ----- |
| Component | `Hero` |
| Source file | `src/components/Hero/Hero.tsx` (img approx. lines 65–73) |
| DOM / selector | `section#top > div.hero-inner > div.hero-visual > img` |
| Snippet | `<img src="/assets/hero/modern-java-3D.webp" … width="1200" height="1200" fetchpriority="high" loading="eager" decoding="async">` |
| Asset | `/assets/hero/modern-java-3D.webp` → `https://modern-java.classpath.in/assets/hero/modern-java-3D.webp` |
| Resource size | 69,856 bytes (~68 KiB) WebP |
| Intrinsic dimensions | 1200 × 1200 |
| Rendered mobile size (lab) | ~364 × 364 CSS px (bounding rect from Lighthouse) |
| Priority attributes | `fetchPriority="high"`, `loading="eager"` already set in React — **after** discovery |

### LCP timing explanation

Median agent LCP ≈ **5.8 s**; PSI LCP **6.7 s**. Phase breakdown from Lighthouse `largest-contentful-paint-element` (run 2, LCP 6.0 s):

| LCP phase | Observed duration | Main cause | Evidence | Confidence |
| --------- | ----------------: | ---------- | -------- | ---------- |
| Time to First Byte | ~450–610 ms | Document HTML from Amplify/CloudFront; generally healthy | `server-response-time` ~10–14 ms unthrottled; TTFB phase under simulation | High confidence |
| Resource load delay | ~70–450 ms (varies by run) | LCP URL not in initial HTML; request starts only after JS → React → `<img>` | `lcp-discovery-insight`: **Request is discoverable in initial document = false**; initiator path `webp ← script ← index-*.js ← HTML` | Confirmed |
| Resource load duration | ~40–50 ms (lab) | Image bytes are moderate; download itself is not the long pole once requested | Network + LCP phase tables | Confirmed |
| Element render delay | ~3.8–5.0 s (**~84–86% of LCP**) | Late discovery + render-blocking CSS/fonts + single-bundle React render of the full page before stable LCP paint | Phase table; no hero opacity/entrance animation in `Hero.css`; entire landing imported eagerly in `App.tsx` | High confidence |

**Interpretation:** The hero image is **not** lazy-loaded and already has `fetchpriority="high"`, but Lighthouse still fails **LCP request discovery** because the image cannot be seen in the initial HTML. `prioritize-lcp-image` estimated **~1,360 ms** LCP savings from making the resource discoverable earlier (e.g. `<link rel="preload">` matching the final URL, or HTML-resident image).

### LCP dependency chain (actual)

```text
Initial HTML (no hero <img>, no preload for modern-java-3D.webp)
  → /assets/index-BJNnI5rD.js  (parser; module)
    → ReactDOM.createRoot + <App />  (src/main.tsx)
      → landing branch renders <Hero />  (src/App.tsx)
        → <img src={assets.hero.paperback}>  (Hero.tsx; assets.ts → /assets/hero/modern-java-3D.webp)
          → network fetch of WebP (initiatorType: script)
            → decode + paint as LCP
```

Parallel blockers on the way to first meaningful paint:

```text
Initial HTML
  → Google Fonts CSS (render-blocking)
  → /assets/index-BL-md07O.css (render-blocking)
```

### Hero-component checks

| Check | Result |
| ----- | ------ |
| Delayed state init | No — `Hero` is a pure function component |
| Client-only / Suspense / `React.lazy` | No lazy/Suspense on landing; all sections static imports in `App.tsx` |
| Dynamic imports | None in app components (only test mocks) |
| Entrance animations delaying opacity | None on hero image in `Hero.css` |
| Intersection Observer | Not in `Hero` (used later in format cards) |
| Conditional rendering of cover | Only format line text depends on paperback mode; image always rendered |
| `loading="lazy"` on LCP | **No** (eager) |
| Preload in HTML | **No** |
| CSS `background-image` for LCP | **No** — real `<img>` |
| Mobile layout | At `max-width: 820px`, visual is `order: 2` under copy — image sits lower (~top 628 px); still LCP in lab |

### Recommended remediation direction

- Add a `<link rel="preload" as="image" href="/assets/hero/modern-java-3D.webp" fetchpriority="high">` (or responsive preload) in `index.html` **matching the exact final URL**.
- Optionally embed a static hero `<img>` in `index.html` / SSR shell so the preload scanner finds it without waiting for JS (larger architectural change).
- Keep `fetchpriority="high"` / avoid lazy on the LCP image (already correct).
- Reduce competing work before first hero paint (font/CSS splitting, defer Turnstile until interaction/near viewport).

---

## 13.5 Finding 3 — Image delivery

**Severity:** P1 (hero contributes to LCP bytes; guide image is larger waste but below-fold)  
**Confidence:** Confirmed  
**PSI / lab estimated savings:** ~160 KiB (`image-delivery-insight` wastedBytes ≈ 164 KiB)

### Image inventory (initial landing view)

| Image | Format | File size | Intrinsic size | Mobile rendered size | Loading behavior | Issue | Potential saving | Priority |
| ----- | ------ | --------: | -------------- | -------------------- | ---------------- | ----- | ---------------: | -------- |
| `modern-java-3D.webp` (hero LCP) | WebP | 68.2 KiB | 1200×1200 | ~364×364 | eager + fetchpriority high; **no srcset** | ~3.3× width oversize (~11× pixel area) | ~50–63 KiB | **P0** |
| `3Dmockup-tp.webp` (Guide section) | WebP | 103.8 KiB | 1600×1067 | ~364×243 | `loading="lazy"` | ~4.4× width oversize; largest wasted bytes | ~89–101 KiB | **P1** |
| `hero-circuit-left.svg` / `right.svg` | SVG | &lt;1 KiB each | decorative | small / faded | default (DecorativeImage) | Negligible | — | P3 |
| `modern-java-logo-horizontal.svg` | SVG | &lt;1 KiB | 300×72 attrs | header | eager (no lazy) | Fine | — | — |
| `eyebrow-line.svg` / ornaments | SVG | &lt;1 KiB | decorative | — | via shared components | Fine | — | P3 |
| `icon-java.svg` / `amazon-logo.svg` | SVG | &lt;2 KiB | icon | small | in Guide / buttons | Fine | — | P3 |
| `pradeep_author.webp` | WebP | 17.1 KiB | 800×600 | portrait (lazy) | `loading="lazy"` | Mild oversize possible; not in PSI top savings | small | P2 |
| `og-preview.jpg` | JPEG | 120.0 KiB | 1200×630 | not painted in-page | meta/social only | Not an initial render cost | — | P3 |
| `formats.webp` | WebP | 69.6 KiB | 1400×933 | **not referenced in components** | unused at runtime | Dead public asset shipped in `dist` | deploy weight only | P3 |
| `paperback-3D.webp` | WebP | 70.5 KiB | 1200×1200 | waitlist-only UI (hidden when paperback unavailable) | lazy when section shown | Not on current prod landing path | — | P3 |
| `pdf.png` / `epub.png` / `mobi.png` | PNG | 35–40 KiB each | 256×256 | **not used by live FormatCard UI** (lucide icons instead); smaller `.webp` copies also exist | unused | Unnecessary PNG weight in `public/` | ~110 KiB deploy | P3 |

**Oversizing example (hero):**

```text
Intrinsic size: 1200 × 1200
Rendered mobile size: ~364 × 364
Width oversizing ratio: ~3.3×
Pixel-area oversizing ratio: ~10.9×
```

### Format / loading notes

- Hero and guide assets are already **WebP** (good); further gains are primarily **responsive resizing**, not format conversion.
- No `srcset` / `sizes` anywhere on landing images.
- LCP image correctly avoids lazy-load; guide/author correctly use lazy.
- CSS backgrounds are not used for the LCP image.
- Duplicate unused PNG format icons and unused `formats.webp` inflate artifact size but were **not** in the Lighthouse image-delivery table for the initial view.

### Caching (images & hashed bundles)

Observed on production responses (HTML, JS, CSS, hero WebP):

```http
cache-control: public, max-age=0, s-maxage=31536000
server: AmazonS3
via: CloudFront
```

- CDN edge cache lifetime is long (`s-maxage=31536000`).
- **Browser `max-age=0`** means user agents revalidate every time; Lighthouse’s long-cache audit mainly flagged a Cloudflare Turnstile challenge URL (TTL 0), not Amplify hashed assets.
- No `customHttp.yml` / custom header config found in-repo; Amplify defaults apply.
- Content-hashed JS/CSS filenames are present (`index-BJNnI5rD.js`, `index-BL-md07O.css`).

### Relationship to LCP

Image delivery is **confirmed** (~160 KiB) but **secondary to discovery**: once requested, hero download duration is only tens of milliseconds in lab. Responsive hero variants help LCP somewhat (PSI/debugData showed ~240 ms LCP metric savings for responsive images) but will not alone fix a 6–7 s LCP.

### Recommended remediation direction

- Generate mobile (~400–800 w) and desktop hero/guide variants; wire `srcset` + `sizes`.
- Keep modern formats (WebP/AVIF optional).
- Remove or stop shipping unused PNGs / unused `formats.webp` in a cleanup session.

---

## 13.6 Secondary observations

| Observation | Status | Notes |
| ----------- | ------ | ----- |
| Forced reflow | Insight present; empty items / score pass | Not a material finding in these runs |
| DOM size | 669 elements | Passes Lighthouse; largest child list is chapter TOC (`InsideBookSection`) |
| Cache lifetime | Browser `max-age=0` on site assets; Turnstile challenge uncacheable | Secondary; consider Amplify custom headers for hashed static assets later |
| Third-party scripts | Google Fonts (~91 KiB fonts); Cloudflare Turnstile (~27 KiB) loads with sample form mount | GA/Clarity/Meta consent-gated — good |
| Unused JavaScript | ~32–33 KiB estimated in main bundle | Participates in LCP chain only as part of the monolithic `index-*.js`; not top-three by itself |
| Accessibility contrast | Score 96 | `p.hero-meta` (`#747e8f` on `#ffffff`) contrast 4.09 &lt; 4.5 — `Hero.css` / tokens `--color-muted-light` |
| No code splitting | Single JS + single CSS chunk | `vite.config.ts` has no manualChunks; `App.tsx` eager-imports all landing sections |
| Bundle analyzer | **Not configured** | No `analyze` script in `package.json` — used `vite build` output sizes instead |

### Production build assets (local `npm run build`)

| Asset | Raw size | Compressed (gzip ~) | Initial load? | Purpose | Concern |
| ----- | -------: | ------------------: | ------------- | ------- | ------- |
| `dist/assets/index-hLOkzjWD.js` (local hash; prod `index-BJNnI5rD.js`) | 280 KiB | ~82–84 KiB | Yes | Entire React app | Monolith; ~32 KiB unused JS flagged |
| `dist/assets/index-BL-md07O.css` | 73.6 KiB | ~12.8 KiB | Yes | All component CSS | Render-blocking; includes below-fold styles |
| `dist/index.html` | 5.2 KiB | ~1.6 KiB | Yes | Shell | Missing LCP preload |
| `modern-java-3D.webp` | 68 KiB | n/a (already compressed) | Yes (after JS) | LCP | Oversized for mobile |
| `3Dmockup-tp.webp` | 104 KiB | n/a | Lazy after mount | Guide | Oversized |
| Fonts (Google) | — | ~91 KiB transfer | Yes | Typography | Render-blocking CSS + multiple weights |

**Note:** Local JS content hash differs from production (`hLOkzjWD` vs `BJNnI5rD`) because production builds bake env flags (`VITE_*`). CSS hash matched production at investigation time.

### Meta Ads / funnel caveats

| Category | Assessment |
| -------- | ---------- |
| Confirmed website-performance problems | Yes — LCP discovery, render-blocking fonts/CSS, oversized images |
| Possible Meta Pixel measurement problems | **Not verified here**; Pixel is consent-gated and production-only (`metaPixel.ts`) |
| Possible low-intent / accidental clicks | Outside this investigation |
| Browser privacy / network effects | Outside this investigation |

**Recommendation:** Run a separate Meta Pixel / CAPI validation session; do not attribute the full click→view gap to performance without that evidence.

---

## 13.7 Prioritized remediation plan

### P0 — Required to improve LCP materially

1. **Discover LCP image from HTML**  
   - Problem: JS-mediated discovery (`requestDiscoverable: false`).  
   - Files: `index.html` (± `Hero.tsx` for URL consistency).  
   - Expected benefit: Large directional LCP improvement (lab estimate ~1–1.5 s from preload alone; more if combined with lighter critical path).  
   - Risk: Preload URL mismatch if asset path changes; over-preloading wrong density.  
   - Validation: Lighthouse LCP discovery checklist + 3-run median LCP.  
   - Independent: Yes.

2. **Unblock first paint (fonts + critical CSS)**  
   - Problem: Google Fonts stylesheet + full CSS block rendering (~1.0–1.7 s estimated).  
   - Files: `index.html`, `src/styles/*`, possibly font self-host under `public/`.  
   - Expected benefit: Lower FCP; earlier hero paint; supports LCP.  
   - Risk: FOUT/FOIT aesthetics; missing glyph subsets.  
   - Validation: FCP/LCP medians; visual check of hero type.  
   - Independent: Mostly yes; coordinate with preload session.

### P1 — High-value initial-load optimization

3. **Responsive hero (+ guide) images**  
   - Files: `public/assets/hero/*`, `public/assets/formats/3Dmockup-tp.webp`, `Hero.tsx`, `GuideSection.tsx`, `assets.ts`.  
   - Expected benefit: ~160 KiB transfer; modest LCP help (~0.2–0.5 s directional).  
   - Risk: Wrong `sizes` attribute.  
   - Validation: Image delivery audit + visual.  
   - Independent: Yes.

4. **Defer Turnstile until near viewport or form focus**  
   - Files: `SampleChapterSection.tsx`, `TurnstileWidget.tsx`.  
   - Expected benefit: Less early third-party contention.  
   - Risk: First submit race if widget not ready.  
   - Validation: Network waterfall; form still works.  
   - Independent: Yes.

### P2 — Secondary performance improvements

5. **Split landing JS/CSS** (lazy below-fold sections).  
6. **Trim unused font weights**; self-host latin-only files.  
7. **Amplify/CloudFront cache headers** for hashed assets (`max-age` browser TTL).  
8. **Remove unused public assets** (`formats.webp`, unused PNG icons) from deploy artifact.

### P3 — Nice-to-have cleanup

9. Fix `hero-meta` contrast (`#747e8f` → darker muted).  
10. Add optional bundle analyzer script (only with permission).  
11. Consider AVIF alternatives after WebP responsive variants exist.

Avoid unsupported claims such as “LCP will become 2 s.” Expect **directional** gains until re-measured with the same 3-run median protocol.

---

## 13.8 Proposed implementation sessions

### Session 1 — LCP discovery and hero prioritization

- Add HTML preload (and verify URL match) for `modern-java-3D.webp`.
- Confirm `fetchpriority` / eager remain correct.
- Re-run mobile Lighthouse ×3; capture discovery checklist.

### Session 2 — Critical CSS and fonts

- Reduce render-blocking Google Fonts (subset / self-host / async pattern).
- Drop unused weights; keep `font-display: swap`.
- Optionally extract critical header+hero CSS.
- Visual regression on typography.

### Session 3 — Responsive image delivery

- Create mobile-appropriate hero and guide variants.
- Add `srcset` / `sizes`.
- Optionally prune unused PNG/WebP assets from `public/`.
- Confirm lazy-load remains on below-fold images only.

### Session 4 — Defer non-critical third parties + light code-splitting

- Lazy-mount Turnstile.
- Consider `React.lazy` for below-fold sections (Formats dialogs, etc.) if bundle still blocks.
- Do **not** change Meta Pixel semantics here.

### Session 5 — Validation

- Re-run Lighthouse (3-run medians) vs this baseline.
- Mobile visual QA.
- Network waterfall before/after.
- **Separate** Meta Pixel / Ads funnel validation (not part of performance acceptance).

---

## Validation performed during investigation

| Check | Result |
| ----- | ------ |
| `npm run lint` | Pass |
| Type-check | Via `npm run build` → `tsc -b` Pass |
| `npm test` | 12 files / 62 tests Pass |
| `npm run build` | Pass — CSS 73.6 KiB / JS 280 KiB |
| Bundle analyzer script | **Not present** — skipped (no install) |
| Lighthouse mobile ×3 | Completed; median Perf **65**, LCP **5.8 s** |
| Accessibility spot-check | Score 96; contrast fail on `.hero-meta` |
| Production headers / HTML | Inspected via HTTPS |
| Working tree | Report file added only; pre-existing unrelated `backend/*` modifications were already dirty before this task |

---

## Hypothesis verification summary

| Hypothesis | Verdict |
| ---------- | ------- |
| TBT ≈ 0 ⇒ JS execution not dominant bottleneck | **Confirmed** for long tasks; JS still sits on the LCP **discovery** path |
| CLS = 0 ⇒ visually stable | **Confirmed** |
| FCP slow due to render-blocking CSS/fonts | **Confirmed** |
| LCP poor due to late discovery of above-fold resource | **Confirmed** (hero WebP via React) |
| Book cover is LCP | **Confirmed** (not heading/background) |
| Images oversized / inefficient | **Confirmed** for dimensions (format already WebP) |
| Tracking explains funnel gap | **Not investigated** — out of scope |

---

## Appendix A — Key source references

- `index.html` — Google Fonts, no image preload, Vite JS/CSS injection points  
- `src/main.tsx` — CSS + React bootstrap  
- `src/App.tsx` — eager landing composition  
- `src/components/Hero/Hero.tsx` / `Hero.css` — LCP image + mobile order  
- `src/data/assets.ts` — asset URLs  
- `src/styles/tokens.css` — font CSS variables  
- `src/lib/analytics.ts` / `src/lib/metaPixel.ts` — consent-gated third parties  
- `amplify.yml` — `npm ci` + `npm run build` → `dist`  
- `vite.config.ts` — no code-splitting / analyzer  

## Appendix B — Classification legend

- **Confirmed** — Observed in source and/or Lighthouse against production  
- **High confidence** — Strong lab + code agreement with minor timing variance  
- **Moderate confidence** — Plausible, limited direct instrumentation  
- **Unverified** — Not measured in this task  
- **Ruled out** — Contradicted by evidence (e.g. LCP is not the hero heading; LCP image is not lazy-loaded)
