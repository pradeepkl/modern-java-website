import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { book } from '../../data/book';
import {
  amazonExitModalCopy,
  AMAZON_EXIT_MODAL_SOURCE,
} from '../../data/amazonExitModalCopy';
import {
  AMAZON_CLICK_EVENT,
  AMAZON_CLICK_PARAMS,
  navigateToAmazon,
  track,
} from '../../lib/analytics';
import { AmazonConsentLink } from './AmazonConsentLink';

vi.mock('../../lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/analytics')>();
  return {
    ...actual,
    track: vi.fn(),
    navigateToAmazon: vi.fn(),
    trackMetaConversion: vi.fn(),
    getUtmProps: () => ({}),
  };
});

vi.mock('../../lib/turnstile', () => ({
  isTurnstileConfigured: () => false,
}));

vi.mock('./TurnstileWidget', async () => {
  const React = await import('react');
  return {
    TurnstileWidget: React.forwardRef(function MockTurnstile(
      props: {
        onError?: (reason: 'load' | 'widget') => void;
      },
      _ref: unknown,
    ) {
      return (
        <button
          type="button"
          data-testid="mock-turnstile-fail"
          onClick={() => props.onError?.('load')}
        >
          Simulate Turnstile failure
        </button>
      );
    }),
  };
});

describe('AmazonConsentLink', () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    assignMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        assign: assignMock,
        href: 'https://modern-java.classpath.in/',
      },
    });
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'created',
          message: 'You’re on the Classpath Reader List.',
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens the modal when Buy on Amazon is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl} buttonLocation="purchase_buttons">
        Buy on Amazon
      </AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));

    expect(screen.getByTestId('amazon-exit-modal')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /classpath reader list/i }),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith(
      'amazon_exit_modal_open',
      expect.objectContaining({
        source: AMAZON_EXIT_MODAL_SOURCE,
        button_location: 'purchase_buttons',
      }),
    );
  });

  it('preserves the Amazon destination URL for continue without joining', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.click(screen.getByTestId('amazon-exit-skip'));

    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
    expect(fetch).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      'amazon_exit_continue_without_email',
      expect.objectContaining({ source: AMAZON_EXIT_MODAL_SOURCE }),
    );
  });

  it('fires exactly one AmazonClick before Amazon navigation on continue without joining', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl} buttonLocation="formats">
        Buy on Amazon
      </AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.click(screen.getByTestId('amazon-exit-skip'));
    // Double-click must not emit a second AmazonClick (exited guard).
    await user.click(screen.getByTestId('amazon-exit-skip'));

    expect(navigateToAmazon).toHaveBeenCalledTimes(1);
    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
    expect(track).toHaveBeenCalledWith(
      'amazon_exit',
      expect.objectContaining({ path: 'skip' }),
    );
  });

  it('still navigates to Amazon when AmazonClick tracking throws', async () => {
    // navigateToAmazon itself must swallow tracking errors; component still calls it once.
    vi.mocked(navigateToAmazon).mockImplementationOnce((url: string) => {
      window.location.assign(url);
    });

    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.click(screen.getByTestId('amazon-exit-skip'));

    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
    expect(assignMock).toHaveBeenCalledWith(book.amazonUrl);
  });

  it('rejects an invalid email without submitting', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.type(screen.getByTestId('amazon-exit-email'), 'not-an-email');
    await user.click(screen.getByTestId('amazon-exit-submit'));

    expect(await screen.findByText(/valid email address/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows success after a valid email submission and continues to Amazon', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.type(
      screen.getByTestId('amazon-exit-email'),
      'reader@example.com',
    );
    await user.click(screen.getByTestId('amazon-exit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('amazon-exit-success')).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalled();
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall).toBeTruthy();
    const [url, options] = fetchCall;
    expect(String(url)).toMatch(/\/marketing-consents$/);
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const body = JSON.parse(String(options?.body));
    expect(body.email).toBe('reader@example.com');
    expect(body.source).toBe('amazon_exit_modal');
    expect(body.sourceVersion).toBe('2');

    await user.click(screen.getByTestId('amazon-exit-continue-after-signup'));
    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
    expect(track).toHaveBeenCalledWith(
      'amazon_exit_continue_after_signup',
      expect.objectContaining({ source: AMAZON_EXIT_MODAL_SOURCE }),
    );
    expect(navigateToAmazon).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      'amazon_exit',
      expect.objectContaining({ path: 'consent' }),
    );
  });

  it('fires AmazonClick once on join-and-continue path after signup', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.type(
      screen.getByTestId('amazon-exit-email'),
      'reader@example.com',
    );
    await user.click(screen.getByTestId('amazon-exit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('amazon-exit-continue-after-signup')).toBeTruthy();
    });

    expect(navigateToAmazon).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('amazon-exit-continue-after-signup'));
    expect(navigateToAmazon).toHaveBeenCalledTimes(1);
    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
  });

  it('exports canonical AmazonClick Meta parameters', () => {
    expect(AMAZON_CLICK_EVENT).toBe('AmazonClick');
    expect(AMAZON_CLICK_PARAMS).toEqual({
      content_ids: ['modern_java_kindle'],
      content_type: 'product',
      content_name: 'Modern Java Kindle',
      destination: 'amazon',
    });
  });

  it('handles duplicate email as a successful already-on-list state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'already_registered',
          message: amazonExitModalCopy.alreadyOnListMessage,
        }),
      }),
    );

    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.type(
      screen.getByTestId('amazon-exit-email'),
      'reader@example.com',
    );
    await user.click(screen.getByTestId('amazon-exit-submit'));

    expect(
      await screen.findByText(/already on the classpath reader list/i),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith(
      'amazon_exit_email_success',
      expect.objectContaining({ registration_status: 'already_registered' }),
    );
  });

  it('does not block Amazon continuation when Turnstile fails', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.click(screen.getByTestId('mock-turnstile-fail'));

    expect(
      await screen.findByText(/verification could not load/i),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith(
      'amazon_exit_turnstile_error',
      expect.objectContaining({ error_type: 'load' }),
    );

    await user.click(screen.getByTestId('amazon-exit-skip'));
    expect(navigateToAmazon).toHaveBeenCalledWith(book.amazonUrl);
  });

  it('masks the email field for Clarity', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));

    const email = screen.getByTestId('amazon-exit-email');
    expect(email.getAttribute('data-clarity-mask')).toBe('true');
  });

  it('never sends email or other PII in analytics events', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));
    await user.type(
      screen.getByTestId('amazon-exit-email'),
      'reader@example.com',
    );
    await user.click(screen.getByTestId('amazon-exit-submit'));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        'amazon_exit_email_success',
        expect.any(Object),
      );
    });

    for (const [, props] of vi.mocked(track).mock.calls) {
      const serialized = JSON.stringify(props ?? {});
      expect(serialized).not.toMatch(/reader@example\.com/i);
      if (props && typeof props === 'object') {
        expect(Object.prototype.hasOwnProperty.call(props, 'email')).toBe(
          false,
        );
      }
    }
  });

  it('keeps review copy free of reward-for-review and purchase wording', async () => {
    const user = userEvent.setup();
    render(
      <AmazonConsentLink href={book.amazonUrl}>Buy on Amazon</AmazonConsentLink>,
    );

    await user.click(screen.getByRole('link', { name: /buy on amazon/i }));

    const modalText = screen.getByTestId('amazon-exit-modal').textContent || '';
    const normalized = modalText.toLowerCase();

    for (const phrase of amazonExitModalCopy.forbiddenPhrases) {
      expect(normalized).not.toContain(phrase);
    }

    expect(normalized).toContain('after you’ve had time to read modern java');
    expect(normalized).toContain('reader-only launch offers');
    expect(normalized).not.toMatch(
      /review url|screenshot|amazon profile|proof/i,
    );
  });

  it('keeps the existing Amazon purchase destination unchanged', () => {
    expect(book.amazonUrl).toBe('https://www.amazon.in/dp/B0H6R4334W');
  });
});
