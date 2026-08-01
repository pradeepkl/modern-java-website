import { useState } from 'react';
import { Bell, Download, ShoppingCart } from 'lucide-react';
import { getPaperbackMode } from '../../config/features';
import {
  formatInrAmount,
  getAmountInr,
} from '../../config/prices';
import { book } from '../../data/book';
import { paperbackWaitlistCopy } from '../../data/paperbackWaitlistCopy';
import { track, trackCtaClick } from '../../lib/analytics';
import { DigitalOrderDialog } from '../FormatsSection/DigitalOrderDialog';
import { PaperbackOrderDialog } from '../FormatsSection/PaperbackOrderDialog';
import { PaperbackWaitlistDialog } from '../FormatsSection/PaperbackWaitlistDialog';
import { AmazonConsentLink } from './AmazonConsentLink';
import { BrandButtonLogo } from './BrandButtonLogo';
import './shared.css';

const KINDLE_PRICE_LABEL = formatInrAmount(getAmountInr('kindle'));
const DIGITAL_PRICE_LABEL = formatInrAmount(getAmountInr('digital'));
const PAPERBACK_PRICE_LABEL = formatInrAmount(getAmountInr('paperback'));

interface PurchaseButtonsProps {
  size?: 'default' | 'large';
  layout?: 'inline' | 'stacked';
  includeDigital?: boolean;
  linkToFormats?: boolean;
  className?: string;
}

export function PurchaseButtons({
  size = 'default',
  layout = 'inline',
  includeDigital = false,
  linkToFormats = false,
  className = '',
}: PurchaseButtonsProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [digitalOrderFormOpen, setDigitalOrderFormOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const sizeClass = size === 'large' ? 'button-large' : '';
  const layoutClass = layout === 'stacked' ? 'purchase-buttons--stacked' : '';
  const paperbackMode = getPaperbackMode();

  if (linkToFormats) {
    return (
      <div className={`purchase-buttons ${layoutClass} ${className}`}>
        <a
          href="#formats"
          className={`button button-amazon ${sizeClass}`}
          onClick={() => trackCtaClick('formats_kindle', 'purchase_buttons')}
        >
          <BrandButtonLogo brand="amazon" />
          Kindle
        </a>
        {includeDigital ? (
          <a
            href="#formats"
            className={`button button-primary ${sizeClass}`}
            onClick={() => trackCtaClick('formats_digital', 'purchase_buttons')}
          >
            <Download size={20} strokeWidth={2} aria-hidden="true" />
            PDF + ePub
          </a>
        ) : null}
        {paperbackMode !== 'unavailable' ? (
          <a
            href="#formats"
            className={`button button-primary ${sizeClass}`}
            onClick={() =>
              trackCtaClick('formats_paperback', 'purchase_buttons')
            }
          >
            {paperbackMode === 'waitlist' ? (
              <Bell size={20} strokeWidth={2} aria-hidden="true" />
            ) : (
              <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
            )}
            {paperbackMode === 'waitlist'
              ? paperbackWaitlistCopy.button
              : 'Paperback'}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`purchase-buttons ${layoutClass} ${className}`}>
      <AmazonConsentLink
        href={book.amazonUrl}
        className={`button button-amazon ${sizeClass}`}
        ariaLabel="Buy Modern Java: The Mindset Shift on Amazon"
        buttonLocation="purchase_buttons"
        onIntent={() => track('format_cta_click', { format: 'kindle' })}
      >
        <BrandButtonLogo brand="amazon" />
        {`Buy Kindle — ${KINDLE_PRICE_LABEL}`}
      </AmazonConsentLink>
      {includeDigital ? (
        <button
          type="button"
          className={`button button-primary ${sizeClass}`}
          onClick={() => {
            track('format_cta_click', { format: 'digital' });
            track('checkout_open', { format: 'digital' });
            setDigitalOrderFormOpen(true);
          }}
          aria-label="Buy the Modern Java PDF and ePub bundle"
        >
          <Download size={20} strokeWidth={2} aria-hidden="true" />
          {`Buy PDF + ePub — ${DIGITAL_PRICE_LABEL}`}
        </button>
      ) : null}
      {paperbackMode === 'sales' ? (
        <button
          type="button"
          className={`button button-primary ${sizeClass}`}
          onClick={() => {
            track('format_cta_click', { format: 'paperback' });
            track('checkout_open', { format: 'paperback' });
            setOrderFormOpen(true);
          }}
          aria-label="Place an order for the Modern Java paperback"
        >
          <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
          {`Place paperback order — ${PAPERBACK_PRICE_LABEL}`}
        </button>
      ) : null}
      {paperbackMode === 'waitlist' ? (
        <button
          type="button"
          className={`button button-primary ${sizeClass}`}
          onClick={() => {
            track('paperback_waitlist_open', { location: 'purchase_buttons' });
            setWaitlistOpen(true);
          }}
          aria-label="Get notified when the Modern Java paperback opens for ordering"
          data-testid="paperback-waitlist-button"
        >
          <Bell size={20} strokeWidth={2} aria-hidden="true" />
          {paperbackWaitlistCopy.button}
        </button>
      ) : null}
      {/* Keep purchase dialog mounted so the sales path always compiles. */}
      <PaperbackOrderDialog
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
      />
      <PaperbackWaitlistDialog
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        source="purchase_buttons"
      />
      {includeDigital ? (
        <DigitalOrderDialog
          open={digitalOrderFormOpen}
          onClose={() => setDigitalOrderFormOpen(false)}
        />
      ) : null}
    </div>
  );
}
