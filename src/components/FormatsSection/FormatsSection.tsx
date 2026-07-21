import { Globe, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  formatBulkOrder,
  formatOptions,
  formatTrustItems,
} from '../../data/formats';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { FormatCard } from './FormatCard';
import './FormatsSection.css';

const trustIcons = {
  shield: ShieldCheck,
  refresh: RefreshCw,
  globe: Globe,
} as const;

export function FormatsSection() {
  return (
    <section
      id="formats"
      className="formats-section"
      aria-labelledby="formats-heading"
    >
      <div className="formats-section__inner page-container">
        <div className="formats-header">
          <div className="formats-header__intro">
            <SectionEyebrow className="formats-header__eyebrow">
              Get your copy
            </SectionEyebrow>
            <h2 id="formats-heading" className="formats-header__title">
              Choose the format that works best for you
            </h2>
            <p className="formats-header__copy">
              All editions include the full content, code examples, and figures
              from Modern Java.
            </p>
          </div>

          <ul className="formats-trust">
            {formatTrustItems.map((item) => {
              const Icon = trustIcons[item.icon];
              return (
                <li key={item.id} className="formats-trust__item">
                  <span className="formats-trust__icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="formats-trust__title">{item.title}</p>
                    <p className="formats-trust__description">
                      {item.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="formats-grid">
          {formatOptions.map((format) => (
            <FormatCard key={format.id} format={format} />
          ))}
        </div>

        <p className="formats-bulk">
          {formatBulkOrder.prompt}{' '}
          <a href={formatBulkOrder.ctaUrl}>{formatBulkOrder.ctaLabel} →</a>
        </p>
      </div>
    </section>
  );
}
