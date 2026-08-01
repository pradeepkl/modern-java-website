import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const metaPixelMocks = vi.hoisted(() => ({
  getConfiguredMetaPixelId: vi.fn(() => '1844493498903023'),
  initializeMetaPixel: vi.fn(),
  trackMetaEventOnce: vi.fn(),
  trackMetaCustomEvent: vi.fn(),
}));

vi.mock('./metaPixel', () => ({
  getConfiguredMetaPixelId: metaPixelMocks.getConfiguredMetaPixelId,
  initializeMetaPixel: metaPixelMocks.initializeMetaPixel,
  trackMetaEventOnce: metaPixelMocks.trackMetaEventOnce,
  trackMetaCustomEvent: metaPixelMocks.trackMetaCustomEvent,
}));

async function loadAnalytics() {
  return import('./analytics');
}

describe('analytics Meta payload sanitization', () => {
  beforeEach(() => {
    const localStore = new Map<string, string>([
      ['mj_analytics_consent', 'granted'],
    ]);
    const sessionStore = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStore.set(key, value);
      },
      removeItem: (key: string) => {
        localStore.delete(key);
      },
      clear: () => {
        localStore.clear();
      },
    });

    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionStore.set(key, value);
      },
      removeItem: (key: string) => {
        sessionStore.delete(key);
      },
      clear: () => {
        sessionStore.clear();
      },
    });

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps safe Meta context fields while stripping PII', async () => {
    const { trackMetaConversion } = await loadAnalytics();

    trackMetaConversion('lead:sample-preview', 'Lead', {
      content_name: 'sample_chapter',
      content_category: 'book_preview',
      content_ids: ['modern_java_digital'],
      source: 'sample_preview_form',
      email: 'reader@example.com',
      name: 'Pradeep Kumar',
      phone: '9999999999',
      city: 'Bengaluru',
    });

    expect(metaPixelMocks.trackMetaEventOnce).toHaveBeenCalledWith(
      'lead:sample-preview',
      'Lead',
      {
        content_name: 'sample_chapter',
        content_category: 'book_preview',
        content_ids: ['modern_java_digital'],
        source: 'sample_preview_form',
      },
      undefined,
    );
  });

  it('sends business-useful Purchase fields to Meta', async () => {
    const { trackPurchase } = await loadAnalytics();

    // value is INR rupees (e.g. ₹699 = 69900 paise), never raw paise.
    trackPurchase({
      format: 'digital',
      value: 699,
      transactionId: 'APP-123',
      paymentMethod: 'razorpay',
    });

    expect(metaPixelMocks.trackMetaEventOnce).toHaveBeenCalledWith(
      'purchase:APP-123',
      'Purchase',
      {
        currency: 'INR',
        value: 699,
        content_name: 'modern_java_digital',
        content_category: 'book_purchase',
        content_ids: ['modern_java_digital'],
        content_type: 'product',
        num_items: 1,
      },
      { eventID: 'APP-123' },
    );
  });

  it('fires AmazonClick with canonical params and AMZ- eventID', async () => {
    const {
      trackAmazonClick,
      AMAZON_CLICK_EVENT,
      AMAZON_CLICK_PARAMS,
    } = await loadAnalytics();

    const eventId = trackAmazonClick();

    expect(eventId).toMatch(/^AMZ-[0-9A-F]{12}$/);
    expect(metaPixelMocks.trackMetaCustomEvent).toHaveBeenCalledWith(
      AMAZON_CLICK_EVENT,
      { ...AMAZON_CLICK_PARAMS },
      { eventID: eventId },
    );
  });

  it('does not fire AmazonClick without analytics consent', async () => {
    localStorage.setItem('mj_analytics_consent', 'denied');
    const { trackAmazonClick } = await loadAnalytics();

    expect(trackAmazonClick()).toBeUndefined();
    expect(metaPixelMocks.trackMetaCustomEvent).not.toHaveBeenCalled();
  });

  it('createAmazonClickEventId always returns AMZ- prefixed ids', async () => {
    const { createAmazonClickEventId } = await loadAnalytics();
    const a = createAmazonClickEventId();
    const b = createAmazonClickEventId();
    expect(a).toMatch(/^AMZ-[0-9A-F]{12}$/);
    expect(b).toMatch(/^AMZ-[0-9A-F]{12}$/);
    expect(a).not.toBe(b);
  });

  it('navigateToAmazon fires AmazonClick then assigns after delay', async () => {
    vi.useFakeTimers();
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        assign: assignMock,
        href: 'https://modern-java.classpath.in/',
      },
    });

    const {
      navigateToAmazon,
      AMAZON_CLICK_NAV_DELAY_MS,
      AMAZON_CLICK_EVENT,
    } = await loadAnalytics();

    navigateToAmazon('https://www.amazon.in/dp/B0H6R4334W');

    expect(metaPixelMocks.trackMetaCustomEvent).toHaveBeenCalledWith(
      AMAZON_CLICK_EVENT,
      expect.objectContaining({
        content_name: 'Modern Java Kindle',
        destination: 'amazon',
      }),
      expect.objectContaining({ eventID: expect.stringMatching(/^AMZ-/) }),
    );
    expect(assignMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AMAZON_CLICK_NAV_DELAY_MS);
    expect(assignMock).toHaveBeenCalledWith('https://www.amazon.in/dp/B0H6R4334W');
    vi.useRealTimers();
  });

  it('reports Accept and Essential-only choices to the first-party API', async () => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { setConsent } = await loadAnalytics();
    setConsent('denied');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/analytics-consents',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: expect.stringContaining('"choice":"denied"'),
      }),
    );
  });

  it('navigateToAmazon still assigns when Meta tracking throws', async () => {
    vi.useFakeTimers();
    metaPixelMocks.trackMetaCustomEvent.mockImplementationOnce(() => {
      throw new Error('pixel blocked');
    });
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        assign: assignMock,
        href: 'https://modern-java.classpath.in/',
      },
    });

    const { navigateToAmazon, AMAZON_CLICK_NAV_DELAY_MS } = await loadAnalytics();
    expect(() =>
      navigateToAmazon('https://www.amazon.in/dp/B0H6R4334W'),
    ).not.toThrow();

    await vi.advanceTimersByTimeAsync(AMAZON_CLICK_NAV_DELAY_MS);
    expect(assignMock).toHaveBeenCalledWith('https://www.amazon.in/dp/B0H6R4334W');
    vi.useRealTimers();
  });
});
