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
  badgeIcon: 'amazon' | 'book';
  headline: string;
  features: readonly string[];
  price: string;
  availability: string;
  ctaLabel: string;
  ctaUrl?: string;
  ctaVariant: 'amazon' | 'primary';
  visual: 'kindle' | 'paperback';
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
    price: '₹599',
    availability: 'Available now on Amazon',
    ctaLabel: 'Buy on Amazon',
    ctaUrl: book.amazonUrl,
    ctaVariant: 'amazon',
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
    price: '₹899',
    availability: 'Place your order directly',
    ctaLabel: 'Place order',
    ctaVariant: 'primary',
    visual: 'paperback',
  },
];

export const formatVisuals = {
  kindle: assets.formats.devices,
  paperback: assets.hero.paperback,
} as const;

export const formatBulkOrder = {
  prompt: 'Prefer to order in bulk for your team or organization?',
  ctaLabel: 'Contact the author',
  ctaUrl: `mailto:${book.email}?subject=Modern%20Java%20bulk%20order`,
} as const;
