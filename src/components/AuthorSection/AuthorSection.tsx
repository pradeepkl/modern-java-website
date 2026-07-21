import { Quote } from 'lucide-react';
import { assets } from '../../data/assets';
import { authorFocus, authorProfile } from '../../data/author';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import { SocialLinks } from '../shared/SocialLinks';
import './AuthorSection.css';

export function AuthorSection() {
  return (
    <section
      id="author"
      className="author-section"
      aria-labelledby="author-heading"
    >
      <div className="author-section__inner page-container">
        <div className="author-profile">
          <div className="author-profile__portrait-wrap">
            <div className="author-profile__portrait-frame">
              <img
                src={assets.author.portrait}
                alt="Pradeep Kumar L"
                width={270}
                height={404}
                className="author-profile__portrait"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="author-profile__role">{authorProfile.role}</p>
            <SocialLinks
              className="author-profile__social"
              size={22}
              includeEmail={false}
            />
          </div>

          <div className="author-profile__content">
            <SectionEyebrow className="author-profile__eyebrow">
              {authorProfile.eyebrow}
            </SectionEyebrow>
            <h2 id="author-heading" className="author-profile__name">
              {authorProfile.name}
            </h2>
            <p className="author-profile__introduction">
              {authorProfile.introduction}
            </p>
            <p className="author-profile__biography">
              {authorProfile.biography}
            </p>

            <blockquote className="author-profile__quote">
              <Quote
                size={24}
                strokeWidth={1.75}
                className="author-profile__quote-icon"
                aria-hidden="true"
              />
              <p>{authorProfile.perspective}</p>
            </blockquote>

            <ul className="author-focus">
              {authorFocus.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.id} className="author-focus__item">
                    <span className="author-focus__icon" aria-hidden="true">
                      <Icon size={22} strokeWidth={1.75} />
                    </span>
                    <div>
                      <h3 className="author-focus__title">{item.title}</h3>
                      <p className="author-focus__description">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
