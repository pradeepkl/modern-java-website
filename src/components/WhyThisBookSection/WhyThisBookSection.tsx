import { whyThisBookItems } from '../../data/whyThisBook';
import { SectionHeading } from '../shared/SectionHeading';
import './WhyThisBookSection.css';

export function WhyThisBookSection() {
  return (
    <section
      id="why-this-book"
      className="why-section"
      aria-labelledby="why-heading"
    >
      <div className="why-section__inner page-container">
        <SectionHeading id="why-heading" variant="landing">
          Why this book
        </SectionHeading>

        <div className="why-grid">
          {whyThisBookItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.id} className="why-card">
                <span className="why-card__icon" aria-hidden="true">
                  <Icon size={28} strokeWidth={1.75} />
                </span>
                <div className="why-card__content">
                  <h3 className="why-card__title">{item.title}</h3>
                  <p className="why-card__description">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
