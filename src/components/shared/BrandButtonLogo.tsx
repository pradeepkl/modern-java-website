import { assets } from '../../data/assets';
import './shared.css';

interface BrandButtonLogoProps {
  brand: 'amazon';
  className?: string;
}

export function BrandButtonLogo({ className = '' }: BrandButtonLogoProps) {
  return (
    <img
      src={assets.formats.amazonLogo}
      alt=""
      width={48}
      height={48}
      className={`brand-button__logo brand-button__logo--amazon ${className}`}
      aria-hidden="true"
      decoding="async"
    />
  );
}
