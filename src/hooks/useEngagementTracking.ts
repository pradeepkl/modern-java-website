import { useEffect, useRef } from 'react';
import { getAmountInr } from '../config/prices';
import { getConsent, track, trackMetaConversion } from '../lib/analytics';

const SECTION_TRACK_IDS = [
  'about',
  'inside-the-book',
  'formats',
  'author',
] as const;

const SCROLL_BUCKETS = [25, 50, 75, 100] as const;

/**
 * Fires section_view (once per section at ≥50% visibility) and scroll_depth
 * buckets. No-ops until analytics consent is granted.
 */
export function useEngagementTracking(enabled: boolean): void {
  const seenSections = useRef(new Set<string>());
  const seenScroll = useRef(new Set<number>());

  useEffect(() => {
    if (!enabled) return;

    let observer: IntersectionObserver | null = null;
    let scrollHandler: (() => void) | null = null;
    let cancelled = false;

    const start = () => {
      if (cancelled || getConsent() !== 'granted') return;

      const elements = SECTION_TRACK_IDS.map((id) =>
        document.getElementById(id),
      ).filter(Boolean) as HTMLElement[];

      if (elements.length > 0) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
                continue;
              }
              const id = entry.target.id;
              if (seenSections.current.has(id)) continue;
              seenSections.current.add(id);
              track('section_view', { section_id: id });
              if (id === 'formats') {
                // Once per session via trackMetaEventOnce + local seenSections.
                trackMetaConversion('view-content:formats', 'ViewContent', {
                  content_name: 'Modern Java',
                  content_category: 'Book',
                  content_ids: ['modern_java_kindle', 'modern_java_digital'],
                  content_type: 'product',
                  value: getAmountInr('digital'),
                  currency: 'INR',
                });
              }
            }
          },
          { threshold: [0.5] },
        );
        elements.forEach((el) => observer?.observe(el));
      }

      scrollHandler = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const percent = Math.round((window.scrollY / scrollable) * 100);

        for (const bucket of SCROLL_BUCKETS) {
          if (percent >= bucket && !seenScroll.current.has(bucket)) {
            seenScroll.current.add(bucket);
            track('scroll_depth', { percent: bucket });
          }
        }
      };

      window.addEventListener('scroll', scrollHandler, { passive: true });
      scrollHandler();
    };

    start();

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'mj_analytics_consent' && event.newValue === 'granted') {
        start();
      }
    };
    window.addEventListener('storage', onStorage);

    const onConsent = () => start();
    window.addEventListener('mj:analytics-consent', onConsent);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
      }
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mj:analytics-consent', onConsent);
    };
  }, [enabled]);
}
