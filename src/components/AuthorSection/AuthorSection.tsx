import { assets } from '../../data/assets';
import { authorProfile } from '../../data/author';
import { SocialLinks } from '../shared/SocialLinks';
import './AuthorSection.css';

export function AuthorSection() {
  return (
    <section
      id="author"
      className="author-highlight"
      aria-labelledby="author-heading"
    >
      <div className="page-container author-highlight__inner">
        <h2 id="author-heading" className="landing-heading">
          {authorProfile.eyebrow}
        </h2>

        <div className="author-highlight__card">
          <div className="author-highlight__portrait">
            <img
              src={assets.author.portrait}
              alt={authorProfile.name}
              width={148}
              height={148}
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="author-highlight__copy">
            <p className="author-highlight__role">{authorProfile.role}</p>
            <p className="author-highlight__name">{authorProfile.name}</p>
            <p className="author-highlight__intro">
              {authorProfile.introduction}
            </p>
            <p className="author-highlight__bio">{authorProfile.perspective}</p>
            <SocialLinks
              className="author-highlight__social"
              size={20}
              includeEmail={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
