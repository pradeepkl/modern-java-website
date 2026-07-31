import { useEffect, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getAmountInr } from '../../config/prices';
import { type FormatOption } from '../../data/formats';
import { track, trackMetaConversion } from '../../lib/analytics';
import { FormatCardShell } from './FormatCardShell';
import { PaperbackOrderDialog } from './PaperbackOrderDialog';

interface PaperbackPurchaseCardProps {
  format: FormatOption;
}

/** Existing paperback sales card — content comes from formats.ts unchanged. */
export function PaperbackPurchaseCard({ format }: PaperbackPurchaseCardProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const viewed = useRef(false);

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
    trackMetaConversion('initiate-checkout:paperback', 'InitiateCheckout', {
      content_name: 'modern_java_paperback',
      content_category: 'book_purchase',
      content_ids: ['modern_java_paperback'],
      content_type: 'product',
      currency: 'INR',
      value: getAmountInr('paperback'),
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
              {format.listPrice !== format.price ? (
                <span className="format-card__list-price">{format.listPrice}</span>
              ) : null}
              <p className="format-card__price">{format.price}</p>
              {format.discountLabel ? (
                <span className="format-card__discount">{format.discountLabel}</span>
              ) : null}
            </div>
            <div className="format-card__version-slot">
              {format.versionLabel ? (
                <span className="format-card__version">{format.versionLabel}</span>
              ) : null}
            </div>
            <p className="format-card__availability">{format.availability}</p>
          </div>

          <button
            type="button"
            className="button button-primary format-card__cta"
            onClick={openCheckout}
          >
            <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" />
            {format.ctaLabel}
          </button>
        </div>
      </FormatCardShell>

      <PaperbackOrderDialog
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
      />
    </>
  );
}
