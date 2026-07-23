import { useEffect } from 'react';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { Footer } from '../Footer/Footer';
import './LegalPage.css';

type LegalPageType = 'privacy' | 'terms';

interface LegalPageProps {
  type: LegalPageType;
}

const lastUpdated = '24 July 2026';

function PrivacyPolicy() {
  return (
    <>
      <section>
        <h2>Information we collect</h2>
        <p>
          You can browse this website without creating an account. When you
          place a paperback order, we collect the information needed to process
          and deliver it, including your name, email address, phone number,
          quantity, delivery address, postal code, and any optional notes.
          When you request a sample chapter, we collect your email address and
          record whether you separately chose to receive occasional updates.
          Before visiting Amazon, you may also optionally share your email
          address to subscribe to book updates and promotional offers.
        </p>
        <p>
          Our hosting and security providers may also process basic technical
          data such as your IP address, browser type, device information, and
          request logs.
        </p>
      </section>

      <section>
        <h2>Analytics and cookies</h2>
        <p>
          If you choose <strong>Accept analytics</strong> on the cookie banner,
          we load Google Analytics 4 and, when configured, Microsoft Clarity.
          These tools may set cookies or similar identifiers and collect page
          URL, device and browser type, approximate location, scroll and click
          behaviour, and conversion events such as sample requests and
          completed checkouts. We do not send your email address, name, phone
          number, delivery address, or payment card details to these analytics
          providers.
        </p>
        <p>
          Analytics consent is separate from marketing email consent. You can
          choose <strong>Essential only</strong> to use the site without
          analytics cookies. Clearing site data for this domain resets the
          banner so you can change your choice.
        </p>
      </section>

      <section>
        <h2>How we use your information</h2>
        <ul>
          <li>To create, process, deliver, and support your order.</li>
          <li>To verify payment and send order confirmations.</li>
          <li>To respond to questions and customer-service requests.</li>
          <li>
            To send book and Java updates only when you explicitly opt in.
          </li>
          <li>
            With your analytics consent, to understand site usage and improve
            the purchase experience.
          </li>
          <li>To prevent fraud, protect the website, and comply with law.</li>
        </ul>
      </section>

      <section>
        <h2>Payments and service providers</h2>
        <p>
          Paperback payments are processed by Razorpay. We do not receive or
          store your full card, UPI, or bank-account credentials. Razorpay
          processes payment information under its own privacy policy and terms.
        </p>
        <p>
          Order information may be processed by service providers that help us
          operate the store, including Amazon Web Services for hosting, order
          records, and transactional email. Kindle purchases are completed on
          Amazon and are governed by Amazon&apos;s privacy policy and terms.
          Optional analytics are provided by Google and Microsoft under their
          respective privacy policies when you accept analytics cookies.
        </p>
      </section>

      <section>
        <h2>Sharing and retention</h2>
        <p>
          We do not sell your personal information. We share it only with
          payment, hosting, email, delivery, and professional service providers
          where necessary to operate the website and fulfil orders, or when
          required by law.
        </p>
        <p>
          We retain order and payment records only for as long as reasonably
          necessary for fulfilment, support, accounting, fraud prevention, and
          legal obligations.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You may ask to access, correct, or delete personal information we
          hold about you, subject to records we must retain by law. Email us at{' '}
          <a href={`mailto:${book.email}`}>{book.email}</a> with your request.
        </p>
      </section>

      <section>
        <h2>Security and changes</h2>
        <p>
          We use reasonable administrative and technical safeguards, but no
          internet transmission or storage system is completely secure. We may
          update this policy as our services or legal obligations change. The
          latest revision date will appear at the top of this page.
        </p>
      </section>
    </>
  );
}

function TermsOfUse() {
  return (
    <>
      <section>
        <h2>Using this website</h2>
        <p>
          By using this website, you agree to these terms. You may use the site
          for lawful, personal purposes. You must not interfere with its
          operation, attempt unauthorized access, introduce malicious code, or
          misuse its content or ordering features.
        </p>
      </section>

      <section>
        <h2>Book information and intellectual property</h2>
        <p>
          The website, book excerpts, text, graphics, logos, and other original
          material are owned by or licensed to {book.author} and are protected
          by applicable intellectual-property laws. You may not reproduce,
          distribute, republish, or commercially exploit them without prior
          written permission.
        </p>
        <p>
          Code examples and companion materials may have separate licence terms
          where stated. The book and website provide educational information
          and do not constitute legal, financial, or professional advice.
        </p>
      </section>

      <section>
        <h2>Purchases and payment</h2>
        <p>
          Kindle purchases are completed through Amazon and are subject to
          Amazon&apos;s pricing, availability, payment, cancellation, and
          refund terms.
        </p>
        <p>
          Direct digital purchases include the PDF and ePub editions. Secure
          download links are sent to the email address provided after payment
          verification and expire for security. Buyers may receive
          transactional emails when revised editions become available.
          Promotional messages are sent only when separately requested.
        </p>
        <p>
          Paperback orders placed on this website are confirmed only after
          successful payment verification. Payments are processed securely by
          Razorpay. Prices, availability, and delivery estimates may change
          before an order is placed.
        </p>
      </section>

      <section>
        <h2>Digital delivery and refunds</h2>
        <p>
          You are responsible for providing a valid email address and
          downloading the files before the secure links expire. Contact{' '}
          <a href={`mailto:${book.email}`}>{book.email}</a> if a link expires or
          delivery fails. Because digital files are delivered immediately,
          refund requests may be limited after download, except where required
          by applicable consumer law.
        </p>
      </section>

      <section>
        <h2>Paperback delivery, cancellation, and refunds</h2>
        <p>
          Paperback delivery is currently available only within India. You are
          responsible for providing complete and accurate delivery details.
          Delivery times may vary due to location, courier operations, or
          events outside our reasonable control.
        </p>
        <p>
          To request a cancellation, replacement, or refund, contact{' '}
          <a href={`mailto:${book.email}`}>{book.email}</a> with your order
          number. Requests are reviewed based on order status and the condition
          of delivered goods. This does not limit rights available under
          applicable consumer law.
        </p>
      </section>

      <section>
        <h2>Third-party services and links</h2>
        <p>
          This website links to and relies on third-party services, including
          Amazon and Razorpay. We are not responsible for their content,
          availability, security, or practices. Your use of those services is
          governed by their respective terms.
        </p>
      </section>

      <section>
        <h2>Disclaimer and limitation of liability</h2>
        <p>
          The website is provided on an “as available” basis. To the extent
          permitted by law, we do not guarantee uninterrupted access or that
          all content will always be complete or error-free. We are not liable
          for indirect or consequential loss arising from use of the website.
          Nothing in these terms excludes liability that cannot legally be
          excluded.
        </p>
      </section>

      <section>
        <h2>Governing law and contact</h2>
        <p>
          These terms are governed by the laws of India. For questions about
          these terms, contact <a href={`mailto:${book.email}`}>{book.email}</a>.
        </p>
      </section>
    </>
  );
}

export function LegalPage({ type }: LegalPageProps) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Use';

  useEffect(() => {
    document.title = `${title} | ${book.title}`;
    window.scrollTo(0, 0);

    return () => {
      document.title = `${book.title} - ${book.subtitle}`;
    };
  }, [title]);

  return (
    <div className="site-shell">
      <header className="legal-header">
        <div className="legal-header__inner page-container">
          <a href="/" aria-label="Modern Java home">
            <img
              src={assets.brand.logo}
              alt="Modern Java — The Mindset Shift"
              width={300}
              height={72}
              className="legal-header__logo"
            />
          </a>
          <a href="/" className="legal-header__back">
            Back to website
          </a>
        </div>
      </header>

      <main className="legal-page">
        <div className="legal-page__inner">
          <p className="legal-page__eyebrow">Modern Java</p>
          <h1>{title}</h1>
          <p className="legal-page__updated">Last updated: {lastUpdated}</p>
          <div className="legal-page__content">
            {isPrivacy ? <PrivacyPolicy /> : <TermsOfUse />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
