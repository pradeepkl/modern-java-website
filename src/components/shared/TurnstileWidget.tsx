import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  TURNSTILE_SITE_KEY,
  isTurnstileConfigured,
  loadTurnstile,
  type TurnstileRenderOptions,
} from '../../lib/turnstile';
import './TurnstileWidget.css';

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  /** Prefer flexible on wide viewports; auto uses compact below 480px. */
  size?: TurnstileRenderOptions['size'] | 'auto';
}

function initialAutoSize(): NonNullable<TurnstileRenderOptions['size']> {
  if (typeof window === 'undefined') return 'flexible';
  return window.matchMedia('(max-width: 480px)').matches
    ? 'compact'
    : 'flexible';
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  { onTokenChange, theme = 'auto', className = '', size = 'auto' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;
  const [resolvedSize, setResolvedSize] = useState<
    NonNullable<TurnstileRenderOptions['size']>
  >(() => (size === 'auto' ? initialAutoSize() : size));

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      onTokenChangeRef.current(null);
    },
  }));

  useEffect(() => {
    if (size !== 'auto') {
      setResolvedSize(size);
      return;
    }

    const media = window.matchMedia('(max-width: 480px)');
    const sync = () => {
      setResolvedSize(media.matches ? 'compact' : 'flexible');
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [size]);

  useEffect(() => {
    if (!isTurnstileConfigured() || !containerRef.current) return;

    let cancelled = false;

    const mount = async () => {
      try {
        await loadTurnstile();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY!,
          theme,
          size: resolvedSize,
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
  }, [theme, resolvedSize]);

  if (!isTurnstileConfigured()) return null;

  return (
    <div
      className={`turnstile-widget turnstile-widget--${resolvedSize} ${className}`.trim()}
      ref={containerRef}
    />
  );
});
