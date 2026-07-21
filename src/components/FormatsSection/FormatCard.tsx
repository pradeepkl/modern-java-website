import { Book, BookOpen, Check, ShoppingCart } from 'lucide-react';
import { assets } from '../../data/assets';
import {
  formatVisuals,
  type FormatOption,
} from '../../data/formats';
import { BrandButtonLogo } from '../shared/BrandButtonLogo';
import './FormatCard.css';

interface FormatCardProps {
  format: FormatOption;
}

function FormatBadgeIcon({ type }: { type: FormatOption['badgeIcon'] }) {
  if (type === 'amazon') {
    return (
      <img
        src={assets.formats.amazon}
        alt=""
        width={18}
        height={18}
        className="format-card__badge-amazon"
        aria-hidden="true"
      />
    );
  }

  if (type === 'book') {
    return <Book size={16} strokeWidth={1.75} aria-hidden="true" />;
  }

  return <BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />;
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

  if (visual === 'paperback') {
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

  return (
    <div className="format-card__visual format-card__visual--leanpub">
      {formatVisuals.leanpubFiles.map((file, index) => (
        <div
          key={file.label}
          className={`format-card__file format-card__file--${index}`}
        >
          <img
            src={file.src}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
          <span>{file.label}</span>
        </div>
      ))}
    </div>
  );
}

export function FormatCard({ format }: FormatCardProps) {
  const ctaClass =
    format.ctaVariant === 'amazon'
      ? 'button button-amazon'
      : format.ctaVariant === 'primary'
        ? 'button button-primary'
        : 'button button-secondary format-card__cta--outline';

  return (
    <article className={`format-card format-card--${format.id}`}>
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

      <FormatVisual visual={format.visual} />

      <div className="format-card__pricing">
        <p className="format-card__price">{format.price}</p>
        <p className="format-card__availability">{format.availability}</p>
      </div>

      <a
        href={format.ctaUrl}
        className={`${ctaClass} format-card__cta`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {format.ctaVariant === 'amazon' ? (
          <BrandButtonLogo brand="amazon" />
        ) : format.ctaVariant === 'primary' ? (
          <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" />
        ) : (
          <BookOpen size={18} strokeWidth={2} aria-hidden="true" />
        )}
        {format.ctaLabel}
      </a>

      <a
        href={format.learnMoreUrl}
        className="format-card__learn-more"
        target="_blank"
        rel="noopener noreferrer"
      >
        {format.learnMoreLabel}
        <span aria-hidden="true"> →</span>
      </a>
    </article>
  );
}
