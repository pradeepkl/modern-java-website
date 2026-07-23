import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  TURNSTILE_SITE_KEY,
  isTurnstileConfigured,
  loadTurnstile,
} from '../../lib/turnstile';
import './TurnstileWidget.css';

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  { onTokenChange, theme = 'auto', className = '' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      onTokenChangeRef.current(null);
    },
  }));

  useEffect(() => {
    if (!isTurnstileConfigured() || !containerRef.current) return;

    let cancelled = false;

    const mount = async () => {
      try {
        await loadTurnstile();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY!,
          theme,
          size: 'flexible',
          callback: (token) => onTokenChangeRef.current(token),
          'expired-callback': () => onTokenChangeRef.current(null),
          'error-callback': () => onTokenChangeRef.current(null),
        });
      } catch {
        onTokenChangeRef.current(null);
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChangeRef.current(null);
    };
  }, [theme]);

  if (!isTurnstileConfigured()) return null;

  return (
    <div
      className={`turnstile-widget ${className}`.trim()}
      ref={containerRef}
    />
  );
});
