import { CheckCircle2 } from 'lucide-react';
import './TrustSection.css';

const trustPoints = [
  'Written after 22 years designing enterprise systems',
  'Based on real production architectures',
  'Refined through corporate training workshops',
  'Focused on engineering decisions—not interview tricks',
  'Every chapter reviewed through practical examples',
] as const;

export function TrustSection() {
  return (
    <section
      id="why-trust-this-book"
      className="trust-section"
      aria-labelledby="trust-heading"
    >
      <div className="trust-section__inner page-container">
        <header className="trust-section__intro">
          <p className="trust-section__eyebrow">Built from experience</p>
          <h2 id="trust-heading" className="trust-section__title">
            Why you can trust this book
          </h2>
          <p className="trust-section__copy">
            Practical guidance grounded in years of building systems, teaching
            teams, and reviewing the decisions that shape production software.
          </p>
        </header>

        <ul className="trust-section__points">
          {trustPoints.map((point) => (
            <li key={point} className="trust-section__point">
              <CheckCircle2
                size={24}
                strokeWidth={1.75}
                className="trust-section__icon"
                aria-hidden="true"
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
