# Paperback Order API

AWS SAM backend for paperback orders, Razorpay payment verification, DynamoDB
storage, SES email confirmation, Zoho Invoice creation, and private S3 delivery
for the sample chapter and paid digital editions.

## Prerequisites

- AWS CLI authenticated to the target account
- AWS SAM CLI
- Razorpay API keys and a webhook secret
- Domain `classpath.in` verified in Amazon SES (`us-east-1`)
- Transactional mail sends from `no-reply@classpath.in` (Reply-To: `pradeep@classpath.in`)
- SES production access, or every customer email must also be verified while the
  account remains in the SES sandbox
- Optional: Zoho Invoice (India) OAuth credentials for automatic invoices after
  paid orders (see below)

## Deploy

```bash
cd backend
npm install
cp sam-secrets.env.example sam-secrets.env   # once; fill secrets
npm run deploy
```

`npm run deploy` runs `scripts/deploy-api.sh`, which loads **`sam-secrets.env`**
(gitignored) and deploys with those parameter overrides. Never put Zoho or
bypass secrets in `samconfig.toml`.

First-time / Razorpay keys (guided):

```bash
npm run deploy:guided
```

During guided deployment, provide:

- `RazorpayKeyId`
- `RazorpayKeySecret`
- `RazorpayWebhookSecret`
- `AdminEmail` (`pradeep@classpath.in` — primary inbox; `admin@` aliases here)
- `MailFromEmail` (`no-reply@classpath.in`)
- `ReplyToEmail` (`pradeep@classpath.in`)
- `AllowedOrigin` (the production website origin, without a trailing slash)
- `SamplePdfKey`, `DigitalPdfKey`, and `DigitalEpubKey` only if you need
  object keys other than the defaults

After deployment:

1. Copy the `OrderApiUrl` stack output into the website environment as
   `VITE_ORDER_API_URL`.
2. Configure the `RazorpayWebhookUrl` stack output in Razorpay.
3. Subscribe to the `payment.captured` webhook event.
4. Use the same webhook secret in Razorpay and the SAM deployment parameter.
5. Upload digital assets to the private bucket:

```bash
npm run upload:assets
```

That uploads `../assets/books/modern-java-preview.pdf` to
`sample/modern-java-preview.pdf`,
`../assets/books/modern-java-drm-free_v1.0.pdf` to
`digital/modern-java-drm-free_v1.0.pdf`, and
`../assets/books/modern-java-drm-free_v1.0.epub` to
`digital/modern-java-drm-free_v1.0.epub` in `DigitalAssetsBucketName`.

Sample-only upload:

```bash
./scripts/upload-digital-assets.sh --sample-only
```

6. Rebuild and deploy the website.

For local frontend development, copy the root `.env.example` to `.env.local`
and set the deployed API URL.

To test DRM-free delivery on localhost without Razorpay:

1. Set `DigitalCheckoutBypassSecret` in `sam-secrets.env` and run `npm run deploy`.
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

1. Open [Zoho API Console (India)](https://api-console.zoho.in/) and create a
   **Self Client**.
2. Generate a code with scope `ZohoInvoice.fullaccess.all` (or contacts +
   invoices create/email scopes), then exchange it for a refresh token using
   your client ID and secret against
   `https://accounts.zoho.in/oauth/v2/token`.
3. In Zoho Invoice → Settings → Organization, copy the **Organization ID**.
4. Optionally copy a tax/GST ID from Settings → Taxes if invoices must show tax.
5. Put values in **`backend/sam-secrets.env`** (gitignored; start from
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

6. Deploy:

```bash
cd backend && npm run deploy
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
  time-limited S3 download link for the sample chapter PDF.
- `POST /digital-orders` creates a ₹399 Razorpay order for the DRM-free PDF
  + ePub bundle. The normal verification endpoint emails time-limited S3
  download links after payment (and creates a Zoho Invoice when configured).

Razorpay secrets are backend-only. The browser receives only the public key ID.
