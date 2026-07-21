import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { BrandButtonLogo } from './BrandButtonLogo';
import { Icon } from './Icon';
import './shared.css';

interface PurchaseButtonsProps {
  size?: 'default' | 'large';
  layout?: 'inline' | 'stacked';
  className?: string;
  leanpubLabel?: string;
}

export function PurchaseButtons({
  size = 'default',
  layout = 'inline',
  className = '',
  leanpubLabel = 'Buy on Leanpub',
}: PurchaseButtonsProps) {
  const sizeClass = size === 'large' ? 'button-large' : '';
  const layoutClass = layout === 'stacked' ? 'purchase-buttons--stacked' : '';
  const iconSize = size === 'large' ? 24 : 22;

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
        Buy on Amazon
      </a>
      <a
        href={book.leanpubUrl}
        className={`button button-leanpub ${sizeClass}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy Modern Java: The Mindset Shift on Leanpub"
      >
        <Icon src={assets.formats.leanpub} size={iconSize} />
        {leanpubLabel}
      </a>
    </div>
  );
}
