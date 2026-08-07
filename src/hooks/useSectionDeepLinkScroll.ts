import { useEffect } from 'react';
import {
  resolveSectionDeepLinkId,
  scrollToSectionId,
} from '../lib/sectionDeepLink';

/**
 * After the landing page mounts, scroll to `?section=` / `#section` targets.
 * Retries briefly so late layout (fonts/images) does not leave the hero in view.
 */
export function useSectionDeepLinkScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const timers: number[] = [];

    const run = () => {
      if (cancelled) return;
      const id = resolveSectionDeepLinkId();
      if (!id) return;
      scrollToSectionId(id);
    };

    // Native hash scroll ran before React mounted; scroll again after paint,
    // then retry while fonts/images can still shift layout.
    const raf = window.requestAnimationFrame(run);
    for (const delay of [50, 200, 500]) {
      timers.push(window.setTimeout(run, delay));
    }

    window.addEventListener('hashchange', run);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('hashchange', run);
    };
  }, [enabled]);
}
