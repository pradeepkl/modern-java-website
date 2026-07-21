import { positioningChecklist } from '../../data/learning';
import { CheckList } from '../shared/CheckList';
import './PositioningSection.css';

export function PositioningSection() {
  return (
    <section
      id="about-the-book"
      className="positioning-section"
      aria-labelledby="positioning-heading"
    >
      <div className="section-inner positioning-section__inner">
        <div className="positioning-section__left">
          <h2 id="positioning-heading" className="positioning-section__heading">
            MODERN JAVA IS NOT A VERSION NUMBER.
            <span className="positioning-section__highlight"> IT IS A MINDSET.</span>
          </h2>
          <div className="positioning-section__body">
            <p>
              Modern Java isn&apos;t about fewer lines. It&apos;s about less code you
              have to reason about—and a compiler that enforces what you used to
              keep in your head.
            </p>
            <p>
              Modern Java: The Mindset Shift is for developers who know classes,
              collections, and inheritance but still carry habits from older Java
              codebases.
            </p>
          </div>
        </div>

        <div className="positioning-section__divider" aria-hidden="true" />

        <CheckList items={positioningChecklist} light className="positioning-section__checklist" />
      </div>
    </section>
  );
}
