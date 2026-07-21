import { useState } from 'react';
import { Download, ShoppingCart } from 'lucide-react';
import { book } from '../../data/book';
import { DigitalOrderDialog } from '../FormatsSection/DigitalOrderDialog';
import { PaperbackOrderDialog } from '../FormatsSection/PaperbackOrderDialog';
import { BrandButtonLogo } from './BrandButtonLogo';
import './shared.css';

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
  const sizeClass = size === 'large' ? 'button-large' : '';
  const layoutClass = layout === 'stacked' ? 'purchase-buttons--stacked' : '';

  if (linkToFormats) {
    return (
      <div className={`purchase-buttons ${layoutClass} ${className}`}>
        <a href="#formats" className={`button button-amazon ${sizeClass}`}>
          <BrandButtonLogo brand="amazon" />
          Kindle
        </a>
        {includeDigital ? (
          <a href="#formats" className={`button button-primary ${sizeClass}`}>
            <Download size={20} strokeWidth={2} aria-hidden="true" />
            PDF + ePub
          </a>
        ) : null}
        <a href="#formats" className={`button button-primary ${sizeClass}`}>
          <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
          Paperback
        </a>
      </div>
    );
  }

  return (
    <div className={`purchase-buttons ${layoutClass} ${className}`}>
      <a
        href={book.amazonUrl}
        className={`button button-amazon ${sizeClass}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy Modern Java: The Mindset Shift on Amazon"
      >
        <BrandButtonLogo brand="amazon" />
        Buy Kindle — ₹499
      </a>
      {includeDigital ? (
        <button
          type="button"
          className={`button button-primary ${sizeClass}`}
          onClick={() => setDigitalOrderFormOpen(true)}
          aria-label="Buy the Modern Java PDF and ePub bundle"
        >
          <Download size={20} strokeWidth={2} aria-hidden="true" />
          Buy PDF + ePub — ₹699
        </button>
      ) : null}
      <button
        type="button"
        className={`button button-primary ${sizeClass}`}
        onClick={() => setOrderFormOpen(true)}
        aria-label="Place an order for the Modern Java paperback"
      >
        <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
        Place paperback order — ₹899
      </button>
      <PaperbackOrderDialog
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
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
