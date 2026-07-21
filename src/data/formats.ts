import { assets } from './assets';
import { book } from './book';

export interface FormatTrustItem {
  id: string;
  title: string;
  description: string;
  icon: 'shield' | 'refresh' | 'globe';
}

export interface FormatOption {
  id: string;
  badge: string;
  badgeIcon: 'amazon' | 'book' | 'book-open';
  headline: string;
  features: readonly string[];
  price: string;
  availability: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaVariant: 'amazon' | 'primary' | 'outline';
  learnMoreLabel: string;
  learnMoreUrl: string;
  visual: 'kindle' | 'paperback' | 'leanpub';
}

export const formatTrustItems: FormatTrustItem[] = [
  {
    id: 'secure',
    title: 'Secure Checkout',
    description: 'Safe and trusted payment through our partners.',
    icon: 'shield',
  },
  {
    id: 'updates',
    title: 'Free Updates',
    description: 'Get updates and improvements at no extra cost.',
    icon: 'refresh',
  },
  {
    id: 'shipping',
    title: 'Global Shipping',
    description: 'Paperbacks ship worldwide from trusted partners.',
    icon: 'globe',
  },
];

export const formatOptions: FormatOption[] = [
  {
    id: 'kindle',
    badge: 'Kindle Edition',
    badgeIcon: 'amazon',
    headline: 'Read instantly anywhere',
    features: [
      'Instant download',
      'Works on all devices',
      'Highlight, search, and take notes',
      'Pay once, read forever',
    ],
    price: '$9.99 USD',
    availability: 'Available now on Amazon',
    ctaLabel: 'Buy on Amazon',
    ctaUrl: book.amazonUrl,
    ctaVariant: 'amazon',
    learnMoreLabel: 'Learn more about Kindle edition',
    learnMoreUrl: book.amazonUrl,
    visual: 'kindle',
  },
  {
    id: 'paperback',
    badge: 'Paperback',
    badgeIcon: 'book',
    headline: 'High-quality print edition',
    features: [
      'Premium print and paper',
      'Perfect bound',
      '300+ pages',
      'Ships worldwide',
    ],
    price: '$24.99 USD',
    availability: 'Ships in 3–5 business days',
    ctaLabel: 'Buy on Amazon',
    ctaUrl: book.amazonUrl,
    ctaVariant: 'primary',
    learnMoreLabel: 'Learn more about paperback',
    learnMoreUrl: book.amazonUrl,
    visual: 'paperback',
  },
  {
    id: 'leanpub',
    badge: 'Leanpub Edition',
    badgeIcon: 'book-open',
    headline: 'Digital-first with free updates',
    features: [
      'PDF, EPUB, and MOBI',
      'Free updates for 12 months',
      'DRM-free',
      'Read on any device',
    ],
    price: '$19.99 USD',
    availability: 'Instant access after purchase',
    ctaLabel: 'Buy on Leanpub',
    ctaUrl: book.leanpubUrl,
    ctaVariant: 'outline',
    learnMoreLabel: 'Learn more about Leanpub edition',
    learnMoreUrl: book.leanpubUrl,
    visual: 'leanpub',
  },
];

export const formatVisuals = {
  kindle: assets.formats.devices,
  paperback: assets.hero.paperback,
  leanpubFiles: [
    { src: assets.formats.pdf, label: 'PDF' },
    { src: assets.formats.epub, label: 'EPUB' },
    { src: assets.formats.mobi, label: 'MOBI' },
  ],
} as const;

export const formatBulkOrder = {
  prompt: 'Prefer to order in bulk for your team or organization?',
  ctaLabel: 'Contact the author',
  ctaUrl: `mailto:${book.email}?subject=Modern%20Java%20bulk%20order`,
} as const;
