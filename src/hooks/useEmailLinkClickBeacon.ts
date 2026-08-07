import { useEffect } from 'react';
import { reportEmailLinkClick } from '../lib/emailLinkClick';

/** On landing, attribute ?mj_click= tokens to SAMPLE_REQUESTS_TABLE. */
export function useEmailLinkClickBeacon(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    reportEmailLinkClick();
  }, [enabled]);
}
