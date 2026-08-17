import { formatBulkOrder, formatOptions } from '../../data/formats';
import {
  getPaperbackMode,
  isDigitalSalesEnabled,
} from '../../config/features';
import { track, trackOutboundClick } from '../../lib/analytics';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { FormatCard } from './FormatCard';
import { PreviewChapterLead } from './PreviewChapterLead';
import './FormatsSection.css';

function formatsCopy(options: {
  digitalEnabled: boolean;
  paperbackSales: boolean;
}): string {
  if (options.digitalEnabled && options.paperbackSales) {
    return 'All editions include the full content, code examples, and figures from Modern Java.';
  }
  if (options.digitalEnabled) {
    return 'Kindle and DRM-free PDF editions include the full content, code examples, and figures from Modern Java.';
  }
  return 'The Kindle edition includes the full content, code examples, and figures from Modern Java.';
}

function formatsGridClass(count: number): string {
  if (count <= 1) return 'formats-grid formats-grid--single';
  if (count === 2) return 'formats-grid formats-grid--available';
  return 'formats-grid';
}

export function FormatsSection() {
  const paperbackMode = getPaperbackMode();
  const digitalEnabled = isDigitalSalesEnabled();
  const availableFormats = formatOptions.filter((format) => {
    if (format.id === 'paperback') return paperbackMode === 'sales';
    if (format.id === 'digital') return digitalEnabled;
    return true;
  });

  return (
    <section
      id="formats"
      className={
        paperbackMode === 'waitlist'
          ? 'formats-section formats-section--before-waitlist'
          : 'formats-section'
      }
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
              {formatsCopy({
                digitalEnabled,
                paperbackSales: paperbackMode === 'sales',
              })}
            </p>
          </div>
        </div>

        <div className={formatsGridClass(availableFormats.length)}>
          {availableFormats.map((format) => (
            <FormatCard key={format.id} format={format} />
          ))}
        </div>

        <PreviewChapterLead />

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
