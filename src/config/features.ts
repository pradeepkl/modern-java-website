/**
 * Build-time feature flags (Vite `VITE_*` vars).
 *
 * Changing these requires a new frontend build and Amplify redeploy.
 *
 * Paperback UI is currently hidden (both flags false → mode: unavailable).
 * Code and dialogs remain intact; only the surface is gated.
 *
 * Show waitlist section:
 *   VITE_PAPERBACK_SALES_ENABLED=false
 *   VITE_PAPERBACK_WAITLIST_ENABLED=true
 *
 * Restore paperback ordering:
 *   VITE_PAPERBACK_SALES_ENABLED=true
 *   VITE_PAPERBACK_WAITLIST_ENABLED=false
 * then rebuild and redeploy the frontend.
 */

export type PaperbackMode = 'sales' | 'waitlist' | 'unavailable';

/** Pure mode resolution — sales wins when both flags are true. */
export function resolvePaperbackMode(
  salesEnabled: boolean,
  waitlistEnabled: boolean,
): PaperbackMode {
  if (salesEnabled) return 'sales';
  if (waitlistEnabled) return 'waitlist';
  return 'unavailable';
}

export const features = {
  paperbackSalesEnabled:
    import.meta.env.VITE_PAPERBACK_SALES_ENABLED === 'true',
  paperbackWaitlistEnabled:
    import.meta.env.VITE_PAPERBACK_WAITLIST_ENABLED === 'true',
};

if (features.paperbackSalesEnabled && features.paperbackWaitlistEnabled) {
  console.warn(
    '[features] Both paperback sales and waitlist are enabled; preferring the sales flow.',
  );
}

/** Effective paperback surface after resolving conflicting flag combinations. */
export function getPaperbackMode(): PaperbackMode {
  return resolvePaperbackMode(
    features.paperbackSalesEnabled,
    features.paperbackWaitlistEnabled,
  );
}
