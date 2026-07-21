import { Star } from 'lucide-react';
import {
  purposeGoal,
  purposeIntro,
  purposePoints,
} from '../../data/purpose';
import './PurposeSection.css';

export function PurposeSection() {
  return (
    <section
      id="why-this-book"
      className="purpose-section"
      aria-labelledby="purpose-heading"
    >
      <div className="purpose-section__inner page-container">
        <div className="purpose-layout">
          <header className="purpose-intro">
            <p className="purpose-intro__eyebrow">{purposeIntro.eyebrow}</p>
            <h2 id="purpose-heading" className="purpose-intro__title">
              {purposeIntro.title}
            </h2>
            <span className="purpose-intro__rule" aria-hidden="true" />
            <p className="purpose-intro__description">
              {purposeIntro.description}
            </p>
          </header>

          <ul className="purpose-points">
            {purposePoints.map((point) => {
              const Icon = point.icon;

              return (
                <li key={point.id} className="purpose-point">
                  <span className="purpose-point__icon" aria-hidden="true">
                    <Icon size={24} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="purpose-point__title">{point.title}</h3>
                    <p className="purpose-point__description">
                      {point.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="purpose-goal">
          <span className="purpose-goal__icon" aria-hidden="true">
            <Star size={20} fill="currentColor" strokeWidth={1.5} />
          </span>
          <div>
            <p className="purpose-goal__title">{purposeGoal.title}</p>
            <p className="purpose-goal__description">
              {purposeGoal.description}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
