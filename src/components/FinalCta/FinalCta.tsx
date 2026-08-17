import { ArrowRight } from 'lucide-react';
import { trackCtaClick } from '../../lib/analytics';
import './FinalCta.css';

export function FinalCta() {
  return (
    <section className="final-cta" aria-labelledby="final-cta-heading">
      <div className="page-container final-cta__inner">
        <p className="final-cta__eyebrow">Write Java with intent</p>
        <h2 id="final-cta-heading" className="final-cta__title">
          Ready to shift your mindset?
        </h2>
        <p className="final-cta__status">
          Write less. Express more. Let the compiler enforce the rest.
        </p>
        <a
          href="#formats"
          className="button button-primary button-large final-cta__button"
          onClick={() => trackCtaClick('choose_format', 'final_cta')}
        >
          Choose your format
          <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
