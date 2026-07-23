/**
 * Zoho Invoice (India) helpers for paid Modern Java orders.
 * No-ops when OAuth/org env vars are incomplete.
 */

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in/oauth/v2/token';
const ZOHO_API_BASE = 'https://www.zohoapis.in/invoice/v3';

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
    throw new Error('Unable to refresh Zoho Invoice access token');
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

const billingAddressPayload = ({ city, postalCode }) => {
  const payload = {
    country: 'India',
  };
  const cityValue = String(city || '').trim();
  const zipValue = String(postalCode || '').trim();
  if (cityValue) payload.city = cityValue.slice(0, 50);
  if (zipValue) payload.zip = zipValue.slice(0, 20);
  return payload;
};

const findContactByEmailOrName = async ({ email, name }) => {
  const emailValue = String(email).trim().toLowerCase();
  const contactName = String(name || '').trim();

  const byEmail = await zohoRequest('/contacts', {
    query: { email: emailValue },
  });
  if (byEmail.contacts?.[0]?.contact_id) {
    return byEmail.contacts[0];
  }

  const bySearch = await zohoRequest('/contacts', {
    query: { search_text: emailValue },
  });
  const searchMatch = (bySearch.contacts || []).find((contact) => {
    if (String(contact.email || '').toLowerCase() === emailValue) {
      return true;
    }
    return (contact.contact_persons || []).some(
      (person) => String(person.email || '').toLowerCase() === emailValue,
    );
  });
  if (searchMatch?.contact_id) {
    return searchMatch;
  }

  if (contactName) {
    const byName = await zohoRequest('/contacts', {
      query: { contact_name: contactName },
    });
    if (byName.contacts?.[0]?.contact_id) {
      return byName.contacts[0];
    }
  }

  return null;
};

const findOrCreateContact = async ({ email, name, city, postalCode }) => {
  const contactName = contactDisplayName({ email, name }).slice(0, 100);
  const emailValue = String(email).trim().toLowerCase();
  const billingAddress = billingAddressPayload({ city, postalCode });
  const existing = await findContactByEmailOrName({
    email: emailValue,
    name: contactName,
  });

  if (existing?.contact_id) {
    const updatePayload = {
      billing_address: billingAddress,
    };
    // Avoid renaming into a duplicate contact_name when another record owns it.
    if (
      !existing.contact_name ||
      String(existing.contact_name).toLowerCase() === contactName.toLowerCase()
    ) {
      updatePayload.contact_name = contactName;
    }
    const personId = existing.contact_persons?.[0]?.contact_person_id;
    if (personId) {
      updatePayload.contact_persons = [
        {
          contact_person_id: personId,
          first_name: contactName.slice(0, 50),
          email: emailValue,
          is_primary_contact: true,
        },
      ];
    }

    try {
      await zohoRequest(`/contacts/${existing.contact_id}`, {
        method: 'PUT',
        json: updatePayload,
      });
    } catch (error) {
      console.error('Zoho contact update failed; continuing with existing contact', error);
    }

    return {
      contactId: existing.contact_id,
      contactName: existing.contact_name || contactName,
    };
  }

  try {
    const created = await zohoRequest('/contacts', {
      method: 'POST',
      json: {
        contact_name: contactName,
        contact_type: 'customer',
        email: emailValue,
        billing_address: billingAddress,
        contact_persons: [
          {
            first_name: contactName.slice(0, 50),
            email: emailValue,
            is_primary_contact: true,
          },
        ],
      },
    });

    return {
      contactId: created.contact.contact_id,
      contactName: created.contact.contact_name,
    };
  } catch (error) {
    // Name collision: reuse the existing customer with that display name.
    if (error?.zoho?.code === 3062 || /already exists/i.test(error.message || '')) {
      const collided = await findContactByEmailOrName({
        email: emailValue,
        name: contactName,
      });
      if (collided?.contact_id) {
        return {
          contactId: collided.contact_id,
          contactName: collided.contact_name || contactName,
        };
      }
      const uniqueName = `${contactName} (${emailValue})`.slice(0, 100);
      const createdUnique = await zohoRequest('/contacts', {
        method: 'POST',
        json: {
          contact_name: uniqueName,
          contact_type: 'customer',
          email: emailValue,
          billing_address: billingAddress,
          contact_persons: [
            {
              first_name: contactName.slice(0, 50),
              email: emailValue,
              is_primary_contact: true,
            },
          ],
        },
      });
      return {
        contactId: createdUnique.contact.contact_id,
        contactName: createdUnique.contact.contact_name,
      };
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
  city,
  postalCode,
  lineItems,
  referenceNumber,
  paymentId,
  paymentMode = 'Razorpay',
}) => {
  if (!isConfigured()) {
    console.info('Zoho Invoice not configured; skipping invoice creation');
    return null;
  }

  const { contactId } = await findOrCreateContact({
    email,
    name,
    city,
    postalCode,
  });
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

  const invoicePayload = {
    customer_id: contactId,
    reference_number: String(referenceNumber || '').slice(0, 100),
    date: new Date().toISOString().slice(0, 10),
    is_inclusive_tax: false,
    payment_terms: 0,
    payment_terms_label: 'Paid',
    notes:
      'This is a system-generated invoice. No signature is needed.',
    terms: 'Thank you for your purchase of Modern Java: The Mindset Shift.',
    line_items: items,
    billing_address: billingAddressPayload({ city, postalCode }),
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
  }

  let pdfBuffer = null;
  try {
    pdfBuffer = await downloadInvoicePdf(invoiceId);
    console.info('Zoho invoice PDF downloaded', {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      pdfBytes: pdfBuffer?.length || 0,
    });
  } catch (error) {
    console.error('Zoho invoice PDF download failed; sending confirmation without attachment', error);
  }

  return {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    invoiceUrl: invoice.invoice_url || null,
    pdfBuffer,
  };
};

module.exports = {
  isConfigured,
  createAndSendInvoice,
};
