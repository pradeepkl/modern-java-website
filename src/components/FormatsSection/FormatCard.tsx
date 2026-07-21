import { useState } from 'react';
import { BookOpen, Check, ShoppingCart } from 'lucide-react';
import {
  formatVisuals,
  type FormatOption,
} from '../../data/formats';
import { BrandButtonLogo } from '../shared/BrandButtonLogo';
import { PaperbackOrderDialog } from './PaperbackOrderDialog';
import './FormatCard.css';

interface FormatCardProps {
  format: FormatOption;
}

function FormatBadgeIcon({ type }: { type: FormatOption['badgeIcon'] }) {
  if (type === 'amazon') {
    return (
      <span
        className="format-card__badge-amazon-mark"
        aria-hidden="true"
      >
        a
      </span>
    );
  }

  return <BookOpen size={26} strokeWidth={1.75} aria-hidden="true" />;
}

function FormatVisual({ visual }: { visual: FormatOption['visual'] }) {
  if (visual === 'kindle') {
    return (
      <div className="format-card__visual format-card__visual--kindle">
        <img
          src={formatVisuals.kindle}
          alt="Modern Java on tablet, phone, and laptop"
          width={280}
          height={180}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className="format-card__visual format-card__visual--paperback">
      <img
        src={formatVisuals.paperback}
        alt="Modern Java paperback edition"
        width={160}
        height={220}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function FormatCard({ format }: FormatCardProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const isPaperback = format.id === 'paperback';
  const ctaClass =
    format.ctaVariant === 'amazon'
      ? 'button button-amazon'
      : 'button button-primary';

  return (
    <>
      <article className={`format-card format-card--${format.id}`}>
        <FormatVisual visual={format.visual} />

        <div className="format-card__content">
          <div className="format-card__badge">
            <span className="format-card__badge-icon" aria-hidden="true">
              <FormatBadgeIcon type={format.badgeIcon} />
            </span>
            <span className="format-card__badge-text">{format.badge}</span>
          </div>

          <h3 className="format-card__headline">{format.headline}</h3>

          <ul className="format-card__features">
            {format.features.map((feature) => (
              <li key={feature}>
                <span className="format-card__check" aria-hidden="true">
                  <Check size={14} strokeWidth={2.5} />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="format-card__pricing">
            <div className="format-card__price-row">
              <span className="format-card__list-price">
                {format.listPrice}
              </span>
              <p className="format-card__price">{format.price}</p>
              <span className="format-card__discount">
                {format.discountLabel}
              </span>
            </div>
            <p className="format-card__availability">{format.availability}</p>
          </div>

          {isPaperback ? (
            <button
              type="button"
              className={`${ctaClass} format-card__cta`}
              onClick={() => setOrderFormOpen(true)}
            >
              <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" />
              {format.ctaLabel}
            </button>
          ) : (
            <a
              href={format.ctaUrl}
              className={`${ctaClass} format-card__cta`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BrandButtonLogo brand="amazon" />
              {format.ctaLabel}
            </a>
          )}
        </div>
      </article>

      {isPaperback ? (
        <PaperbackOrderDialog
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
        />
      ) : null}
    </>
  );
}
