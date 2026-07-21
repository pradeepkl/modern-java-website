import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { book } from '../../data/book';
import { PaperbackOrderDialog } from '../FormatsSection/PaperbackOrderDialog';
import { BrandButtonLogo } from './BrandButtonLogo';
import './shared.css';

interface PurchaseButtonsProps {
  size?: 'default' | 'large';
  layout?: 'inline' | 'stacked';
  className?: string;
}

export function PurchaseButtons({
  size = 'default',
  layout = 'inline',
  className = '',
}: PurchaseButtonsProps) {
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const sizeClass = size === 'large' ? 'button-large' : '';
  const layoutClass = layout === 'stacked' ? 'purchase-buttons--stacked' : '';

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
        Buy Kindle — ₹599
      </a>
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
    </div>
  );
}
