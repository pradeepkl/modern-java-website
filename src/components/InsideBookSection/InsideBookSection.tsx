import { chapters } from '../../data/chapters';
import './InsideBookSection.css';

export function InsideBookSection() {
  return (
    <section
      id="inside-the-book"
      className="explore"
      aria-labelledby="explore-heading"
    >
      <div className="page-container explore__inner">
        <h2 id="explore-heading" className="landing-heading">
          What you&apos;ll explore
        </h2>

        <ol className="chapter-toc">
          {chapters.map((chapter) => (
            <li key={chapter.id} className="chapter-toc__item">
              <span className="chapter-toc__number" aria-hidden="true">
                {String(chapter.number).padStart(2, '0')}
              </span>
              <div className="chapter-toc__copy">
                <h3 className="chapter-toc__title">{chapter.title}</h3>
                <p className="chapter-toc__subtitle">{chapter.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
