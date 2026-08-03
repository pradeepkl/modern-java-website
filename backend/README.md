# Paperback Order API

AWS SAM backend for paperback orders, Razorpay payment verification, DynamoDB
storage, SES email confirmation, Zoho Invoice creation, private S3 +
CloudFront delivery for the chapter preview and paid digital editions, and
Meta Conversions API (`Lead` / `Purchase`) after verified success.

## Prerequisites

- AWS CLI authenticated to the target account
- AWS SAM CLI
- Razorpay API keys and a webhook secret
- Domain `classpath.in` verified in Amazon SES (`us-east-1`)
- Transactional mail sends from `Pradeep Kumar L | Classpath <no-reply@classpath.in>` (Reply-To: `pradeep@classpath.in`)
- SES production access, or every customer email must also be verified while the
  account remains in the SES sandbox
- Optional: Zoho Invoice (India) OAuth credentials for automatic invoices after
  paid orders (see below)

## Environments (dev vs prod)

Razorpay and the Order API use **separate AWS stacks** so a dev deploy cannot
switch the public site to test mode:

| APP_ENV | SAM stack | Razorpay mode | Amplify branch | Secrets file |
|---------|-----------|---------------|----------------|--------------|
| `dev` (default) | `modern-java-dev` | test (`rzp_test_`) | `dev` | `sam-secrets.env.dev` |
| `prod` | `modern-java-prod` | live (`rzp_live_`) | `main` | `sam-secrets.env.prod` |

`APP_ENV` is the authoritative selector. Do not infer payment mode from
`NODE_ENV`. Each stack gets its own DynamoDB tables and API URL. Each Lambda
receives **only** that environment’s Razorpay credentials.

Legacy stack name `sam-app` (if still present) is not used by these scripts.
Migrate by deploying `modern-java-dev` / `modern-java-prod`, then pointing
frontends and Razorpay webhooks at the new `OrderApiUrl` / `RazorpayWebhookUrl`
outputs.

## Deploy

```bash
cd backend
npm install
cp sam-secrets.env.example sam-secrets.env.dev   # Razorpay test keys
cp sam-secrets.env.example sam-secrets.env.prod  # Razorpay live keys (when ready)
npm run deploy          # defaults to APP_ENV=dev → modern-java-dev
# npm run deploy:prod   # requires typing PROD → modern-java-prod
```

`npm run deploy` / `deploy:dev` runs `scripts/deploy-api.sh`, which:

1. Validates `APP_ENV` and Razorpay key prefixes (`validate-env.sh`)
2. Ensures CloudFront URL-signing keys exist (local `.cloudfront-keys/` + SSM)
3. Loads **`sam-secrets.env.<APP_ENV>`** (gitignored) for Razorpay/Zoho/Turnstile
4. Builds and deploys stack `modern-java-<APP_ENV>` with only that env’s secrets

Never put Zoho, Razorpay, or bypass secrets in `samconfig.toml`.
Never put test and live Razorpay secrets in the same secrets file or Lambda.

### Razorpay credentials

In `sam-secrets.env.dev`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

In `sam-secrets.env.prod`:

```env
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Use the original test credentials from your secure source (do not try to recover
masked values from CloudFormation). Live secrets must never be committed.

After each stack deploy:

1. Copy that stack’s `OrderApiUrl` into the matching frontend file
   (`.env.dev` or `.env.prod`) as `VITE_ORDER_API_URL`.
2. Configure **separate** Razorpay dashboard webhooks:
   - Test mode → `modern-java-dev` `RazorpayWebhookUrl`
   - Live mode → `modern-java-prod` `RazorpayWebhookUrl`
3. Subscribe each webhook to `payment.captured` with **that environment’s**
   webhook secret (must match the secrets file for that stack).
4. Do not point both Razorpay modes at the same endpoint.
5. Upload digital assets to that stack’s private bucket:

```bash
npm run upload:assets
```

That uploads `../assets/books/modern-java-preview.pdf` to
`sample/modern-java-preview.pdf`,
`../assets/books/modern-java-drm-free_v1.0.pdf` to
`digital/modern-java-drm-free_v1.0.pdf`, and
`../assets/books/modern-java-drm-free_v1.0.epub` to
`digital/modern-java-drm-free_v1.0.epub` in `DigitalAssetsBucketName`.

Sample and paid downloads are served through CloudFront with time-limited
**signed URLs** (edge-cached). The API falls back to S3 presigned URLs only if
CloudFront env vars are missing.

Sample-only upload:

```bash
./scripts/upload-digital-assets.sh --sample-only
```

6. Deploy the matching frontend (`npm run deploy:dev` or `deploy:prod` from the
   repo root) so `VITE_ORDER_API_URL` matches the stack.

For local frontend development, copy the root `.env.example` to `.env.local`
and set the **dev** API URL.

When `APP_ENV=dev`, the API skips Turnstile verification, Razorpay checkout
(orders are marked paid immediately), and Zoho invoice creation. Requests from
`http://localhost` / `http://127.0.0.1` also skip Turnstile so local Vite can
talk to a deployed API without captcha. Vite `npm run dev` (and builds with
`VITE_APP_ENV=dev`) hide Turnstile and use the no-payment checkout path.

### Verify which Razorpay environment is active

```bash
APP_ENV=dev ./scripts/validate-env.sh
# prints: Razorpay environment: dev / Razorpay key: rzp_test_****xxxx
```

Order API responses include `paymentEnvironment` and `razorpayKeyId` (public Key
ID only). Orders persist `paymentProvider: "razorpay"` and
`paymentEnvironment: "dev"|"prod"`. Historical records without
`paymentEnvironment` are treated as `dev`.

### Rotating live credentials

1. Create new live keys / webhook secret in the Razorpay dashboard.
2. Update `sam-secrets.env.prod` only.
3. Run `npm run deploy:prod` (type `PROD` when prompted).
4. Update the live-mode webhook secret in the Razorpay dashboard to match.
5. Never commit the new values; never copy them into the dev secrets file.

### Cloudflare Turnstile (bot protection)

Chapter preview, DRM-free digital checkout, paperback waitlist, contact, and
pre-Amazon reader-list forms use Turnstile.

- **Production (`APP_ENV=prod`):** captcha is mandatory (secret + token required).
- **Dev (`APP_ENV=dev`) and localhost:** captcha is skipped for faster testing.
  Vite `npm run dev` / `VITE_APP_ENV=dev` also hide the widget.

1. Create a widget at [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
   with your production (and localhost) hostnames.
2. Put the **site key** in the website env as `VITE_TURNSTILE_SITE_KEY`.
3. Put the **secret key** in `sam-secrets.env.dev` / `sam-secrets.env.prod` as
   `TurnstileSecretKey` and redeploy that environment’s API.

When either key is unset, captcha is skipped so local development still works.
Once the secret is deployed, the API rejects sample, digital, and waitlist
requests that lack a valid token.

To test DRM-free delivery on localhost without Razorpay:

1. Set `DigitalCheckoutBypassSecret` in `sam-secrets.env.dev` and run
   `npm run deploy` (dev stack).
2. In `.env.local`, set:
   - `VITE_DIGITAL_CHECKOUT_BYPASS=true`
   - `VITE_DIGITAL_CHECKOUT_BYPASS_SECRET` to the same secret
3. Run `npm run dev`, open Direct Digital, enter an email, and submit.
4. The dialog skips payment, emails download links, and shows PDF/ePub buttons.

This bypass only works in Vite `DEV` mode and when the API secret matches.
After a successful bypass (or real payment), the API also attempts to create an
invoice and attach the PDF to the confirmation email when Zoho is configured.

## Zoho Invoice (optional)

Paid digital and paperback orders create a Zoho Invoice (India DC), download the
PDF, and attach it to the SES confirmation email (no Zoho branding in the
customer message). Invoice failures are logged only — downloads and order
confirmation still succeed.

All website orders share one Zoho customer named **Website Purchase**. Each
invoice still carries the buyer name and email on the Bill To / terms block,
with the app order id in `reference_number` for tracking. Optionally pin the
shared contact with `ZOHO_WEBSITE_CONTACT_ID` in the Lambda environment.

1. Open [Zoho API Console (India)](https://api-console.zoho.in/) and create a
   **Self Client**.
2. Generate a code with scope `ZohoInvoice.fullaccess.all` (or contacts +
   invoices create/email scopes), then exchange it for a refresh token using
   your client ID and secret against
   `https://accounts.zoho.in/oauth/v2/token`.
3. In Zoho Invoice → Settings → Organization, copy the **Organization ID**.
4. Optionally copy a tax/GST ID from Settings → Taxes if invoices must show tax.
5. Put values in **`backend/sam-secrets.env.dev`** and/or
   **`backend/sam-secrets.env.prod`** (gitignored; start from
   `sam-secrets.env.example`):

```bash
ZohoClientId=...
ZohoClientSecret=...
ZohoRefreshToken=...
ZohoOrganizationId=...
ZohoTaxId=          # leave empty when no GST
ZohoTaxExemptionId= # NON TAXABLE exemption id when GST org requires it
ZohoInvoiceTemplateId= # Standard Template id for qty / unit price / total
```

6. Deploy the matching environment:

```bash
cd backend && npm run deploy:dev
# or: npm run deploy:prod
```
Until these are set, the API logs `Zoho Invoice not configured` and checkout
behaves as before.

## API

- `POST /orders` validates delivery details, calculates the amount server-side,
  creates a Razorpay order, and stores a pending order.
- `POST /orders/verify` verifies the Razorpay signature, marks the order paid,
  creates a Zoho Invoice when configured, and emails the customer and
  administrator.
- `POST /webhooks/razorpay` verifies webhook signatures and reconciles captured
  payments.
- `POST /sample-requests` records optional marketing consent and emails a
  time-limited CloudFront signed download link for the chapter preview PDF.
  On successful acceptance it returns `accepted: true` and a stable
  `sampleRequestId`, and may emit Meta CAPI `Lead` when analytics consent
  was granted.
- `POST /orders/verify` / Razorpay webhook / authorized bypass: after an order
  is marked paid, may emit Meta CAPI `Purchase` once (`metaPurchaseSentAt`
  claim). See `docs/ANALYTICS.md` for SSM token setup, Test Events, and the
  `MetaCapiEnabled` kill switch.
- `POST /marketing-consents` records Classpath Reader List / marketing opt-in
  on `SampleRequestsTable` (email PK). First valid opt-in is atomic
  (`marketingConsent` missing or false → true); only that write sends the
  transactional welcome email via SES. Duplicates return
  `already_registered` / `registration_status: already_registered` without a
  second welcome. SES failure is logged and does not undo consent or change
  the success response. New Amazon exit-modal signups use
  `marketingConsentSource = amazon_exit_modal` and `sourceVersion = "2"`;
  historical `amazon-pre-navigation` rows are not rewritten.
- `POST /marketing-consents/unsubscribe` opts the address out of marketing
  mail (no Turnstile; same success message whether or not the email existed).
- `POST /contact` accepts a Turnstile-protected contact form submission and
  emails `admin@classpath.in` (Reply-To set to the visitor address).
- `POST /digital-orders` creates a Razorpay order for the DRM-free PDF
  + ePub bundle. Customer fields are name and email only (city/ZIP are not
  collected). The normal verification endpoint emails time-limited
  CloudFront signed download links after payment (and creates a Zoho Invoice
  when configured; billing address is buyer name + email only).
- `POST /paperback-waitlist` records a unique consented waitlist entry
  (DynamoDB `PaperbackWaitlistTable`, email as primary key). Duplicate emails
  update name/city/promotional consent without creating a second row or
  resending confirmation email.

### Paperback waitlist demand export

Protected CLI (AWS credentials required; not a public API):

```bash
# Print totals, 7/30-day counts, city and UTM distributions
PAPERBACK_WAITLIST_TABLE=<table-name> node scripts/export-paperback-waitlist.js

# Also write CSV
PAPERBACK_WAITLIST_TABLE=<table-name> node scripts/export-paperback-waitlist.js --csv ./waitlist.csv
```

Table name is the CloudFormation physical ID for `PaperbackWaitlistTable`
(from `aws cloudformation describe-stack-resources` / console).

### Amazon buying-intent follow-up

For readers who entered their email and continued to Amazon
(`amazon_exit_modal` / `amazon-pre-navigation`). Purchase completion is
**unknown**, so the email:

1. Offers Classpath + Amazon buy paths first
2. Then gently asks for an honest review if they already purchased

Default delay: **7 days** after `marketingConsentAt` (covers typical Amazon
India and international delivery). Never mentions the chapter preview.
Benefits are never tied to leaving a review.

```bash
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:review-followup -- --dry-run
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:review-followup
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:review-followup -- --days 7
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:review-followup -- --email reader@example.com --force
```

Successful sends set `amazonReviewEmailSentAt` on the lead row.

### Amazon Day 21 education follow-up

After the Day 7 buying-intent email, send an editorial note with a soft
review ask (no separate review-only email).

```bash
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:amazon-education -- --dry-run
SAMPLE_REQUESTS_TABLE=<table-name> npm run send:amazon-education
```

Successful sends set `amazonEducationEmailSentAt`.

### Sample chapter nurture sequence

Trust-first cadence for chapter-preview downloads (not maximum frequency):

| Day | Email | Script |
| --: | ----- | ------ |
| 4 | Exclusive reader voucher (site digital checkout) | `send:sample-followup` |
| 10 | Educational / philosophy | `send:sample-education` |
| 18 | Final gentle format reminder | `send:sample-reminder` |

After Day 18, stop direct selling; keep readers on the Classpath Reader List
editorial cadence instead.

#### Day 4 reader vouchers

- Issued idempotently when Day 4 is sent (`VOUCHERS_TABLE`).
- Cryptographically random codes (`MJ-XXXX-XXXX`), one-time, email-bound.
- Fixed exclusive payable amount (`READER_VOUCHER_PAYABLE_INR`, default
  **₹699**) against the current Classpath digital price (`amountInr`, ₹899).
  No percentage is stored or shown in customer-facing copy.
- Campaign-wide multi-use code (`CAMPAIGN_VOUCHER_CODE`, default
  **`MODERNJAVA`**) is pre-applied on digital checkout for direct site buyers
  (same ₹899 → ₹699). Personal Day-4 codes remain one-time and email-bound.
- Expiry = sample request timestamp + `READER_VOUCHER_VALIDITY_DAYS` × 24h (UTC),
  default 7 days from download — not from email send time.
- Checkout: `POST /vouchers/validate`, then `POST /digital-orders` with
  `voucherCode`. Amount is always computed server-side; voucher is reserved on
  order create and redeemed only after successful payment verification.
- Site digital checkout only (not Amazon / not paperback).
- Paid buyers become `leadStatus = CUSTOMER` on the sample-request record and
  are excluded from remaining Modern Java sample/voucher acquisition emails.

Skips:

- people who already purchased on the website (paid digital/paperback)
- anyone who already received that step’s sent timestamp
- unsubscribed leads (`marketingUnsubscribedAt`) or withdrawn marketing consent
  (`marketingConsent === false`)
- Day 4 leads whose voucher window has already closed

Later steps require the previous step’s timestamp
(`sampleFollowUpEmailSentAt` → `sampleEducationEmailSentAt` →
`sampleReminderEmailSentAt`).

Limitation: Amazon-direct purchases cannot be suppressed unless that buyer’s
email is already known from a site order or lead record.

```bash
SAMPLE_REQUESTS_TABLE=<table> ORDERS_TABLE=<orders-table> \
  VOUCHERS_TABLE=<vouchers-table> \
  npm run send:sample-followup -- --dry-run

SAMPLE_REQUESTS_TABLE=<table> ORDERS_TABLE=<orders-table> \
  npm run send:sample-education -- --dry-run

SAMPLE_REQUESTS_TABLE=<table> ORDERS_TABLE=<orders-table> \
  npm run send:sample-reminder -- --dry-run
```

### Recommended editorial cadences (manual)

These are not automated send scripts yet—use them when composing newsletters:

- **Classpath Reader List:** about one email every 2 weeks (max two per month).
  Value first: articles, tips, behind-the-scenes, occasional book news.
- **Paperback priority list:** confirmation immediately; behind-the-scenes at
  ~2 weeks; then monthly print-progress updates until launch.
- **Purchase customers:** receipt immediately; practical article ~14 days;
  revised-edition note ~45 days; new-book announcement ~90 days. Value before
  promotions; do not keep reselling the same book.

### CloudFront digital downloads

PDF/ePub objects stay in the private `DigitalAssetsBucket`. A CloudFront
distribution (OAC + trusted key group) serves them at the edge.

- `npm run setup:cloudfront-keys` (also run automatically by `npm run deploy`)
  generates an RSA key pair under `.cloudfront-keys/` and syncs it to SSM:
  - `/modern-java/cloudfront/public-key`
  - `/modern-java/cloudfront/private-key`
- Signed links expire after 7 days (paid) or 2 days (sample), same as before.
- Re-upload with `npm run upload:assets` after replacing files so cache headers
  and CloudFront invalidation stay correct.

Razorpay secrets are backend-only. The browser receives only the public key ID.
