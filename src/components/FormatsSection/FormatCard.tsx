import { useState } from 'react';
import { BookOpen, Check, Download, ShoppingCart } from 'lucide-react';
import {
  type FormatFeature,
  type FormatOption,
} from '../../data/formats';
import { AmazonConsentLink } from '../shared/AmazonConsentLink';
import { BrandButtonLogo } from '../shared/BrandButtonLogo';
import { DigitalOrderDialog } from './DigitalOrderDialog';
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

  if (type === 'download') {
    return <Download size={26} strokeWidth={1.75} aria-hidden="true" />;
  }

  return <BookOpen size={26} strokeWidth={1.75} aria-hidden="true" />;
}

function FeatureItem({
  feature,
  isUpgrade,
}: {
  feature: FormatFeature;
  isUpgrade: boolean;
}) {
  return (
    <li>
      <span
        className={
          isUpgrade
            ? 'format-card__check format-card__check--upgrade'
            : 'format-card__check'
        }
        aria-hidden="true"
      >
        <Check size={14} strokeWidth={2.5} />
      </span>
      <span>
        {feature.text}
        {isUpgrade ? (
          <span className="sr-only"> (upgrade benefit)</span>
        ) : null}
      </span>
    </li>
  );
}

export function FormatCard({ format }: FormatCardProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const isPaperback = format.id === 'paperback';
  const isDirectDigital = format.id === 'digital';
  const ctaClass =
    format.ctaVariant === 'amazon'
      ? 'button button-amazon'
      : 'button button-primary';

  const upgradeFeatures = format.features.filter(
    (feature) => feature.tone === 'upgrade',
  );
  const coreFeatures = format.features.filter(
    (feature) => feature.tone !== 'upgrade',
  );
  const showFeatureDivider =
    upgradeFeatures.length > 0 && coreFeatures.length > 0;

  return (
    <>
      <article className={`format-card format-card--${format.id}`}>
        <div className="format-card__content">
          <div className="format-card__badge">
            <span className="format-card__badge-icon" aria-hidden="true">
              <FormatBadgeIcon type={format.badgeIcon} />
            </span>
            <span className="format-card__badge-text">{format.badge}</span>
          </div>

          <h3 className="format-card__headline">{format.headline}</h3>
          <p className="format-card__subtitle">{format.subtitle}</p>

          <ul className="format-card__features">
            {upgradeFeatures.map((feature) => (
              <FeatureItem
                key={feature.text}
                feature={feature}
                isUpgrade
              />
            ))}

            {showFeatureDivider ? (
              <li className="format-card__feature-divider" aria-hidden="true">
                <span className="format-card__feature-divider-line" />
              </li>
            ) : null}

            {coreFeatures.map((feature) => (
              <FeatureItem
                key={feature.text}
                feature={feature}
                isUpgrade={false}
              />
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

          {isPaperback || isDirectDigital ? (
            <button
              type="button"
              className={`${ctaClass} format-card__cta`}
              onClick={() => setOrderFormOpen(true)}
            >
              {isDirectDigital ? (
                <Download size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" />
              )}
              {format.ctaLabel}
            </button>
          ) : format.ctaUrl ? (
            <AmazonConsentLink
              href={format.ctaUrl}
              className={`${ctaClass} format-card__cta`}
            >
              <BrandButtonLogo brand="amazon" />
              {format.ctaLabel}
            </AmazonConsentLink>
          ) : null}
        </div>
      </article>

      {isPaperback ? (
        <PaperbackOrderDialog
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
        />
      ) : null}
      {isDirectDigital ? (
        <DigitalOrderDialog
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
        />
      ) : null}
    </>
  );
}
