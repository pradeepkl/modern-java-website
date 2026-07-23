import { book } from './book';

export interface FormatOption {
  id: string;
  badge: string;
  badgeIcon: 'amazon' | 'book' | 'download';
  headline: string;
  features: readonly string[];
  price: string;
  listPrice: string;
  discountLabel: string;
  availability: string;
  ctaLabel: string;
  ctaUrl?: string;
  ctaVariant: 'amazon' | 'primary';
}

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
    price: '₹499',
    listPrice: '₹624',
    discountLabel: '20% off',
    availability: 'Available now on Amazon',
    ctaLabel: 'Buy on Amazon',
    ctaUrl: book.amazonUrl,
    ctaVariant: 'amazon',
  },
  {
    id: 'digital',
    badge: 'Direct Digital Edition',
    badgeIcon: 'download',
    headline: 'DRM-free PDF + ePub bundle',
    features: [
      'DRM-free PDF + ePub included',
      'Secure download links by email',
      'Access to future revised editions',
      'Optional promotional offers',
    ],
    price: '₹699',
    listPrice: '₹874',
    discountLabel: '20% off',
    availability: 'Delivered directly by email',
    ctaLabel: 'Buy direct',
    ctaVariant: 'primary',
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
      'Includes DRM-free PDF + ePub',
      'Includes access to future revised editions',
    ],
    price: '₹899',
    listPrice: '₹1,124',
    discountLabel: '20% off',
    availability: 'Place your order directly',
    ctaLabel: 'Place order',
    ctaVariant: 'primary',
  },
];

export const formatBulkOrder = {
  prompt: 'Prefer to order in bulk for your team or organization?',
  ctaLabel: 'Contact the author',
  ctaUrl: `mailto:${book.email}?subject=Modern%20Java%20bulk%20order`,
} as const;
