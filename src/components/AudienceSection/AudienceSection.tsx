import { audiences } from '../../data/audiences';
import { SectionHeading } from '../shared/SectionHeading';
import './AudienceCard.css';
import './AudienceSection.css';

export function AudienceSection() {
  return (
    <section
      className="audience-section"
      aria-labelledby="audience-heading"
    >
      <div className="section-inner">
        <SectionHeading id="audience-heading">WHO THIS BOOK IS FOR</SectionHeading>

        <div className="audience-grid">
          {audiences.map((audience) => {
            const AudienceIcon = audience.icon;

            return (
              <article key={audience.id} className="audience-card">
                <span className="audience-card__icon" aria-hidden="true">
                  <AudienceIcon size={22} strokeWidth={1.75} />
                </span>
                <p className="audience-card__label">{audience.label}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
