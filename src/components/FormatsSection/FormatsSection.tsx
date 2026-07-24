import { formatBulkOrder, formatOptions } from '../../data/formats';
import { getPaperbackMode } from '../../config/features';
import { track, trackOutboundClick } from '../../lib/analytics';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { FormatCard } from './FormatCard';
import './FormatsSection.css';

export function FormatsSection() {
  const paperbackMode = getPaperbackMode();
  const availableOnly = paperbackMode !== 'sales';
  const availableFormats = availableOnly
    ? formatOptions.filter((format) => format.id !== 'paperback')
    : formatOptions;

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
              {availableOnly ? 'Available Today' : 'Get your copy'}
            </SectionEyebrow>
            <h2 id="formats-heading" className="formats-header__title">
              Choose the format that works best for you
            </h2>
            <p className="formats-header__copy">
              {availableOnly
                ? 'Kindle and DRM-free PDF editions include the full content, code examples, and figures from Modern Java.'
                : 'All editions include the full content, code examples, and figures from Modern Java.'}
            </p>
          </div>
        </div>

        <div
          className={
            availableOnly
              ? 'formats-grid formats-grid--available'
              : 'formats-grid'
          }
        >
          {availableFormats.map((format) => (
            <FormatCard key={format.id} format={format} />
          ))}
        </div>

        <p className="formats-bulk">
          {formatBulkOrder.prompt}{' '}
          <a
            href={formatBulkOrder.ctaUrl}
            onClick={() => {
              track('format_cta_click', { format: 'bulk' });
              if (formatBulkOrder.ctaUrl) {
                trackOutboundClick(formatBulkOrder.ctaUrl, 'bulk_order');
              }
            }}
          >
            {formatBulkOrder.ctaLabel} →
          </a>
        </p>
      </div>
    </section>
  );
}
