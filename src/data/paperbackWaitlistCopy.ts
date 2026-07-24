import type { FormatFeature } from './formats';

/**
 * Waitlist-only copy. Does not replace purchase-card content in formats.ts.
 * When sales are re-enabled, PaperbackPurchaseCard continues to use formats.ts.
 */
export const paperbackWaitlistCopy = {
  badge: 'PAPERBACK',
  headline: 'High-quality print edition',
  subtitle: 'Premium print edition with rich-color diagrams',
  features: [
    { text: 'Includes DRM-free PDF + ePub', tone: 'upgrade' },
    {
      text: 'Includes access to future revised editions',
      tone: 'upgrade',
    },
    { text: 'Premium print and paper' },
    { text: 'Rich-color architecture and flow diagrams' },
    { text: 'Deep reading without screen fatigue' },
  ] as const satisfies readonly FormatFeature[],
  status: 'Coming Soon',
  statusSupport:
    'Join the waitlist and be the first to know when the paperback becomes available.',
  button: 'Notify Me',
  modalTitle: 'Join the Paperback Waitlist',
  modalDescription:
    'Be the first to know when the premium paperback edition becomes available.',
  disclaimer:
    'No payment required. We will email you when the paperback becomes available.',
  submit: 'Join the Waitlist',
  submitting: 'Joining…',
  successHeading: 'You’re on the list',
  successMessage:
    'We will email you as soon as the paperback edition becomes available.',
  successSecondary:
    'Thank you for helping us estimate the first print run.',
  alreadyRegisteredMessage:
    'You are already on the paperback waitlist. We will notify you when it becomes available.',
  createdMessage: 'You have joined the paperback waitlist.',
  serverError:
    'We could not add you to the waitlist right now. Please try again.',
  consentLabel: 'I agree to receive updates about the paperback edition.',
  promotionalConsentLabel:
    'Also send me occasional updates about new books and offers.',
  unavailableStatus: 'Paperback unavailable',
  unavailableSupport:
    'The paperback edition is not available for purchase or waitlist signup right now.',
  validation: {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    consent: 'Please accept the paperback notification consent.',
  },
} as const;
