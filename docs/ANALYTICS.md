# Analytics setup (GA4 + Clarity + Meta Pixel + Conversions API)

The site loads Google Analytics 4, Microsoft Clarity, and Meta Pixel **only
after** the visitor chooses **Accept analytics** on the cookie banner.
Essential-only visitors are not tracked.

Server-side Meta **Conversions API** (CAPI) sends `Lead` and `Purchase` from
the AWS Lambda Order API after verified success. Browser Pixel still owns
`PageView`, `ViewContent`, and `InitiateCheckout` in this phase.

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
| `VITE_DIGITAL_SALES_ENABLED` | `true` in prod `.env.prod` | Build-time flag (rebuild + redeploy to change; digital checkout UI hidden when false) |

You can also export them in the shell before deploy; non-empty values are baked
into the Vite bundle. Empty values are skipped so they do not wipe `.env.local`.

If all analytics IDs are empty, the consent banner still appears but no
third-party scripts load.

**Never** put the Meta Conversions API access token in Vite / React env vars.

### Meta Pixel notes

- Runtime init is configuration-driven via `VITE_META_PIXEL_ID` (`src/lib/metaPixel.ts`).
- Activation requires `import.meta.env.PROD` — the pixel does not load in
  `npm run dev`, Vitest, or non-production bundles even if the ID is set.
- `PageView` is owned by `MetaPageViewTracker` (not a static `fbq('track')` in
  `index.html`) so the initial route records a single page view.
- Duplicate `PageView`s for the same `pathname + search` are suppressed
  (covers React StrictMode remounts). Hash-only changes are not tracked.
- Standard Meta conversions use explicit dedupe keys **and** a shared
  `eventID` for `Lead` / `Purchase` so browser Pixel + server CAPI dedupe into
  one logical event in Meta.
- Meta payloads keep safe business fields such as `content_name`,
  `content_category`, `content_type`, `content_ids`, `value`, `currency`, and
  `num_items`, while still stripping direct identifiers such as email, name,
  phone, street address, city, state, and postal code.
- The HTML `<noscript>` Meta image fallback is **omitted** because analytics
  are consent-gated and static HTML cannot evaluate consent without JavaScript
  (same approach as GA4/Clarity).
- Fired standard Meta events (browser Pixel; production + analytics consent):
  - `ViewContent`: once when `#formats` first reaches ≥50% visibility
    (`content_name=Modern Java`, `content_category=Book`,
    `content_ids`, `content_type=product`, `value`, `currency=INR`).
    Deduped by `view-content:formats` (not every IntersectionObserver tick).
  - `Lead`: only after the sample-chapter API returns `accepted: true`
    (not form open, submit click, validation failure, duplicate/cooldown
    rejection, or API failure). Params:
    `content_name=Modern Java Sample Chapter`,
    `content_category=Book sample`, `eventID = sampleRequestId`.
    Amazon modal / paperback waitlist may also emit browser `Lead` with
    their own content names.
  - `InitiateCheckout`: only after the backend successfully creates a
    Razorpay order and immediately before `razorpay.open()` (not on CTA /
    dialog open). Params: `content_ids`, `content_name`,
    `content_type=product`, `value`, `currency=INR`, `num_items=1`,
    `eventID = razorpayOrderId`. Deduped by
    `initiate-checkout:{razorpayOrderId}`.
  - `Purchase`: only after `/orders/verify` succeeds (or approved local
    bypass). Never from the Razorpay browser success callback alone.
    Params: `content_ids`, `content_name`, `content_type=product`,
    `value`, `currency=INR`, `num_items`, `eventID = appOrderId`.
    Deduped by `purchase:{appOrderId}` (one Purchase per verified order).
- Fired custom Meta events:
  - `AmazonClick`: exactly once at the **final** Amazon outbound
    (`window.location.assign` to the Kindle URL), after either “Continue
    without joining” or “Continue to Amazon” post-signup. Not fired on the
    initial Buy on Amazon CTA or on email submit alone. Parameters:
    `content_ids=["modern_java_kindle"]`, `content_type=product`,
    `content_name=Modern Java Kindle`, `destination=amazon`, plus
    `eventID` beginning with `AMZ-`. This is distinct from Meta’s automatic
    button-click detection (which may still report the modal skip button).

## Meta Conversions API (server)

Phase 1 scope: **Lead** + **Purchase** only. Do not send server
`PageView` / `ViewContent` / `InitiateCheckout`.

| Event | When sent | `event_id` |
|-------|-----------|------------|
| `Lead` | After chapter preview email is accepted (not cooldown / validation / SES failure) | Stable `sampleRequestId` (`SR-…`) |
| `Purchase` | After `/orders/verify` succeeds **or** verified `payment.captured` webhook **or** authorized checkout bypass marks the order paid | Internal `appOrderId` (`MJ-…` / `MJ-D-…`) |

Browser and server must use the **same** `event_name` + `event_id` pair for
deduplication. The React app passes `eventID` into `fbq('track', …)` for Lead
and Purchase; the Lambda sends the same value as CAPI `event_id`.

### Consent

- React sends `analyticsConsent` (plus optional `_fbp` / `_fbc`,
  `eventSourceUrl`, `clientUserAgent`) with sample and checkout requests via
  `buildMetaAttributionPayload()`.
- CAPI sends **only** when `analyticsConsent` is granted. CAPI is not a
  consent bypass.
- Email is SHA-256 hashed after trim + lowercase; raw email is never included
  in the Meta payload.

### AWS configuration

1. Store the Meta access token in SSM SecureString (never in Vite):

```bash
cd backend
META_ACCESS_TOKEN='EAAB…' ./scripts/ensure-meta-capi-secret.sh
# default param: /modern-java/meta/access-token
```

2. In `sam-secrets.env.dev` / `sam-secrets.env.prod` (see
   `sam-secrets.env.example`):

```env
MetaPixelId=1844493498903023
MetaAccessTokenSsmParam=/modern-java/meta/access-token
MetaGraphApiVersion=v21.0
MetaTestEventCode=          # optional Test Events code while validating
MetaCapiEnabled=true
```

3. Redeploy the Order API (`npm run deploy:dev` / `deploy:prod` in `backend/`).
   Lambda reads the token via `ssm:GetParameter` with decryption.

### Disable / rollback

| Switch | Effect |
|--------|--------|
| `MetaCapiEnabled=false` (SAM param / secrets file) + redeploy | Stops all CAPI sends; browser Pixel unchanged |
| Clear `MetaPixelId` | Same — CAPI client treats missing pixel as disabled |
| Remove / rotate SSM token | CAPI skips with `missing_token` (workflows still succeed) |
| Clear `VITE_META_PIXEL_ID` + frontend redeploy | Stops browser Pixel (separate from CAPI) |

Meta delivery failures are logged safely and **never** fail sample requests or
purchase confirmation.

### Meta Test Events validation

**Browser Pixel (production-safe intentional test)**

1. Open Meta Events Manager → **Classpath Publications Pixel** (`1844493498903023`)
   → **Test events**.
2. Copy the test code (e.g. `TEST12345`).
3. In a private window (ad blockers off), open:

   `https://modern-java.classpath.in/?mj_meta_test=1&test_event_code=TEST12345`

   `mj_meta_test=1` opts this tab into Test Events tagging. Without it, the
   site strips leftover `test_event_code` so shared Test Events links do not
   pollute live traffic.
4. Click **Accept** on the cookie banner → expect **PageView**.
5. Scroll to **Formats** → expect **ViewContent**.
6. (Optional) Submit a chapter preview → expect browser + CAPI **Lead** with
   shared `event_id` / `sampleRequestId`. CAPI only appears under Test events
   when `MetaTestEventCode` is set on the **dev** stack (keep prod empty).

**Server CAPI (dev stack only)**

1. Copy the test code into `MetaTestEventCode` for the **dev** stack, redeploy.
2. Accept analytics and submit a chapter preview / purchase on the matching site.
3. Clear `MetaTestEventCode` before relying on production reporting.

**Production must keep CAPI `MetaTestEventCode` empty.** Casual
`?test_event_code=…` links (without `mj_meta_test=1`) are stripped before
`fbq('init')`. For clean prod reporting use **Overview / Activity** and a URL
without test codes.

### Analytics consent rate (first-party)

Every banner choice posts to `POST /analytics-consents` with only
`choice` (`granted` | `denied`), `path`, and optional `utm_*` tags. No email
or contact PII. CloudWatch log key: `analytics_consent_choice`.

Example Insights query (prod Order Lambda log group):

```
fields @timestamp, choice, path, utm_source, utm_campaign
| filter @message like /analytics_consent_choice/
| stats count(*) as n by choice
```

Operational logs use keys like `meta_capi_sent` / `meta_capi_skipped` and never
include access tokens, raw emails, `_fbp`, `_fbc`, or hashed identifiers.

#### Meta Events Manager verification (after production deploy)

**Setup**

1. Open Meta Events Manager → **Classpath Publications Pixel**.
2. Open **Test events**, copy the test code, and keep that tab open.
3. In a private window (ad blockers off), visit  
   `https://modern-java.classpath.in/?mj_meta_test=1&test_event_code=YOUR_CODE`.
4. Choose **Accept**.
5. Confirm one `PageView` in Test events.
6. In Pixel **Settings → Traffic permissions**, allowlist `classpath.in` (or
   `modern-java.classpath.in`) if Diagnostics asks to confirm the domain.

**Safe live checklist for funnel events**

| # | Action on the live site | Expect in Test Events | Expected params (non-PII) |
|---|-------------------------|------------------------|---------------------------|
| 1 | Scroll to **Formats** (`#formats`) | one `ViewContent` | `content_name=Modern Java`, `content_category=Book`, `content_type=product`, `content_ids` includes Kindle/digital ids, `currency=INR`, `value` = digital catalog amount in **rupees** |
| 2 | Open DRM-free checkout, submit form, wait until Razorpay Checkout opens | one `InitiateCheckout` | `content_name=Modern Java PDF + ePub`, `content_ids=["modern_java_digital"]`, `content_type=product`, `currency=INR`, `value` = order amount in **rupees**, `num_items=1`, `event_id` / `eventID` = Razorpay order id |
| 3 | Dismiss Razorpay, reopen checkout, create another order | one new `InitiateCheckout` for the new Razorpay order id | opening the dialog alone must **not** fire `InitiateCheckout` |
| 4 | Submit chapter preview with a real inbox you control | one logical `Lead` (Browser + Server) | shared `event_id` / `sampleRequestId`; browser params: `content_name=Modern Java Sample Chapter`, `content_category=Book sample` |
| 5 | (Optional) Join Amazon exit signup, then close without buying | one more browser `Lead` | `content_name=amazon_exit_signup` (browser-only in this phase) |
| 5b | Click **Continue without joining** *or* **Continue to Amazon** after signup | one browser custom `AmazonClick` | `content_name=Modern Java Kindle`, `content_ids=["modern_java_kindle"]`, `content_type=product`, `destination=amazon`, `event_id` / `eventID` starts with `AMZ-`. Do **not** treat Meta auto button events (buttonText / classList) as this conversion. |
| 6 | Complete one real Razorpay payment (current digital amount) **or** a known bypass order only if you intentionally use that path | one logical `Purchase` (Browser + Server) | shared `event_id` = `appOrderId`; `currency=INR`, `value` = **charged order total in rupees** (`order.amount` paise ÷ 100 — never a stale catalog hardcode); `content_name=Modern Java PDF + ePub` |
| 7 | Refresh the homepage | exactly one new `PageView` | no extra `ViewContent` / `InitiateCheckout` / `Purchase` from the refresh alone |

**Pass / fail notes**

- Events must appear only after **Accept analytics**. Essential-only visitors
  should send nothing to Meta (browser or CAPI).
- Never expect email, name, phone, address, city, state, or postal code in
  Test Events parameters.
- `Purchase` must appear only after payment verification succeeds — not on
  the “Pay … securely” click, and not after a failed payment.
- Failed sample-preview / checkout attempts must **not** create `Lead` or
  `Purchase`.
- Outside Test Events, the main Events Manager UI can lag by a few minutes.

**Recommended order for a quick smoke pass:** steps 1 → 2 → 3 → 4 → 7.
Use step 6 only when you are ready to place a real (or intentional bypass)
order.

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
| Meta `AmazonClick` (custom) | Same moment as `amazon_exit` — final outbound only; both consent paths; `eventID` = `AMZ-…` |

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
- `value`: charged order total in **rupees** (`order.amount` in paise ÷ 100; 100 paise = ₹1). Browser Pixel and CAPI must match this — never send raw paise and never hardcode a stale catalog price (e.g. send ₹699 when the order charged ₹699 / 69900 paise).
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

- No email, name, phone, street address, city, state, or postal code is sent
  to GA4/Clarity/Meta Pixel (`src/lib/analytics.ts` and `src/lib/metaPixel.ts`
  strip those keys).
- Conversions API may send a **hashed** email plus click IDs only when analytics
  consent was granted; the access token stays in AWS SSM.
- Analytics consent is separate from marketing email checkboxes.
- Documented in `/privacy-policy`.

## UTM attribution

First-touch UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are stored in `sessionStorage` and attached to subsequent events in that tab session.
