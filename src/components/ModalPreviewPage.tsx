import { book } from '../data/book';
import { AmazonConsentLink } from './shared/AmazonConsentLink';
import { DigitalOrderDialog } from './FormatsSection/DigitalOrderDialog';
import { PaperbackOrderDialog } from './FormatsSection/PaperbackOrderDialog';
import { PaperbackWaitlistDialog } from './FormatsSection/PaperbackWaitlistDialog';
import './ModalPreviewPage.css';

const noop = () => undefined;

/**
 * Temporary formatting gallery for all checkout / waitlist / Amazon exit modals.
 * Open at /modal-preview — remove when review is done.
 */
export function ModalPreviewPage() {
  return (
    <div className="modal-preview-page">
      <header className="modal-preview-page__header page-container">
        <p className="modal-preview-page__eyebrow">Temporary</p>
        <h1>Modal formatting preview</h1>
        <p>
          All dialog form and success states are shown inline for layout review.
          This page is not linked from the public site. Visit{' '}
          <code>/modal-preview</code>.
        </p>
      </header>

      <div className="modal-preview-page__grid page-container">
        <section className="modal-preview-page__card">
          <h2>Digital order — form</h2>
          <DigitalOrderDialog open onClose={noop} embed previewState="form" />
        </section>

        <section className="modal-preview-page__card">
          <h2>Digital order — success</h2>
          <DigitalOrderDialog
            open
            onClose={noop}
            embed
            previewState="success"
          />
        </section>

        <section className="modal-preview-page__card">
          <h2>Paperback order — form</h2>
          <PaperbackOrderDialog open onClose={noop} embed previewState="form" />
        </section>

        <section className="modal-preview-page__card">
          <h2>Paperback order — success</h2>
          <PaperbackOrderDialog
            open
            onClose={noop}
            embed
            previewState="success"
          />
        </section>

        <section className="modal-preview-page__card">
          <h2>Paperback waitlist — form</h2>
          <PaperbackWaitlistDialog
            open
            onClose={noop}
            embed
            previewState="form"
          />
        </section>

        <section className="modal-preview-page__card">
          <h2>Paperback waitlist — success</h2>
          <PaperbackWaitlistDialog
            open
            onClose={noop}
            embed
            previewState="success"
          />
        </section>

        <section className="modal-preview-page__card">
          <h2>Paperback waitlist — already registered</h2>
          <PaperbackWaitlistDialog
            open
            onClose={noop}
            embed
            previewState="already_registered"
          />
        </section>

        <section className="modal-preview-page__card">
          <h2>Amazon exit — form</h2>
          <AmazonConsentLink
            href={book.amazonUrl}
            preview={{ embed: true, state: 'form' }}
          >
            Preview
          </AmazonConsentLink>
        </section>

        <section className="modal-preview-page__card">
          <h2>Amazon exit — success</h2>
          <AmazonConsentLink
            href={book.amazonUrl}
            preview={{ embed: true, state: 'success' }}
          >
            Preview
          </AmazonConsentLink>
        </section>
      </div>
    </div>
  );
}
