import {
  BookOpen,
  Code2,
  Image,
  Layers,
  Puzzle,
  Rocket,
  ShieldCheck,
  Target,
  Terminal,
  Users,
} from 'lucide-react';
import { assets } from '../../data/assets';
import {
  guideAvailability,
  guideFeatures,
  guideIntro,
  guideValues,
} from '../../data/guide';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import './GuideSection.css';

const featureIcons = {
  book: BookOpen,
  code: Code2,
  layers: Layers,
  terminal: Terminal,
  diagram: Image,
} as const;

const valueIcons = {
  target: Target,
  shield: ShieldCheck,
  puzzle: Puzzle,
  rocket: Rocket,
  users: Users,
} as const;

function AvailabilityIcon({ type }: { type: 'amazon' | 'book' }) {
  if (type === 'amazon') {
    return (
      <span
        className="guide-availability__amazon-mark"
        aria-hidden="true"
      >
        a
      </span>
    );
  }

  return <BookOpen size={26} strokeWidth={1.75} aria-hidden="true" />;
}

export function GuideSection() {
  return (
    <section
      id="about-the-book"
      className="guide-section"
      aria-labelledby="guide-heading"
    >
      <div className="guide-section__inner page-container">
        <header className="guide-content">
          <SectionEyebrow className="guide-content__eyebrow">
            {guideIntro.eyebrow}
          </SectionEyebrow>
          <h2 id="guide-heading" className="guide-content__title">
            {guideIntro.title}
          </h2>
          <p className="guide-content__copy">{guideIntro.copy}</p>
        </header>

        <div className="guide-main">
          <div className="guide-cover">
            <img
              src={assets.formats.guideMockup}
              alt="Modern Java: The Mindset Shift — book cover"
              width={1600}
              height={1067}
              className="guide-cover__image"
              loading="lazy"
              decoding="async"
            />

            <div className="guide-availability" aria-label="Available in">
              <p className="guide-availability__label">Available in</p>
              <ul className="guide-availability__list">
                {guideAvailability.map((item) => (
                  <li key={item.id} title={item.label}>
                    <span className="guide-availability__icon">
                      <AvailabilityIcon type={item.icon} />
                    </span>
                    <span className="guide-availability__name">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="guide-features">
            {guideFeatures.map((feature) => {
              const FeatureIcon =
                feature.icon === 'java' ? null : featureIcons[feature.icon];

              return (
                <article key={feature.id} className="guide-feature">
                  {feature.icon === 'java' ? (
                    <span className="guide-feature__icon" aria-hidden="true">
                      <img
                        src={assets.brand.javaIcon}
                        alt=""
                        width={26}
                        height={26}
                        className="guide-feature__java-icon"
                      />
                    </span>
                  ) : (
                    <span className="guide-feature__icon" aria-hidden="true">
                      {FeatureIcon ? (
                        <FeatureIcon size={22} strokeWidth={1.75} />
                      ) : null}
                    </span>
                  )}
                  <div>
                    <h3 className="guide-feature__title">{feature.title}</h3>
                    <p className="guide-feature__description">
                      {feature.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <ul className="guide-values">
          {guideValues.map((value) => {
            const Icon = valueIcons[value.icon];
            return (
              <li key={value.id} className="guide-values__item">
                <span className="guide-values__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="guide-values__title">{value.title}</p>
                  <p className="guide-values__description">{value.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
