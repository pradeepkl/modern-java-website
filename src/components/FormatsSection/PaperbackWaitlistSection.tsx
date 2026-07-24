import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getPaperbackMode } from '../../config/features';
import { paperbackWaitlistCopy } from '../../data/paperbackWaitlistCopy';
import { getUtmProps, track } from '../../lib/analytics';
import { PaperbackWaitlistDialog } from './PaperbackWaitlistDialog';
import './PaperbackWaitlistSection.css';

/**
 * Standalone paperback waitlist section — separate from the purchase grid so
 * print demand does not compete with Kindle / PDF buying decisions.
 */
export function PaperbackWaitlistSection() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const joinButtonRef = useRef<HTMLButtonElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (getPaperbackMode() !== 'waitlist') return;

    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          if (viewed.current) continue;
          viewed.current = true;
          const utm = getUtmProps();
          track('paperback_waitlist_card_view', {
            page_path:
              typeof window !== 'undefined' ? window.location.pathname : '/',
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
            location: 'waitlist_section',
          });
          observer.disconnect();
        }
      },
      { threshold: [0.5] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (getPaperbackMode() !== 'waitlist') {
    return null;
  }

  const openWaitlist = () => {
    track('paperback_waitlist_open', { location: 'waitlist_section' });
    setWaitlistOpen(true);
  };

  const closeWaitlist = () => {
    setWaitlistOpen(false);
    queueMicrotask(() => joinButtonRef.current?.focus());
  };

  return (
    <>
      <section
        ref={sectionRef}
        id="paperback-waitlist"
        className="paperback-waitlist-section"
        aria-labelledby="paperback-waitlist-heading"
        data-testid="paperback-waitlist-section"
      >
        <div className="paperback-waitlist-section__inner page-container">
          <p className="paperback-waitlist-section__eyebrow">
            <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{paperbackWaitlistCopy.sectionEyebrow}</span>
          </p>

          <h2
            id="paperback-waitlist-heading"
            className="paperback-waitlist-section__title"
          >
            {paperbackWaitlistCopy.sectionHeading}
          </h2>

          <p className="paperback-waitlist-section__lead">
            {paperbackWaitlistCopy.sectionLead}
          </p>

          <p className="paperback-waitlist-section__body">
            {paperbackWaitlistCopy.sectionBody}
          </p>

          {paperbackWaitlistCopy.socialProof ? (
            <p className="paperback-waitlist-section__social-proof">
              {paperbackWaitlistCopy.socialProof}
            </p>
          ) : null}

          <button
            ref={joinButtonRef}
            type="button"
            className="button button-primary paperback-waitlist-section__cta"
            onClick={openWaitlist}
            data-testid="paperback-waitlist-button"
          >
            {paperbackWaitlistCopy.button}
          </button>

          <p className="paperback-waitlist-section__note">
            {paperbackWaitlistCopy.buttonNote}
          </p>
        </div>
      </section>

      <PaperbackWaitlistDialog open={waitlistOpen} onClose={closeWaitlist} />
    </>
  );
}
