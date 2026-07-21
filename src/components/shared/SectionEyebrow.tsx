import type { ReactNode } from 'react';
import './shared.css';

interface SectionEyebrowProps {
  children: ReactNode;
  className?: string;
}

export function SectionEyebrow({
  children,
  className = '',
}: SectionEyebrowProps) {
  return (
    <p className={`section-eyebrow ${className}`}>
      <span className="section-eyebrow__line" aria-hidden="true" />
      <span>{children}</span>
      <span className="section-eyebrow__line" aria-hidden="true" />
    </p>
  );
}
