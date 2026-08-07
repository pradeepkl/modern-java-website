import { CAMPAIGN_VOUCHER_PAYABLE_INR } from '../config/campaignVoucher';
import {
  formatInrAmount,
  getFormattedListPrice,
  getFormattedPrice,
  productPrices,
} from '../config/prices';
import { book } from './book';

export type FormatFeatureTone = 'core' | 'upgrade';

export interface FormatFeature {
  text: string;
  /** Upgrade extras (e.g. digital files bundled with print) use a distinct check color. */
  tone?: FormatFeatureTone;
}

export interface FormatOption {
  id: string;
  badge: string;
  badgeIcon: 'amazon' | 'book' | 'download';
  headline: string;
  subtitle: string;
  features: readonly FormatFeature[];
  price: string;
  listPrice: string;
  discountLabel: string;
  availability: string;
  versionLabel?: string;
  ctaLabel: string;
  ctaUrl?: string;
  ctaVariant: 'amazon' | 'primary';
}

/** Digital card shows campaign payable with catalog amount struck through. */
const digitalListPrice = getFormattedPrice('digital');
const digitalSalePrice = formatInrAmount(CAMPAIGN_VOUCHER_PAYABLE_INR);

export const formatOptions: FormatOption[] = [
  {
    id: 'kindle',
    badge: 'Kindle Edition',
    badgeIcon: 'amazon',
    headline: 'Read instantly anywhere',
    subtitle: 'Read anywhere, highlight as you go',
    features: [
      { text: 'Instant download' },
      { text: 'Works on all devices' },
      { text: 'Highlight, search, and take notes' },
      { text: 'Companion code on GitHub' },
    ],
    price: getFormattedPrice('kindle'),
    listPrice: getFormattedListPrice('kindle'),
    discountLabel: productPrices.discountLabel,
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
    subtitle: 'Own the files. Keep every revision',
    features: [
      { text: 'DRM-free PDF + ePub included', tone: 'upgrade' },
      { text: 'Access to future revised editions', tone: 'upgrade' },
      { text: 'Secure download links by email' },
    ],
    price: digitalSalePrice,
    listPrice: digitalListPrice,
    discountLabel: productPrices.discountLabel,
    availability: 'Delivered directly by email',
    ctaLabel: 'Buy direct',
    ctaVariant: 'primary',
  },
  {
    id: 'paperback',
    badge: 'Paperback',
    badgeIcon: 'book',
    headline: 'High-quality print edition',
    subtitle: 'Color diagrams beside your keyboard',
    features: [
      { text: 'Includes DRM-free PDF + ePub', tone: 'upgrade' },
      {
        text: 'Includes access to future revised editions',
        tone: 'upgrade',
      },
      { text: 'Premium print and paper (Color edition)' },
      { text: 'Rich-color architecture and flow diagrams' },
      { text: 'Deep reading without screen fatigue' },
    ],
    price: getFormattedPrice('paperback'),
    listPrice: getFormattedListPrice('paperback'),
    discountLabel: productPrices.discountLabel,
    availability: 'Place your order directly',
    versionLabel: 'Current version - 1',
    ctaLabel: 'Place order',
    ctaVariant: 'primary',
  },
];

export const formatBulkOrder = {
  prompt: 'Prefer to order in bulk for your team or organization?',
  ctaLabel: 'Contact the author',
  ctaUrl: `mailto:${book.email}?subject=Modern%20Java%20bulk%20order`,
} as const;
