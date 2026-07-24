/**
 * Waitlist-only copy. Does not replace purchase-card content in formats.ts.
 * When sales are re-enabled, PaperbackPurchaseCard continues to use formats.ts.
 *
 * Keep claims conservative until printer, paper, color, price, and timeline are final.
 */
export const paperbackWaitlistCopy = {
  /** Distinct from sectionHeading — use Priority Access, not “Paperback Edition”. */
  sectionEyebrow: 'Priority Access',
  sectionHeading: 'Paperback Edition',
  sectionLead:
    'The paperback edition is currently being prepared for publication.',
  sectionBody:
    'Register your interest to receive launch updates and be notified when ordering opens. The print run will be available in limited quantities, with priority access for enrolled subscribers.',
  /** Optional social proof, e.g. "83 readers have already joined the waitlist." */
  socialProof: '',
  button: 'Notify Me',
  buttonNote: 'No payment required.',
  modalEyebrow: 'Priority Access',
  modalTitle: 'Paperback Edition',
  modalDescription:
    'Register your interest to receive launch updates and be notified when ordering opens.',
  disclaimer:
    'No payment required. We will email you when the paperback becomes available.',
  submit: 'Notify Me',
  submitting: 'Submitting…',
  successHeading: 'You’re on the Priority List',
  successMessage:
    'You are registered for paperback updates and will receive priority access when ordering opens.',
  successFollowUp:
    'As soon as printing becomes available, we’ll send an email to your registered address with the ordering options.',
  successThanks:
    'Thank you for joining the priority list for the printing.',
  alreadyRegisteredMessage:
    'You’re already registered for paperback updates and will receive priority access when ordering opens.',
  createdMessage: 'You have joined the priority list for the printing.',
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
