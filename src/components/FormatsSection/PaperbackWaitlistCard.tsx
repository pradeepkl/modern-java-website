import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { type FormatOption } from '../../data/formats';
import { paperbackWaitlistCopy } from '../../data/paperbackWaitlistCopy';
import { getUtmProps, track } from '../../lib/analytics';
import { FormatCardShell } from './FormatCardShell';
import { PaperbackWaitlistDialog } from './PaperbackWaitlistDialog';

interface PaperbackWaitlistCardProps {
  format: FormatOption;
}

export function PaperbackWaitlistCard({ format }: PaperbackWaitlistCardProps) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const notifyButtonRef = useRef<HTMLButtonElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          if (viewed.current) continue;
          viewed.current = true;
          const utm = getUtmProps();
          track('format_card_view', { format: format.id });
          track('paperback_waitlist_card_view', {
            page_path:
              typeof window !== 'undefined' ? window.location.pathname : '/',
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
          });
          observer.disconnect();
        }
      },
      { threshold: [0.5] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [format.id]);

  const openWaitlist = () => {
    track('paperback_waitlist_open', { location: 'pricing_card' });
    setWaitlistOpen(true);
  };

  const closeWaitlist = () => {
    setWaitlistOpen(false);
    queueMicrotask(() => notifyButtonRef.current?.focus());
  };

  return (
    <>
      <FormatCardShell
        cardRef={cardRef}
        formatId={format.id}
        badge={paperbackWaitlistCopy.badge}
        badgeIcon={format.badgeIcon}
        headline={paperbackWaitlistCopy.headline}
        subtitle={paperbackWaitlistCopy.subtitle}
        features={paperbackWaitlistCopy.features}
      >
        <div className="format-card__pricing">
          <div className="format-card__price-row">
            <p className="format-card__price">{paperbackWaitlistCopy.status}</p>
          </div>
          <p className="format-card__availability">
            {paperbackWaitlistCopy.statusSupport}
          </p>
        </div>

        <button
          ref={notifyButtonRef}
          type="button"
          className="button button-primary format-card__cta"
          onClick={openWaitlist}
          data-testid="paperback-waitlist-button"
        >
          <Bell size={18} strokeWidth={2} aria-hidden="true" />
          {paperbackWaitlistCopy.button}
        </button>
      </FormatCardShell>

      <PaperbackWaitlistDialog open={waitlistOpen} onClose={closeWaitlist} />
    </>
  );
}
