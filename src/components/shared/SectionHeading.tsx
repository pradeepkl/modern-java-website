import { assets } from '../../data/assets';
import { DecorativeImage } from './Icon';
import './shared.css';

interface SectionHeadingProps {
  children: string;
  as?: 'h2' | 'h3';
  id?: string;
  className?: string;
  variant?: 'default' | 'editorial' | 'landing';
}

export function SectionHeading({
  children,
  as: Tag = 'h2',
  id,
  className = '',
  variant = 'default',
}: SectionHeadingProps) {
  const variantClass =
    variant === 'editorial'
      ? 'section-heading--editorial'
      : variant === 'landing'
        ? 'section-heading--landing'
        : '';

  return (
    <Tag id={id} className={`section-heading ${variantClass} ${className}`}>
      <span className="section-heading__ornament" aria-hidden="true">
        <span className="section-heading__line" />
        <span className="section-heading__dot">•</span>
      </span>
      <span className="section-heading__text">{children}</span>
      <span className="section-heading__ornament section-heading__ornament--right" aria-hidden="true">
        <span className="section-heading__dot">•</span>
        <span className="section-heading__line" />
      </span>
      <DecorativeImage
        src={assets.decorations.sectionOrnament}
        className="section-heading__svg-ornament"
        width={56}
        height={8}
      />
    </Tag>
  );
}
