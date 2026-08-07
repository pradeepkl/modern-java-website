/**
 * Shared helpers for nurture CLI send scripts.
 * Re-exports src/nurtureMail so Lambda and CLI share one implementation.
 */
const {
  createSesClient,
  buildListUnsubscribeUrl,
  sendMarketingEmail,
  resolveAdminBcc,
} = require('../src/nurtureMail');
const { isMarketingSendAllowed } = require('../src/emailDelivery');

module.exports = {
  createSesClient,
  isMarketingSendAllowed,
  buildListUnsubscribeUrl,
  sendMarketingEmail,
  resolveAdminBcc,
};
