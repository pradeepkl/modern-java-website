import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PIXEL_ID = '1844493498903023';
const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

const consentState = vi.hoisted(() => ({ status: 'granted' as 'granted' | 'denied' | null }));

vi.mock('./analytics', () => ({
  getConsent: () => consentState.status,
}));

async function loadMetaPixel() {
  return import('./metaPixel');
}

async function loadTracker() {
  return import('../components/analytics/MetaPageViewTracker');
}

describe('metaPixel', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_META_PIXEL_ID', PIXEL_ID);
    window.history.replaceState({}, '', '/');
    consentState.status = 'granted';
  });

  afterEach(async () => {
    const { __resetMetaPixelForTests } = await loadMetaPixel();
    __resetMetaPixelForTests();
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('inserts the Meta script once and calls fbq init once', async () => {
    const { initializeMetaPixel, __resetMetaPixelForTests } =
      await loadMetaPixel();
    __resetMetaPixelForTests();

    initializeMetaPixel(PIXEL_ID);
    initializeMetaPixel(PIXEL_ID);

    const scripts = document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`);
    expect(scripts).toHaveLength(1);

    expect(window.fbq).toBeTypeOf('function');
    const queued = window.fbq?.queue ?? [];
    const initCalls = queued.filter(
      (entry) => Array.isArray(entry) && entry[0] === 'init',
    );
    expect(initCalls).toHaveLength(1);
    expect(initCalls[0]).toEqual(['init', PIXEL_ID]);
  });

  it('strips test_event_code from the URL before Pixel init', async () => {
    window.history.replaceState({}, '', '/?utm_source=meta&test_event_code=TEST25149');
    const { initializeMetaPixel, stripMetaTestEventCodeFromUrl, __resetMetaPixelForTests } =
      await loadMetaPixel();
    __resetMetaPixelForTests();

    expect(window.location.search).toContain('test_event_code=TEST25149');
    initializeMetaPixel(PIXEL_ID);
    expect(window.location.search).not.toContain('test_event_code');
    expect(window.location.search).toContain('utm_source=meta');

    window.history.replaceState({}, '', '/?test_event_code=TEST999');
    expect(stripMetaTestEventCodeFromUrl()).toBe(true);
    expect(window.location.search).toBe('');
  });

  it('does nothing when the Pixel ID is missing', async () => {
    const { initializeMetaPixel, isMetaPixelAvailable } = await loadMetaPixel();

    initializeMetaPixel('');
    initializeMetaPixel('   ');

    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
    expect(isMetaPixelAvailable()).toBe(false);
  });

  it('does nothing outside production', async () => {
    vi.stubEnv('PROD', false);
    vi.resetModules();
    const { initializeMetaPixel, __resetMetaPixelForTests } =
      await loadMetaPixel();
    __resetMetaPixelForTests();

    initializeMetaPixel(PIXEL_ID);

    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
    expect(window.fbq).toBeUndefined();
  });

  it('sends one PageView after initialization and dedupes the same location', async () => {
    const {
      initializeMetaPixel,
      trackMetaPageView,
      __resetMetaPixelForTests,
    } = await loadMetaPixel();
    __resetMetaPixelForTests();

    initializeMetaPixel(PIXEL_ID);
    trackMetaPageView();
    trackMetaPageView();
    trackMetaPageView('/');

    const queued = window.fbq?.queue ?? [];
    const pageViews = queued.filter(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'PageView',
    );
    expect(pageViews).toHaveLength(1);
  });

  it('sends another PageView after a real route change', async () => {
    const {
      initializeMetaPixel,
      trackMetaPageView,
      __resetMetaPixelForTests,
    } = await loadMetaPixel();
    __resetMetaPixelForTests();

    initializeMetaPixel(PIXEL_ID);
    trackMetaPageView('/?ref=a');

    window.history.pushState({}, '', '/privacy-policy');
    trackMetaPageView();

    const queued = window.fbq?.queue ?? [];
    const pageViews = queued.filter(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'PageView',
    );
    expect(pageViews).toHaveLength(2);
  });

  it('does not throw when fbq is blocked or unavailable', async () => {
    const {
      initializeMetaPixel,
      trackMetaPageView,
      trackMetaEvent,
      trackMetaCustomEvent,
      __resetMetaPixelForTests,
    } = await loadMetaPixel();
    __resetMetaPixelForTests();

    expect(() => trackMetaPageView()).not.toThrow();
    expect(() => trackMetaEvent('ViewContent')).not.toThrow();
    expect(() => trackMetaCustomEvent('demo')).not.toThrow();

    initializeMetaPixel(PIXEL_ID);
    delete window.fbq;

    expect(() => trackMetaPageView('/blocked')).not.toThrow();
    expect(() => trackMetaEvent('Lead', { value: 1 })).not.toThrow();
  });

  it('delegates standard and custom events after init', async () => {
    const {
      initializeMetaPixel,
      trackMetaEvent,
      trackMetaEventOnce,
      trackMetaCustomEvent,
      __resetMetaPixelForTests,
    } = await loadMetaPixel();
    __resetMetaPixelForTests();

    initializeMetaPixel(PIXEL_ID);
    trackMetaEvent('ViewContent', { content_name: 'formats', email: 'x@y.z' });
    trackMetaCustomEvent('sample_interest', { section: 'hero', phone: '123' });

    const queued = window.fbq?.queue ?? [];
    expect(queued).toContainEqual([
      'track',
      'ViewContent',
      { content_name: 'formats' },
    ]);
    expect(queued).toContainEqual([
      'trackCustom',
      'sample_interest',
      { section: 'hero' },
    ]);

    trackMetaCustomEvent(
      'AmazonClick',
      {
        content_ids: ['modern_java_kindle'],
        content_type: 'product',
        content_name: 'Modern Java Kindle',
        destination: 'amazon',
      },
      { eventID: 'AMZ-ABCDEF123456' },
    );

    expect(queued).toContainEqual([
      'trackCustom',
      'AmazonClick',
      {
        content_ids: ['modern_java_kindle'],
        content_type: 'product',
        content_name: 'Modern Java Kindle',
        destination: 'amazon',
      },
      { eventID: 'AMZ-ABCDEF123456' },
    ]);

    trackMetaEventOnce('purchase:order-123', 'Purchase', { value: 699 }, {
      eventID: 'order-123',
    });
    trackMetaEventOnce('purchase:order-123', 'Purchase', { value: 699 }, {
      eventID: 'order-123',
    });

    const purchases = queued.filter(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'Purchase',
    );
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toEqual([
      'track',
      'Purchase',
      { value: 699 },
      { eventID: 'order-123' },
    ]);
  });

  it('helpers safely no-op before initialization', async () => {
    const {
      trackMetaEvent,
      trackMetaCustomEvent,
      isMetaPixelAvailable,
      __resetMetaPixelForTests,
    } = await loadMetaPixel();
    __resetMetaPixelForTests();

    trackMetaEvent('InitiateCheckout', { value: 699 });
    trackMetaCustomEvent('early');

    expect(isMetaPixelAvailable()).toBe(false);
    expect(window.fbq).toBeUndefined();
  });
});

describe('MetaPageViewTracker', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_META_PIXEL_ID', PIXEL_ID);
    window.history.replaceState({}, '', '/');
    consentState.status = 'granted';
  });

  afterEach(async () => {
    const { __resetMetaPixelForTests } = await loadMetaPixel();
    __resetMetaPixelForTests();
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('tracks PageView when consent is already granted', async () => {
    const { __resetMetaPixelForTests } = await loadMetaPixel();
    __resetMetaPixelForTests();
    const { MetaPageViewTracker } = await loadTracker();

    render(<MetaPageViewTracker />);

    const queued = window.fbq?.queue ?? [];
    const pageViews = queued.filter(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'PageView',
    );
    expect(pageViews).toHaveLength(1);
  });

  it('does not track before consent', async () => {
    consentState.status = null;
    const { __resetMetaPixelForTests } = await loadMetaPixel();
    __resetMetaPixelForTests();
    const { MetaPageViewTracker } = await loadTracker();

    render(<MetaPageViewTracker />);

    expect(window.fbq).toBeUndefined();
    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
  });

  it('tracks after consent is granted via event', async () => {
    consentState.status = null;
    const { __resetMetaPixelForTests } = await loadMetaPixel();
    __resetMetaPixelForTests();
    const { MetaPageViewTracker } = await loadTracker();

    render(<MetaPageViewTracker />);
    expect(window.fbq).toBeUndefined();

    consentState.status = 'granted';
    window.dispatchEvent(new Event('mj:analytics-consent'));

    const queued = window.fbq?.queue ?? [];
    const pageViews = queued.filter(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'track' && entry[1] === 'PageView',
    );
    expect(pageViews).toHaveLength(1);
  });
});
