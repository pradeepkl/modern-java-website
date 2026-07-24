# Analytics setup (GA4 + Clarity)

The site loads Google Analytics 4 and Microsoft Clarity **only after** the visitor chooses **Accept analytics** on the cookie banner. Essential-only visitors are not tracked.

## Environment variables

Set these in `.env.local` (local) and they are loaded automatically by
`npm run deploy` / `scripts/deploy-amplify.sh` for production builds:

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | GA4 measurement ID |
| `VITE_CLARITY_ID` | `abcdefghij` | Microsoft Clarity project ID (optional) |
| `VITE_PAPERBACK_SALES_ENABLED` | `false` | Build-time flag (rebuild + redeploy to change) |
| `VITE_PAPERBACK_WAITLIST_ENABLED` | `true` | Build-time flag (rebuild + redeploy to change) |

You can also export them in the shell before deploy; non-empty values are baked
into the Vite bundle. Empty values are skipped so they do not wipe `.env.local`.

If both are empty, the consent banner still appears but no third-party scripts load.

## Mark these events as key conversions in GA4

Admin → **Admin** → **Events** (or **Key events**):

| Event name | When it fires | Recommended |
|------------|---------------|-------------|
| `sample_form_success` | Sample chapter email accepted by API | Key event (lead) |
| `paperback_waitlist_success` | Paperback waitlist registration accepted | Key event (demand) |
| `purchase` | Razorpay (or bypass) payment verified | Key event (revenue) |
| `amazon_exit` | Visitor leaves to Amazon Kindle | Key event (assisted) |

Also useful for funnels (do not need to be key events):

- `cta_click` → `section_view` (`formats`) → `format_cta_click` → `checkout_open` → `checkout_submit` → `checkout_payment_start` → `purchase`
- `sample_form_start` → `sample_form_submit` → `sample_form_success`
- `paperback_waitlist_card_view` → `paperback_waitlist_open` → `paperback_waitlist_submit` → `paperback_waitlist_success`
- `amazon_consent_shown` → `amazon_consent_submit` / skip → `amazon_exit`
- `checkout_abandon`, `checkout_fail`, `form_field_abandon`, `scroll_depth`, `paperback_waitlist_error`

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

Waitlist form inputs use `data-clarity-mask="true"` so name, email, and city are not readable in recordings. Modal open/submit/success interactions remain visible via `data-testid` hooks.

## Privacy

- No email, name, phone, or address is sent to GA4/Clarity (`src/lib/analytics.ts` strips those keys).
- Analytics consent is separate from marketing email checkboxes.
- Documented in `/privacy-policy`.

## UTM attribution

First-touch UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are stored in `sessionStorage` and attached to subsequent events in that tab session.
