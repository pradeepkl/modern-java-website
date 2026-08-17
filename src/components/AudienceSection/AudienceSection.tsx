import { Check } from 'lucide-react';
import { audiences } from '../../data/audiences';
import './AudienceSection.css';

export function AudienceSection() {
  return (
    <section className="audience" aria-labelledby="audience-heading">
      <div className="page-container audience__inner">
        <h2 id="audience-heading" className="landing-heading">
          This book is for you if...
        </h2>

        <ul className="audience-list">
          {audiences.map((audience) => (
            <li key={audience.id} className="audience-list__item">
              <span className="audience-list__check" aria-hidden="true">
                <Check size={18} strokeWidth={2.5} />
              </span>
              <span>{audience.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
