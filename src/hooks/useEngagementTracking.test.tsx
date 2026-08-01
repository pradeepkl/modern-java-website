import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAmountInr } from '../config/prices';
import { useEngagementTracking } from './useEngagementTracking';

const analyticsMocks = vi.hoisted(() => ({
  getConsent: vi.fn(() => 'granted' as const),
  track: vi.fn(),
  trackMetaConversion: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  getConsent: analyticsMocks.getConsent,
  track: analyticsMocks.track,
  trackMetaConversion: analyticsMocks.trackMetaConversion,
}));

function Harness({ enabled }: { enabled: boolean }) {
  useEngagementTracking(enabled);
  return null;
}

describe('useEngagementTracking ViewContent', () => {
  let observerCallback:
    | ((entries: IntersectionObserverEntry[]) => void)
    | null = null;

  beforeEach(() => {
    analyticsMocks.getConsent.mockReturnValue('granted');
    observerCallback = null;

    class MockIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    const formats = document.createElement('section');
    formats.id = 'formats';
    document.body.appendChild(formats);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fires ViewContent once when formats first becomes meaningfully visible', () => {
    render(<Harness enabled />);

    const target = document.getElementById('formats');
    expect(target).not.toBeNull();
    expect(observerCallback).toBeTypeOf('function');

    const entry = {
      isIntersecting: true,
      intersectionRatio: 0.6,
      target: target as Element,
    } as IntersectionObserverEntry;

    observerCallback?.([entry]);
    observerCallback?.([entry]);

    expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledWith(
      'view-content:formats',
      'ViewContent',
      {
        content_name: 'Modern Java',
        content_category: 'Book',
        content_ids: ['modern_java_kindle', 'modern_java_digital'],
        content_type: 'product',
        value: getAmountInr('digital'),
        currency: 'INR',
      },
    );
  });

  it('does not fire ViewContent without analytics consent', () => {
    analyticsMocks.getConsent.mockReturnValue('denied');
    render(<Harness enabled />);

    expect(observerCallback).toBeNull();
    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
  });
});
