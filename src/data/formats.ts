import {
  CAMPAIGN_VOUCHER_PAYABLE_INR,
  getCampaignVoucherPricing,
} from '../config/campaignVoucher';
import {
  formatInrAmount,
  getAmountInr,
  getFormattedListPrice,
  getFormattedPrice,
  getListAmountInr,
} from '../config/prices';
import { book } from './book';

export type FormatFeatureTone = 'core' | 'upgrade';

export interface FormatFeature {
  text: string;
  /** Upgrade extras (e.g. digital files bundled with print) use a distinct check color. */
  tone?: FormatFeatureTone;
  /** Phrase inside `text` to underline in the card. */
  underline?: string;
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
  benefit?: string;
  trustNote?: string;
}

function saveLabel(listAmountInr: number, saleAmountInr: number): string {
  const saved = listAmountInr - saleAmountInr;
  return saved > 0 ? `Save ₹${saved}` : '';
}

/** Promotional window before the 25 August edition launch. */
export const editionLaunch = {
  title: 'Get Modern Java before the Second edition launches',
  chooseLine: 'Choose Kindle or the DRM-free PDF + ePub bundle.',
  pricingEndsPrefix: 'Current pricing ends',
  pricingEndsDate: '24 August',
  bannerTitle: 'Second edition launches 25 August',
  bannerBody:
    "Buy the current edition today and you'll receive the Second edition at no extra cost when it launches.",
  bannerBodyHighlight: 'at no extra cost',
  pricesEndLabel: 'Current prices end 24 August',
  newEditionDate: '25 August',
  kindleFutureAmountInr: 799,
  digitalFutureAmountInr: getAmountInr('digital'),
  benefit:
    'Future editions included at no extra cost on launch.',
} as const;

const digitalCampaign = getCampaignVoucherPricing();
const digitalListPrice = getFormattedPrice('digital');
const digitalSalePrice = formatInrAmount(CAMPAIGN_VOUCHER_PAYABLE_INR);
const kindleSaleAmount = getAmountInr('kindle');
const kindleListAmount = editionLaunch.kindleFutureAmountInr;

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
    listPrice: formatInrAmount(kindleListAmount),
    discountLabel: saveLabel(kindleListAmount, kindleSaleAmount),
    availability: `${formatInrAmount(kindleListAmount)} from ${editionLaunch.newEditionDate}`,
    ctaLabel: 'Buy on Amazon',
    ctaUrl: book.amazonUrl,
    ctaVariant: 'amazon',
    trustNote: 'Secure purchase on Amazon',
  },
  {
    id: 'digital',
    badge: 'Direct Digital Edition',
    badgeIcon: 'download',
    headline: 'DRM-free PDF + ePub bundle',
    subtitle: 'Own the files. Keep every revision',
    features: [
      { text: 'DRM-free PDF + ePub included', tone: 'upgrade' },
      { text: 'New version released every 6 months', tone: 'upgrade', underline: '6 months' },
      { text: 'Companion codebase in a GitHub repo', tone: 'upgrade' },
      { text: 'Preview access to future books and courses', tone: 'upgrade' },
      { text: 'Secure download links by email' },
    ],
    price: digitalSalePrice,
    listPrice: digitalListPrice,
    discountLabel: saveLabel(
      digitalCampaign.basisAmountInr,
      digitalCampaign.payableAmountInr,
    ),
    availability: `${digitalListPrice} from ${editionLaunch.newEditionDate}`,
    ctaLabel: 'Buy direct',
    ctaVariant: 'primary',
    benefit: editionLaunch.benefit,
    trustNote: 'Secure delivery by email',
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
    discountLabel: saveLabel(
      getListAmountInr('paperback'),
      getAmountInr('paperback'),
    ),
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
