# Analytics setup (GA4 + Clarity + Meta Pixel)

The site loads Google Analytics 4, Microsoft Clarity, and Meta Pixel **only
after** the visitor chooses **Accept analytics** on the cookie banner.
Essential-only visitors are not tracked.

## Environment variables

Set these in `.env.local` (local) and they are loaded automatically by
`npm run deploy` / `scripts/deploy-amplify.sh` for production builds:

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | GA4 measurement ID |
| `VITE_CLARITY_ID` | `abcdefghij` | Microsoft Clarity project ID (optional) |
| `VITE_META_PIXEL_ID` | `1844493498903023` | Meta (Facebook) Pixel ID (optional; production builds only) |
| `VITE_PAPERBACK_SALES_ENABLED` | `false` | Build-time flag (rebuild + redeploy to change) |
| `VITE_PAPERBACK_WAITLIST_ENABLED` | `false` | Build-time flag (rebuild + redeploy to change; paperback UI hidden when false) |

You can also export them in the shell before deploy; non-empty values are baked
into the Vite bundle. Empty values are skipped so they do not wipe `.env.local`.

If all analytics IDs are empty, the consent banner still appears but no
third-party scripts load.

### Meta Pixel notes

- Runtime init is configuration-driven via `VITE_META_PIXEL_ID` (`src/lib/metaPixel.ts`).
- Activation requires `import.meta.env.PROD` — the pixel does not load in
  `npm run dev`, Vitest, or non-production bundles even if the ID is set.
- `PageView` is owned by `MetaPageViewTracker` (not a static `fbq('track')` in
  `index.html`) so the initial route records a single page view.
- Duplicate `PageView`s for the same `pathname + search` are suppressed
  (covers React StrictMode remounts). Hash-only changes are not tracked.
- Standard Meta conversions use explicit dedupe keys so one browser session
  does not double-count the same formats view, checkout start, lead capture,
  or verified purchase.
- The HTML `<noscript>` Meta image fallback is **omitted** because analytics
  are consent-gated and static HTML cannot evaluate consent without JavaScript
  (same approach as GA4/Clarity).
- Fired standard Meta events:
  - `ViewContent`: first `#formats` section view after analytics consent
  - `Lead`: successful chapter preview signup, Amazon modal signup, and
    paperback waitlist success
  - `InitiateCheckout`: first digital/paperback checkout open after analytics
    consent
  - `Purchase`: only after verified Razorpay success or approved local bypass,
    deduped by app order id

#### Meta Events Manager verification (after production deploy)

1. Open Meta Events Manager → **Classpath Publications Pixel**.
2. Open **Test events**.
3. Visit `https://modern-java.classpath.in` and accept analytics.
4. Scroll to `#formats` and confirm one `ViewContent`.
5. Confirm one `PageView`.
6. Navigate to another path (e.g. `/privacy-policy`) and confirm one more
   `PageView` per full navigation.
7. Open a direct checkout or paperback checkout and confirm one
   `InitiateCheckout`.
8. Submit the chapter preview form successfully and confirm one `Lead`.
9. Complete a real or bypass purchase and confirm one `Purchase`.
10. Refresh and confirm exactly one new `PageView`.
11. With an ad blocker / tracking protection enabled, confirm the site still
   works.

Events Manager outside Test Events may take a short time to update.

## Mark these events as key conversions in GA4

Admin → **Admin** → **Events** (or **Key events**):

| Event name | When it fires | Recommended |
|------------|---------------|-------------|
| `sample_form_success` | Chapter preview email accepted by API | Key event (lead) |
| `paperback_waitlist_success` | Paperback waitlist registration accepted | Key event (demand) |
| `purchase` | Razorpay (or bypass) payment verified | Key event (revenue) |
| `amazon_exit` | Visitor leaves to Amazon Kindle | Key event (assisted) |

Also useful for funnels (do not need to be key events):

- `cta_click` → `section_view` (`formats`) → `format_cta_click` → `checkout_open` → `checkout_submit` → `checkout_payment_start` → `purchase`
- `sample_form_start` → `sample_form_submit` → `sample_form_success`
- `paperback_waitlist_card_view` → `paperback_waitlist_open` → `paperback_waitlist_submit` → `paperback_waitlist_success`
- `amazon_exit_modal_open` → `amazon_exit_email_submit` / `amazon_exit_continue_without_email` → `amazon_exit_email_success` → `amazon_exit_continue_after_signup` → `amazon_exit` (navigation)
- `amazon_exit_email_error`, `amazon_exit_turnstile_error`, `checkout_abandon`, `checkout_fail`, `form_field_abandon`, `scroll_depth`, `paperback_waitlist_error`

### Amazon exit modal (Classpath Reader List)

Pre-Amazon modal events never include email or other PII. Parameters may include `source` (`amazon_exit_modal`), `button_location`, `registration_status`, `error_type`, and session UTMs.

| Event | When |
|-------|------|
| `amazon_exit_modal_open` | Modal opens after Buy on Amazon |
| `amazon_exit_email_submit` | Join form submitted |
| `amazon_exit_email_success` | API accepted signup (`registration_status`: `created` \| `already_registered`) |
| `amazon_exit_email_error` | Validation or API failure |
| `amazon_exit_continue_without_email` | Visitor chose Continue without joining |
| `amazon_exit_continue_after_signup` | Visitor continued to Amazon after signup success |
| `amazon_exit_turnstile_error` | Turnstile script/widget failure |
| `amazon_exit` | Actual navigation to Amazon (keep as GA4 key event) |

**Reporting cutover (marketing consent source):** New Amazon-modal opt-ins store `marketingConsentSource = amazon_exit_modal` with `sourceVersion = "2"`. Historical rows may still show `amazon-pre-navigation` and are **not** rewritten. When reporting, treat both sources as Amazon-modal signups and split by `sourceVersion` / date if needed.

Reader-list offers are independent of Amazon reviews. The modal never asks for review URLs, screenshots, or other proof.

### Paperback waitlist demand metrics

Primary demand number: **unique confirmed waitlist records** (DynamoDB), not button clicks.

| Metric | How to measure |
|--------|----------------|
| Paperback card views | `paperback_waitlist_card_view` |
| Notify Me clicks / form opens | `paperback_waitlist_open` |
| Waitlist submissions | `paperback_waitlist_submit` |
| Unique successful registrations | DynamoDB unique emails / export script |
| Card conversion rate | unique registrations / card views |
| Form conversion rate | unique registrations / form opens |
| Registrations by source / city / week | CLI export (`backend/scripts/export-paperback-waitlist.js`) |

`paperback_waitlist_success` parameters: `registration_status` (`created` \| `already_registered`), `source`. Never send name, email, or city to GA.

### Purchase parameters

`purchase` includes GA4 ecommerce fields:

- `currency`: `INR`
- `value`: order total (399 digital, 499 × qty paperback)
- `transaction_id`: app order id
- `format`: `digital` | `paperback`
- `payment_method`: `razorpay` | `bypass`
- `items[]`: single line item

**Important:** `purchase` fires only after successful verify (or localhost bypass success), never on “Pay” click.

## Suggested explorations

1. Funnel: `page_view` → `section_view` (formats) → `checkout_open` → `purchase`
2. Lead funnel: `sample_form_start` → `sample_form_success`
3. Format mix: `format_cta_click` broken down by `format`
4. Drop-off: `checkout_abandon` / `checkout_fail` by `format` and `reason`

## Clarity

With `VITE_CLARITY_ID` set and consent granted, Clarity provides heatmaps and session replay for hero, `#formats`, and checkout dialogs. Use it to diagnose high `checkout_abandon` rates.

Waitlist form inputs use `data-clarity-mask="true"` so name, email, and city are not readable in recordings. The pre-Amazon reader-list modal masks its email field the same way. Modal open/submit/success interactions remain visible via `data-testid` hooks.

## Privacy

- No email, name, phone, or address is sent to GA4/Clarity/Meta (`src/lib/analytics.ts` and `src/lib/metaPixel.ts` strip those keys).
- Analytics consent is separate from marketing email checkboxes.
- Documented in `/privacy-policy`.

## UTM attribution

First-touch UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are stored in `sessionStorage` and attached to subsequent events in that tab session.
