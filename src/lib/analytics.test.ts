import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const metaPixelMocks = vi.hoisted(() => ({
  getConfiguredMetaPixelId: vi.fn(() => '1844493498903023'),
  initializeMetaPixel: vi.fn(),
  trackMetaEventOnce: vi.fn(),
}));

vi.mock('./metaPixel', () => ({
  getConfiguredMetaPixelId: metaPixelMocks.getConfiguredMetaPixelId,
  initializeMetaPixel: metaPixelMocks.initializeMetaPixel,
  trackMetaEventOnce: metaPixelMocks.trackMetaEventOnce,
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
    );
  });

  it('sends business-useful Purchase fields to Meta', async () => {
    const { trackPurchase } = await loadAnalytics();

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
    );
  });
});
