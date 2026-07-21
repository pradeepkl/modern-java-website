import {
  BookOpen,
  Code2,
  Globe,
  Quote,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import {
  featuredEndorsement,
  reviewsMoreLink,
  socialStats,
  testimonials,
  testimonialsIntro,
  type QuotePart,
} from '../../data/testimonials';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import './TestimonialsSection.css';

const statIcons = {
  users: Users,
  globe: Globe,
  shield: ShieldCheck,
  book: BookOpen,
  code: Code2,
} as const;

function Stars({ count = 5 }: { count?: number }) {
  return (
    <span className="review-stars" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }, (_, i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={0}
          fill="currentColor"
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function QuoteText({ parts }: { parts: QuotePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.highlight ? (
          <strong key={index} className="review-card__highlight">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function TestimonialsSection() {
  return (
    <section
      id="reviews"
      className="reviews-section"
      aria-labelledby="reviews-heading"
    >
      <div className="reviews-section__inner page-container">
        <div className="reviews-top">
          <aside className="reviews-intro">
            <SectionEyebrow className="reviews-intro__eyebrow">
              {testimonialsIntro.eyebrow}
            </SectionEyebrow>
            <h2 id="reviews-heading" className="reviews-intro__title">
              {testimonialsIntro.title}
            </h2>
            <p className="reviews-intro__copy">{testimonialsIntro.copy}</p>

            <div className="reviews-rating">
              <div className="reviews-rating__score-row">
                <span className="reviews-rating__score">
                  {testimonialsIntro.rating}
                </span>
                <div className="reviews-rating__stars-wrap">
                  <Stars />
                  <span className="reviews-rating__caption">
                    {testimonialsIntro.ratingCaption}
                  </span>
                </div>
              </div>
              <p className="reviews-rating__note">
                {testimonialsIntro.ratingNote}
              </p>
            </div>
          </aside>

          <div className="reviews-grid-wrap">
            <div className="reviews-grid">
              {testimonials.map((item) => (
                <article key={item.id} className="review-card">
                  <Quote
                    className="review-card__quote-icon"
                    size={22}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <p className="review-card__quote">
                    <QuoteText parts={item.quote} />
                  </p>
                  <Stars />
                  <div className="review-card__author">
                    <span
                      className="review-card__avatar"
                      style={{ backgroundColor: item.accent }}
                      aria-hidden="true"
                    >
                      {item.initials}
                    </span>
                    <div>
                      <p className="review-card__name">{item.name}</p>
                      <p className="review-card__role">{item.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <p className="reviews-more">
              <a
                href={reviewsMoreLink.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reviewsMoreLink.label}
                <span aria-hidden="true"> →</span>
              </a>
            </p>
          </div>
        </div>

        <ul className="reviews-stats">
          {socialStats.map((stat) => {
            const Icon = statIcons[stat.icon];
            return (
              <li key={stat.id} className="reviews-stats__item">
                <span className="reviews-stats__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="reviews-stats__label">{stat.label}</span>
              </li>
            );
          })}
        </ul>

        <article className="reviews-featured">
          <span
            className="reviews-featured__avatar"
            aria-hidden="true"
          >
            {featuredEndorsement.initials}
          </span>

          <div className="reviews-featured__body">
            <Quote
              className="reviews-featured__quote-icon"
              size={28}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <blockquote className="reviews-featured__quote">
              {featuredEndorsement.quote}
            </blockquote>
            <footer className="reviews-featured__attr">
              <cite className="reviews-featured__name">
                {featuredEndorsement.name}
              </cite>
              <span className="reviews-featured__role">
                {featuredEndorsement.role}
              </span>
            </footer>
          </div>

          <ul className="reviews-featured__books">
            {featuredEndorsement.books.map((bookItem) => (
              <li key={bookItem.id} className="reviews-featured__book">
                <span className="reviews-featured__book-spine" aria-hidden="true" />
                <span className="reviews-featured__book-title">
                  {bookItem.short}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
