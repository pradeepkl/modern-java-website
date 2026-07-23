# Analytics setup (GA4 + Clarity)

The site loads Google Analytics 4 and Microsoft Clarity **only after** the visitor chooses **Accept analytics** on the cookie banner. Essential-only visitors are not tracked.

## Environment variables

Set these in `.env.local` (local) and Amplify / deploy env (production):

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | GA4 measurement ID |
| `VITE_CLARITY_ID` | `abcdefghij` | Microsoft Clarity project ID (optional) |

If both are empty, the consent banner still appears but no third-party scripts load.

## Mark these events as key conversions in GA4

Admin → **Admin** → **Events** (or **Key events**):

| Event name | When it fires | Recommended |
|------------|---------------|-------------|
| `sample_form_success` | Sample chapter email accepted by API | Key event (lead) |
| `purchase` | Razorpay (or bypass) payment verified | Key event (revenue) |
| `amazon_exit` | Visitor leaves to Amazon Kindle | Key event (assisted) |

Also useful for funnels (do not need to be key events):

- `cta_click` → `section_view` (`formats`) → `format_cta_click` → `checkout_open` → `checkout_submit` → `checkout_payment_start` → `purchase`
- `sample_form_start` → `sample_form_submit` → `sample_form_success`
- `amazon_consent_shown` → `amazon_consent_submit` / skip → `amazon_exit`
- `checkout_abandon`, `checkout_fail`, `form_field_abandon`, `scroll_depth`

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

## Privacy

- No email, name, phone, or address is sent to GA4/Clarity (`src/lib/analytics.ts` strips those keys).
- Analytics consent is separate from marketing email checkboxes.
- Documented in `/privacy-policy`.

## UTM attribution

First-touch UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) are stored in `sessionStorage` and attached to subsequent events in that tab session.
