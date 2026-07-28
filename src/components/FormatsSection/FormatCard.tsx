import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { getPaperbackMode } from '../../config/features';
import { getAmountInr } from '../../config/prices';
import { type FormatOption } from '../../data/formats';
import { track, trackMetaConversion } from '../../lib/analytics';
import { AmazonConsentLink } from '../shared/AmazonConsentLink';
import { BrandButtonLogo } from '../shared/BrandButtonLogo';
import { DigitalOrderDialog } from './DigitalOrderDialog';
import { FormatCardShell } from './FormatCardShell';
import { PaperbackPurchaseCard } from './PaperbackPurchaseCard';
import './FormatCard.css';

interface FormatCardProps {
  format: FormatOption;
}

export function FormatCard({ format }: FormatCardProps) {
  // Waitlist mode renders paperback in PaperbackWaitlistSection, not the grid.
  // Unavailable mode omits paperback from FormatsSection entirely.
  if (format.id === 'paperback') {
    if (getPaperbackMode() === 'sales') {
      return <PaperbackPurchaseCard format={format} />;
    }
    return null;
  }

  return <StandardFormatCard format={format} />;
}

function StandardFormatCard({ format }: FormatCardProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const viewed = useRef(false);
  const isDirectDigital = format.id === 'digital';
  const ctaClass =
    format.ctaVariant === 'amazon'
      ? 'button button-amazon'
      : 'button button-primary';

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          if (viewed.current) continue;
          viewed.current = true;
          track('format_card_view', { format: format.id });
          observer.disconnect();
        }
      },
      { threshold: [0.5] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [format.id]);

  const openCheckout = () => {
    track('format_cta_click', { format: format.id });
    track('checkout_open', { format: format.id });
    trackMetaConversion(`initiate-checkout:${format.id}`, 'InitiateCheckout', {
      content_name: `modern_java_${format.id}`,
      content_category: 'book_purchase',
      content_ids: [`modern_java_${format.id}`],
      content_type: 'product',
      currency: 'INR',
      value: format.id === 'digital' ? getAmountInr('digital') : undefined,
    });
    setOrderFormOpen(true);
  };

  return (
    <>
      <FormatCardShell
        cardRef={cardRef}
        formatId={format.id}
        badge={format.badge}
        badgeIcon={format.badgeIcon}
        headline={format.headline}
        subtitle={format.subtitle}
        features={format.features}
      >
        <div className="format-card__footer">
          <div className="format-card__pricing">
            <div className="format-card__price-row">
              <span className="format-card__list-price">{format.listPrice}</span>
              <p className="format-card__price">{format.price}</p>
              <span className="format-card__discount">{format.discountLabel}</span>
            </div>
            <div className="format-card__version-slot">
              {format.versionLabel ? (
                <span className="format-card__version">{format.versionLabel}</span>
              ) : null}
            </div>
            <p className="format-card__availability">{format.availability}</p>
          </div>

          {isDirectDigital ? (
            <button
              type="button"
              className={`${ctaClass} format-card__cta`}
              onClick={openCheckout}
            >
              <Download size={18} strokeWidth={2} aria-hidden="true" />
              {format.ctaLabel}
            </button>
          ) : format.ctaUrl ? (
            <AmazonConsentLink
              href={format.ctaUrl}
              className={`${ctaClass} format-card__cta`}
              buttonLocation="format_card"
              onIntent={() =>
                track('format_cta_click', { format: format.id })
              }
            >
              <BrandButtonLogo brand="amazon" />
              {format.ctaLabel}
            </AmazonConsentLink>
          ) : null}
        </div>
      </FormatCardShell>

      {isDirectDigital ? (
        <DigitalOrderDialog
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
        />
      ) : null}
    </>
  );
}
