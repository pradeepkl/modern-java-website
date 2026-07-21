import { assets } from '../../data/assets';
import './shared.css';

interface BrandButtonLogoProps {
  brand: 'amazon' | 'leanpub';
  className?: string;
}

export function BrandButtonLogo({ brand, className = '' }: BrandButtonLogoProps) {
  const src = brand === 'amazon' ? assets.formats.amazonLogo : assets.formats.leanpubLogo;

  return (
    <img
      src={src}
      alt=""
      width={brand === 'amazon' ? 48 : 108}
      height={brand === 'amazon' ? 48 : 28}
      className={`brand-button__logo ${brand === 'amazon' ? 'brand-button__logo--amazon' : ''} ${className}`}
      aria-hidden="true"
      decoding="async"
    />
  );
}
