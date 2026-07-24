import { useEffect, useRef } from 'react';
import { type FormatOption } from '../../data/formats';
import { paperbackWaitlistCopy } from '../../data/paperbackWaitlistCopy';
import { track } from '../../lib/analytics';
import { FormatCardShell } from './FormatCardShell';

interface PaperbackUnavailableCardProps {
  format: FormatOption;
}

export function PaperbackUnavailableCard({
  format,
}: PaperbackUnavailableCardProps) {
  const cardRef = useRef<HTMLElement>(null);
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
          track('format_card_view', { format: format.id });
          observer.disconnect();
        }
      },
      { threshold: [0.5] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [format.id]);

  return (
    <FormatCardShell
      cardRef={cardRef}
      formatId={format.id}
      badge={format.badge}
      badgeIcon={format.badgeIcon}
      headline={format.headline}
      subtitle={format.subtitle}
      features={format.features}
    >
      <div className="format-card__pricing">
        <div className="format-card__price-row">
          <p className="format-card__price">
            {paperbackWaitlistCopy.unavailableStatus}
          </p>
        </div>
        <p className="format-card__availability">
          {paperbackWaitlistCopy.unavailableSupport}
        </p>
      </div>
    </FormatCardShell>
  );
}
