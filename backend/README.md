# Paperback Order API

AWS SAM backend for paperback orders, Razorpay payment verification, DynamoDB
storage, SES email confirmation, and private S3 delivery for the sample chapter
and paid digital editions.

## Prerequisites

- AWS CLI authenticated to the target account
- AWS SAM CLI
- Razorpay API keys and a webhook secret
- Domain `classpath.in` verified in Amazon SES (`us-east-1`)
- Transactional mail sends from `no-reply@classpath.in` (Reply-To: `pradeep@classpath.in`)
- SES production access, or every customer email must also be verified while the
  account remains in the SES sandbox

## Deploy

```bash
cd backend
npm install
sam build
sam deploy --guided
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
`sample/modern-java-preview.pdf` in `DigitalAssetsBucketName`.

To also upload paid editions when they are ready:

```bash
DIGITAL_PDF=/path/to/modern-java.pdf \
DIGITAL_EPUB=/path/to/modern-java.epub \
npm run upload:assets
```

6. Rebuild and deploy the website.

For local frontend development, copy the root `.env.example` to `.env.local`
and set the deployed API URL.

## API

- `POST /orders` validates delivery details, calculates the amount server-side,
  creates a Razorpay order, and stores a pending order.
- `POST /orders/verify` verifies the Razorpay signature, marks the order paid,
  and emails the customer and administrator.
- `POST /webhooks/razorpay` verifies webhook signatures and reconciles captured
  payments.
- `POST /sample-requests` records optional marketing consent and emails a
  time-limited S3 download link for the sample chapter PDF.
- `POST /digital-orders` creates a ₹699 Razorpay order for the PDF + ePub
  bundle. The normal verification endpoint emails time-limited S3 download
  links after payment.

Razorpay secrets are backend-only. The browser receives only the public key ID.
