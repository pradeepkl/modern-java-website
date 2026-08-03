/**
 * Zoho Invoice (India) helpers for paid Modern Java orders.
 * No-ops when OAuth/org env vars are incomplete, or when APP_ENV=dev.
 *
 * All website orders share one Zoho customer ("Website Purchase"). Buyer
 * name/email go on each invoice's billing address (name + email only); order
 * id stays in reference_number for tracking.
 */

const { isDevAppEnvironment } = require('./razorpayConfig');

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in/oauth/v2/token';
const ZOHO_API_BASE = 'https://www.zohoapis.in/invoice/v3';

const WEBSITE_PURCHASE_CONTACT_NAME = 'Website Purchase';

const {
  ZOHO_CLIENT_ID = '',
  ZOHO_CLIENT_SECRET = '',
  ZOHO_REFRESH_TOKEN = '',
  ZOHO_ORGANIZATION_ID = '',
  ZOHO_TAX_ID = '',
  ZOHO_TAX_EXEMPTION_ID = '',
  ZOHO_INVOICE_TEMPLATE_ID = '',
} = process.env;

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let cachedWebsiteContactId = null;

const isConfigured = () =>
  Boolean(
    ZOHO_CLIENT_ID &&
      ZOHO_CLIENT_SECRET &&
      ZOHO_REFRESH_TOKEN &&
      ZOHO_ORGANIZATION_ID,
  );

const zohoHeaders = (accessToken) => ({
  Authorization: `Zoho-oauthtoken ${accessToken}`,
  'X-com-zoho-invoice-organizationid': ZOHO_ORGANIZATION_ID,
});

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const result = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await result.json();

  if (!result.ok || !payload.access_token) {
    console.error('Zoho token refresh failed', payload);
    const detail =
      payload.error_description ||
      payload.error ||
      payload.message ||
      `HTTP ${result.status}`;
    const error = new Error(
      `Unable to refresh Zoho Invoice access token (${detail})`,
    );
    error.zoho = payload;
    error.status = result.status;
    throw error;
  }

  cachedToken = payload.access_token;
  const expiresInSeconds = Number(payload.expires_in || 3600);
  cachedTokenExpiresAt = now + expiresInSeconds * 1000;
  return cachedToken;
};

const zohoRequest = async (path, { method = 'GET', json, query } = {}) => {
  const accessToken = await getAccessToken();
  const url = new URL(`${ZOHO_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = zohoHeaders(accessToken);
  let body;

  if (json !== undefined) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({ JSONString: JSON.stringify(json) });
  }

  const result = await fetch(url, { method, headers, body });
  const payload = await result.json().catch(() => ({}));

  if (!result.ok || (payload.code !== undefined && payload.code !== 0)) {
    const message =
      payload.message ||
      payload.error ||
      `Zoho Invoice request failed (${result.status})`;
    const error = new Error(message);
    error.zoho = payload;
    error.status = result.status;
    throw error;
  }

  return payload;
};

const contactDisplayName = ({ email, name }) =>
  String(name || '').trim() ||
  String(email || '')
    .split('@')[0]
    .replace(/[._+-]+/g, ' ')
    .trim() ||
  'Modern Java customer';

/**
 * Per-invoice Bill To block: buyer name (attention) + email (address line).
 * Name and email only — Zoho invoice create treats the whole billing_address
 * JSON as a single string capped at 100 characters (API code 15).
 */
const ZOHO_BILLING_ADDRESS_MAX_CHARS = 100;

const buildInvoiceBuyerBillingAddress = ({ email, name }) => {
  let attention = contactDisplayName({ email, name });
  let address = String(email || '')
    .trim()
    .toLowerCase();

  const serializedLength = () =>
    JSON.stringify({ attention, address }).length;

  while (
    serializedLength() > ZOHO_BILLING_ADDRESS_MAX_CHARS &&
    (attention.length > 1 || address.length > 1)
  ) {
    if (address.length >= attention.length && address.length > 1) {
      address = address.slice(0, -1);
    } else if (attention.length > 1) {
      attention = attention.slice(0, -1);
    } else {
      break;
    }
  }

  return { attention, address };
};

const findWebsitePurchaseContact = async () => {
  const pinnedId = String(process.env.ZOHO_WEBSITE_CONTACT_ID || '').trim();
  if (pinnedId) {
    return { contact_id: pinnedId, contact_name: WEBSITE_PURCHASE_CONTACT_NAME };
  }

  const byName = await zohoRequest('/contacts', {
    query: { contact_name: WEBSITE_PURCHASE_CONTACT_NAME },
  });
  const exact = (byName.contacts || []).find(
    (contact) =>
      String(contact.contact_name || '').trim().toLowerCase() ===
      WEBSITE_PURCHASE_CONTACT_NAME.toLowerCase(),
  );
  if (exact?.contact_id) {
    return exact;
  }

  const bySearch = await zohoRequest('/contacts', {
    query: { search_text: WEBSITE_PURCHASE_CONTACT_NAME },
  });
  const searchMatch = (bySearch.contacts || []).find(
    (contact) =>
      String(contact.contact_name || '').trim().toLowerCase() ===
      WEBSITE_PURCHASE_CONTACT_NAME.toLowerCase(),
  );
  return searchMatch || null;
};

const findOrCreateWebsitePurchaseContact = async () => {
  if (cachedWebsiteContactId) {
    return { contactId: cachedWebsiteContactId };
  }

  const existing = await findWebsitePurchaseContact();
  if (existing?.contact_id) {
    cachedWebsiteContactId = existing.contact_id;
    return { contactId: existing.contact_id };
  }

  try {
    const created = await zohoRequest('/contacts', {
      method: 'POST',
      json: {
        contact_name: WEBSITE_PURCHASE_CONTACT_NAME,
        contact_type: 'customer',
        company_name: 'Classpath',
        contact_persons: [
          {
            first_name: 'Website',
            last_name: 'Purchase',
            is_primary_contact: true,
          },
        ],
      },
    });
    cachedWebsiteContactId = created.contact.contact_id;
    return { contactId: created.contact.contact_id };
  } catch (error) {
    // Race / name collision: another request created it first.
    if (
      error?.zoho?.code === 3062 ||
      /already exists/i.test(error.message || '')
    ) {
      const collided = await findWebsitePurchaseContact();
      if (collided?.contact_id) {
        cachedWebsiteContactId = collided.contact_id;
        return { contactId: collided.contact_id };
      }
    }
    throw error;
  }
};

const recordInvoicePayment = async ({
  contactId,
  invoiceId,
  amount,
  paymentId,
  paymentMode = 'Razorpay',
}) => {
  const today = new Date().toISOString().slice(0, 10);
  await zohoRequest('/customerpayments', {
    method: 'POST',
    json: {
      customer_id: contactId,
      // Zoho built-in modes; store Razorpay/bypass id in reference_number.
      payment_mode: 'others',
      amount: Number(amount),
      date: today,
      description: String(paymentMode || 'Online payment').slice(0, 100),
      reference_number: String(paymentId || '').slice(0, 50) || undefined,
      invoices: [
        {
          invoice_id: invoiceId,
          amount_applied: Number(amount),
        },
      ],
    },
  });
};

const downloadInvoicePdf = async (invoiceId) => {
  const accessToken = await getAccessToken();
  const url = new URL(`${ZOHO_API_BASE}/invoices/${invoiceId}`);
  url.searchParams.set('accept', 'pdf');

  const result = await fetch(url, {
    method: 'GET',
    headers: {
      ...zohoHeaders(accessToken),
      Accept: 'application/pdf',
    },
  });

  if (!result.ok) {
    const payload = await result.text();
    console.error('Zoho invoice PDF download failed', result.status, payload);
    throw new Error('Unable to download invoice PDF');
  }

  const contentType = String(result.headers.get('content-type') || '');
  const bytes = Buffer.from(await result.arrayBuffer());
  if (!contentType.includes('pdf') && bytes.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Zoho invoice PDF response was not a PDF');
  }

  return bytes;
};

/**
 * Create a Zoho invoice and download its PDF for attachment.
 * Returns null when Zoho is not configured.
 */
const createAndSendInvoice = async ({
  email,
  name,
  lineItems,
  referenceNumber,
  paymentId,
  paymentMode = 'Razorpay',
}) => {
  if (!isConfigured()) {
    console.info('Zoho Invoice not configured; skipping invoice creation');
    return null;
  }

  if (isDevAppEnvironment()) {
    console.info('Skipping Zoho invoice creation (APP_ENV=dev)');
    return null;
  }

  const { contactId } = await findOrCreateWebsitePurchaseContact();
  const items = lineItems.map((item) => {
    const line = {
      name: item.name,
      description: item.description || '',
      rate: Number(item.rate),
      quantity: Number(item.quantity),
      // Product-style columns (qty / unit price / total), not day-rate templates.
      unit: item.unit || 'nos',
      item_total: Number(item.rate) * Number(item.quantity),
    };
    if (item.productCode) {
      line.description = [
        `Product code: ${item.productCode}`,
        line.description.replace(/^Product code:\s*\S+\.?\s*/i, '').trim(),
      ]
        .filter(Boolean)
        .join('. ');
    }
    if (ZOHO_TAX_ID) {
      line.tax_id = ZOHO_TAX_ID;
    } else if (ZOHO_TAX_EXEMPTION_ID) {
      // Indian GST orgs require tax or exemption on every line.
      line.tax_exemption_id = ZOHO_TAX_EXEMPTION_ID;
    }
    return line;
  });

  const buyerName = contactDisplayName({ email, name });
  const buyerEmail = String(email || '')
    .trim()
    .toLowerCase();

  const invoicePayload = {
    customer_id: contactId,
    reference_number: String(referenceNumber || '').slice(0, 100),
    date: new Date().toISOString().slice(0, 10),
    is_inclusive_tax: false,
    payment_terms: 0,
    payment_terms_label: 'Paid',
    // Leave notes empty so the Standard Template "Authorized Signature"
    // block is shown instead of a "no signature needed" note.
    notes: '',
    terms: [
      buyerName && buyerEmail ? `Customer: ${buyerName} <${buyerEmail}>` : null,
      'Thank you for your purchase of Modern Java - The Mindset Shift.',
    ]
      .filter(Boolean)
      .join('. '),
    line_items: items,
    billing_address: buildInvoiceBuyerBillingAddress({
      email,
      name,
    }),
  };

  if (ZOHO_INVOICE_TEMPLATE_ID) {
    invoicePayload.template_id = ZOHO_INVOICE_TEMPLATE_ID;
  }

  const created = await zohoRequest('/invoices', {
    method: 'POST',
    json: invoicePayload,
  });

  const invoice = created.invoice;
  const invoiceId = invoice.invoice_id;
  const amount = Number(invoice.total || items[0]?.rate || 0);

  let paymentWarning = null;
  try {
    await recordInvoicePayment({
      contactId,
      invoiceId,
      amount,
      paymentId,
      paymentMode,
    });
  } catch (error) {
    console.error('Zoho payment recording failed; continuing', error);
    paymentWarning = error.message || String(error);
  }

  let pdfBuffer = null;
  let pdfWarning = null;
  try {
    pdfBuffer = await downloadInvoicePdf(invoiceId);
    console.info('Zoho invoice PDF downloaded', {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      pdfBytes: pdfBuffer?.length || 0,
    });
  } catch (error) {
    console.error(
      'Zoho invoice PDF download failed; sending confirmation without attachment',
      error,
    );
    pdfWarning = error.message || String(error);
  }

  const warnings = [paymentWarning, pdfWarning].filter(Boolean);

  return {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    invoiceUrl: invoice.invoice_url || null,
    pdfBuffer,
    warning: warnings.length ? warnings.join(' | ') : null,
  };
};

module.exports = {
  isConfigured,
  createAndSendInvoice,
  WEBSITE_PURCHASE_CONTACT_NAME,
  buildInvoiceBuyerBillingAddress,
  contactDisplayName,
};
