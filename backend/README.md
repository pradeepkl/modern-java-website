# Paperback Order API

AWS SAM backend for paperback orders, Razorpay payment verification, DynamoDB
storage, and SES email confirmation.

## Prerequisites

- AWS CLI authenticated to the target account
- AWS SAM CLI
- Razorpay API keys and a webhook secret
- `admin@classpath.in` verified in Amazon SES
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
- `AdminEmail` (`admin@classpath.in`)
- `AllowedOrigin` (the production website origin, without a trailing slash)
- `SampleChapterUrl` (the public or signed URL of the finished sample PDF)
- `DigitalPdfKey` and `DigitalEpubKey` if using object keys other than the
  defaults

After deployment:

1. Copy the `OrderApiUrl` stack output into the website environment as
   `VITE_ORDER_API_URL`.
2. Configure the `RazorpayWebhookUrl` stack output in Razorpay.
3. Subscribe to the `payment.captured` webhook event.
4. Use the same webhook secret in Razorpay and the SAM deployment parameter.
5. Rebuild and deploy the website.
6. Upload the finished digital editions to the `DigitalAssetsBucketName`
   output using the configured PDF and ePub object keys.

For local frontend development, copy the root `.env.example` to `.env.local`
and set the deployed API URL.

## API

- `POST /orders` validates delivery details, calculates the amount server-side,
  creates a Razorpay order, and stores a pending order.
- `POST /orders/verify` verifies the Razorpay signature, marks the order paid,
  and emails the customer and administrator.
- `POST /webhooks/razorpay` verifies webhook signatures and reconciles captured
  payments.
- `POST /sample-requests` records optional marketing consent and emails the
  configured sample chapter link.
- `POST /digital-orders` creates a ₹699 Razorpay order for the PDF + ePub
  bundle. The normal verification endpoint emails time-limited S3 download
  links after payment.

Razorpay secrets are backend-only. The browser receives only the public key ID.
