import { useEffect } from 'react';
import { getConsent } from '../../lib/analytics';
import {
  getConfiguredMetaPixelId,
  initializeMetaPixel,
  trackMetaPageView,
} from '../../lib/metaPixel';

function locationKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Authoritative Meta PageView tracker.
 *
 * Fires once per distinct pathname+search after analytics consent is granted.
 * Hash-only changes are ignored. Module-level dedupe inside trackMetaPageView
 * also covers React StrictMode double-mount in development.
 *
 * This app uses full document navigations (no React Router); popstate is
 * listened to so future client-side history changes are covered.
 */
export function MetaPageViewTracker(): null {
  useEffect(() => {
    const maybeTrack = () => {
      if (getConsent() !== 'granted') return;

      const pixelId = getConfiguredMetaPixelId();
      if (!pixelId) return;

      initializeMetaPixel(pixelId);
      trackMetaPageView(locationKey());
    };

    maybeTrack();

    const onConsent = () => maybeTrack();
    const onPopState = () => maybeTrack();

    window.addEventListener('mj:analytics-consent', onConsent);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('mj:analytics-consent', onConsent);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return null;
}
