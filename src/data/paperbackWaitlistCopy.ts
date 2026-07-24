/**
 * Waitlist-only copy. Does not replace purchase-card content in formats.ts.
 * When sales are re-enabled, PaperbackPurchaseCard continues to use formats.ts.
 *
 * Keep claims conservative until printer, paper, color, price, and timeline are final.
 */
export const paperbackWaitlistCopy = {
  sectionEyebrow: 'Paperback Edition',
  sectionHeading: 'Help shape the first print run',
  sectionLead: 'Many readers prefer technical books on paper.',
  sectionBody:
    "As an independent publisher, we're using reader interest to plan the initial paperback production. Joining the waitlist helps us estimate demand and ensures you're among the first to know when ordering opens.",
  /** Optional social proof, e.g. "83 readers have already joined the waitlist." */
  socialProof: '',
  button: 'Join the Waitlist',
  buttonNote: 'No payment required.',
  modalTitle: 'Join the Paperback Waitlist',
  modalDescription:
    "We're preparing a professionally printed paperback edition. Join the waitlist to be notified when it's ready.",
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
