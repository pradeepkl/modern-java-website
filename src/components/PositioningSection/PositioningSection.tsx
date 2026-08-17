import { purposeGoal, purposeIntro, purposePoints } from '../../data/purpose';
import './PositioningSection.css';

export function PositioningSection() {
  return (
    <section id="about" className="positioning" aria-labelledby="positioning-heading">
      <div className="page-container positioning__inner">
        <h2 id="positioning-heading" className="landing-heading">
          {purposeIntro.eyebrow}
        </h2>

        <p className="positioning__lead">{purposeIntro.title}</p>

        <p className="positioning__body">{purposeIntro.description}</p>

        <ol className="positioning-points" aria-label="Why this book exists">
          {purposePoints.map((point, index) => (
            <li key={point.id} className="positioning-point">
              <span className="positioning-point__number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="positioning-point__copy">
                <h3 className="positioning-point__title">{point.title}</h3>
                <p className="positioning-point__description">{point.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="positioning__close">{purposeGoal.title}</p>
      </div>
    </section>
  );
}
