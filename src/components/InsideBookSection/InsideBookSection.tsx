import { useCallback, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Laptop,
} from 'lucide-react';
import {
  appendices,
  chapterHighlights,
  chapters,
} from '../../data/chapters';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import './InsideBookSection.css';

const highlightIcons = {
  laptop: Laptop,
  code: Code2,
  check: CheckCircle2,
} as const;

export function InsideBookSection() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const allExpanded = expandedIds.size === chapters.length;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(chapters.map((c) => c.id)));
    }
  }, [allExpanded]);

  return (
    <section
      id="inside-the-book"
      className="inside-section"
      aria-labelledby="inside-heading"
    >
      <div className="inside-section__inner page-container">
        <div className="inside-layout">
          <aside className="inside-intro">
            <SectionEyebrow className="inside-intro__eyebrow">
              Inside the book
            </SectionEyebrow>
            <h2 id="inside-heading" className="inside-intro__title">
              Explore the chapters at a glance
            </h2>
            <p className="inside-intro__copy">
              Twelve chapters designed to help you write code that communicates
              intent — using modern Java features with clarity and purpose.
            </p>

            <ul className="inside-highlights">
              {chapterHighlights.map((item) => {
                const Icon = highlightIcons[item.icon];
                return (
                  <li key={item.id} className="inside-highlights__item">
                    <span className="inside-highlights__icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="inside-main">
            <div className="inside-toc">
              <div className="inside-toc__header">
                <div className="inside-toc__heading-group">
                  <span className="inside-toc__book-icon" aria-hidden="true">
                    <BookOpen size={22} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="inside-toc__title">Table of Contents</h3>
                    <p className="inside-toc__hint">
                      Click any chapter to view its sections.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="inside-toc__expand-all"
                  onClick={handleExpandAll}
                  aria-expanded={allExpanded}
                >
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                  {allExpanded ? (
                    <ChevronUp size={16} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </div>

              <ol className="inside-toc__list">
                {chapters.map((chapter) => {
                  const isExpanded = expandedIds.has(chapter.id);
                  const panelId = `chapter-inline-${chapter.id}`;

                  return (
                    <li key={chapter.id} className="inside-toc__item">
                      <div className="inside-toc__row">
                        <button
                          type="button"
                          className="inside-toc__select"
                          onClick={() => toggleExpanded(chapter.id)}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                        >
                          <span className="inside-toc__number" aria-hidden="true">
                            {chapter.number}
                          </span>
                          <span className="inside-toc__name">
                            {chapter.fullTitle}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`inside-toc__chevron${isExpanded ? ' is-open' : ''}`}
                          onClick={() => toggleExpanded(chapter.id)}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          aria-label={
                            isExpanded
                              ? `Collapse sections for chapter ${chapter.number}`
                              : `Expand sections for chapter ${chapter.number}`
                          }
                        >
                          <ChevronDown size={18} strokeWidth={2} />
                        </button>
                      </div>

                      {isExpanded && (
                        <ul
                          id={panelId}
                          className="inside-toc__sections"
                        >
                          {chapter.sections.map((section) => (
                            <li key={section.id}>
                              {section.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="inside-toc__appendices">
                <p className="inside-toc__appendices-label">Appendices</p>
                <p className="inside-toc__appendices-items">
                  {appendices.map((item) => item.label).join('  ·  ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
