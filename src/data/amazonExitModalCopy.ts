/**
 * Pre-Amazon Classpath Reader List modal copy.
 *
 * Compliance: never tie discounts, offers, or other benefits to leaving an
 * Amazon review. Review wording focuses on reading experience, not purchase.
 * Never ask for review URLs, screenshots, or other proof.
 */
export const amazonExitModalCopy = {
  eyebrow: 'BEFORE YOU VISIT AMAZON',
  heading: 'Join the Classpath Reader List',
  description:
    'Get launch offers, upcoming book updates, and practical Java resources directly from the author.',
  benefits: [
    'Early access to upcoming books',
    'Reader-only launch offers',
    'Modern Java updates and practical articles',
    'Paperback availability updates',
  ],
  reviewNote:
    'After you’ve had time to read Modern Java, please consider leaving an honest review on Amazon. Reader feedback helps other Java developers decide whether the book is right for them.',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@example.com',
  consentText:
    'By joining, you agree to receive book updates, Java articles, and occasional promotional offers from Classpath. You can unsubscribe at any time.',
  primaryCta: 'Join and Continue to Amazon',
  submittingCta: 'Joining…',
  secondaryCta: 'Continue without joining',
  successHeading: 'You’re on the list',
  successMessage:
    'We’ll send you book updates, reader offers, and new Java resources.',
  successReviewNote:
    'After you’ve had time to read Modern Java, we’d appreciate an honest Amazon review.',
  alreadyOnListMessage: 'You’re already on the Classpath Reader List.',
  continueToAmazonCta: 'Continue to Amazon',
  turnstileError:
    'Verification could not load. You can try again or continue to Amazon without joining.',
  emailRequired: 'Please enter a valid email address.',
  captchaRequired: 'Please complete the captcha check before continuing.',
  apiUnavailable:
    'Email signup is unavailable right now. You can still continue to Amazon.',
  apiError:
    'Unable to save your email. You can still continue to Amazon without joining.',
  /** Phrases that must never appear in this modal (Amazon incentive policy). */
  forbiddenPhrases: [
    'leave a review to receive a discount',
    'review and claim an offer',
    'send your review link for a coupon',
    'get rewarded for reviewing',
    'after purchasing',
    'after purchase',
  ],
} as const;

export const AMAZON_EXIT_MODAL_SOURCE = 'amazon_exit_modal';
export const AMAZON_EXIT_MODAL_SOURCE_VERSION = '2';
export const AMAZON_EXIT_CONSENT_VERSION = '2026-07-24';
export const AMAZON_EXIT_CONSENT_TYPE = 'reader_list_opt_in';
