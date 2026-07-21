import { PurchaseButtons } from '../shared/PurchaseButtons';
import './FinalCta.css';

export function FinalCta() {
  return (
    <section className="final-cta" aria-labelledby="final-cta-heading">
      <div className="section-inner final-cta__inner">
        <h2 id="final-cta-heading" className="final-cta__heading">
          Ready to shift your mindset?
        </h2>
        <p className="final-cta__supporting">
          Write less. Express more. Let the compiler enforce the rest.
        </p>
        <PurchaseButtons className="final-cta__buttons" />
      </div>
    </section>
  );
}
