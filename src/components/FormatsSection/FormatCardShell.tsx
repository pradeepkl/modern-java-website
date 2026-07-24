import { type ReactNode, type Ref } from 'react';
import { BookOpen, Check, Download } from 'lucide-react';
import {
  type FormatFeature,
  type FormatOption,
} from '../../data/formats';
import './FormatCard.css';

export function FormatBadgeIcon({ type }: { type: FormatOption['badgeIcon'] }) {
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

export interface FormatCardShellProps {
  formatId: string;
  badge: string;
  badgeIcon: FormatOption['badgeIcon'];
  headline: string;
  subtitle: string;
  features: readonly FormatFeature[];
  cardRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export function FormatCardShell({
  formatId,
  badge,
  badgeIcon,
  headline,
  subtitle,
  features,
  cardRef,
  children,
}: FormatCardShellProps) {
  const upgradeFeatures = features.filter(
    (feature) => feature.tone === 'upgrade',
  );
  const coreFeatures = features.filter(
    (feature) => feature.tone !== 'upgrade',
  );
  const showFeatureDivider =
    upgradeFeatures.length > 0 && coreFeatures.length > 0;

  return (
    <article
      ref={cardRef}
      className={`format-card format-card--${formatId}`}
    >
      <div className="format-card__content">
        <div className="format-card__badge">
          <span className="format-card__badge-icon" aria-hidden="true">
            <FormatBadgeIcon type={badgeIcon} />
          </span>
          <span className="format-card__badge-text">{badge}</span>
        </div>

        <h3 className="format-card__headline">{headline}</h3>
        <p className="format-card__subtitle">{subtitle}</p>

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

        {children}
      </div>
    </article>
  );
}
