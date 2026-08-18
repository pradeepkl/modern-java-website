import { CAMPAIGN_VOUCHER_PAYABLE_INR } from '../../config/campaignVoucher';
import { editionLaunch, formatBulkOrder, formatOptions } from '../../data/formats';
import {
  formatInrAmount,
  getFormattedPrice,
} from '../../config/prices';
import {
  getPaperbackMode,
  isDigitalSalesEnabled,
} from '../../config/features';
import { track, trackOutboundClick } from '../../lib/analytics';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { FormatBadgeIcon } from './FormatCardShell';
import { FormatCard } from './FormatCard';
import { PreviewChapterLead } from './PreviewChapterLead';
import './FormatsSection.css';

function highlightPhrase(text: string, phrase: string) {
  const index = text.indexOf(phrase);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <strong>{phrase}</strong>
      {text.slice(index + phrase.length)}
    </>
  );
}

function formatsCopy(options: {
  digitalEnabled: boolean;
  paperbackSales: boolean;
}): string {
  if (options.digitalEnabled) {
    return editionLaunch.chooseLine;
  }
  if (options.paperbackSales) {
    return 'All editions include the full content, code examples, and figures from Modern Java.';
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
              {digitalEnabled
                ? editionLaunch.title
                : 'Choose the format that works best for you'}
            </h2>
            <p className="formats-header__copy">
              {formatsCopy({
                digitalEnabled,
                paperbackSales: paperbackMode === 'sales',
              })}
            </p>
            {digitalEnabled ? (
              <p className="formats-header__deadline">
                {editionLaunch.pricingEndsPrefix}{' '}
                <strong>{editionLaunch.pricingEndsDate}.</strong>
              </p>
            ) : null}
          </div>
        </div>

        {digitalEnabled ? (
          <aside className="formats-promo" aria-label="Second edition launch offer">
            <div className="formats-promo__offer">
              <span className="formats-promo__date" aria-hidden="true">
                <span className="formats-promo__date-month">AUG</span>
                <span className="formats-promo__date-day">25</span>
              </span>
              <div>
                <p className="formats-promo__title">{editionLaunch.bannerTitle}</p>
                <p className="formats-promo__body">
                  {highlightPhrase(
                    editionLaunch.bannerBody,
                    editionLaunch.bannerBodyHighlight,
                  )}
                </p>
              </div>
            </div>
            <div className="formats-promo__prices">
              <p className="formats-promo__prices-label">
                {editionLaunch.pricesEndLabel}
              </p>
              <ul>
                <li>
                  <FormatBadgeIcon type="amazon" />
                  <span>Kindle</span>
                  <span className="formats-promo__price-shift">
                    <strong>{getFormattedPrice('kindle')}</strong>
                    <span aria-hidden="true"> → </span>
                    <span className="formats-promo__future">
                      {formatInrAmount(editionLaunch.kindleFutureAmountInr)}
                    </span>
                  </span>
                </li>
                <li>
                  <FormatBadgeIcon type="download" />
                  <span>DRM-free PDF + ePub</span>
                  <span className="formats-promo__price-shift">
                    <strong>{formatInrAmount(CAMPAIGN_VOUCHER_PAYABLE_INR)}</strong>
                    <span aria-hidden="true"> → </span>
                    <span className="formats-promo__future">
                      {formatInrAmount(editionLaunch.digitalFutureAmountInr)}
                    </span>
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        ) : null}

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
