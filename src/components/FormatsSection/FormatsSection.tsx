import { formatBulkOrder, formatOptions } from '../../data/formats';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { FormatCard } from './FormatCard';
import './FormatsSection.css';

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
