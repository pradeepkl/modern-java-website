import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AnalyticsConsentBanner } from './components/AnalyticsConsent/AnalyticsConsentBanner';
import { MetaPageViewTracker } from './components/analytics/MetaPageViewTracker';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PositioningSection } from './components/PositioningSection/PositioningSection';
import { InsideBookSection } from './components/InsideBookSection/InsideBookSection';
import { AudienceSection } from './components/AudienceSection/AudienceSection';
import { FormatsSection } from './components/FormatsSection/FormatsSection';
import { AuthorSection } from './components/AuthorSection/AuthorSection';
import { Footer } from './components/Footer/Footer';
import { getPaperbackMode } from './config/features';
import { useEngagementTracking } from './hooks/useEngagementTracking';
import { useSectionDeepLinkScroll } from './hooks/useSectionDeepLinkScroll';
import { useEmailLinkClickBeacon } from './hooks/useEmailLinkClickBeacon';

const LegalPage = lazy(() =>
  import('./components/LegalPage/LegalPage').then((m) => ({
    default: m.LegalPage,
  })),
);
const ContactPage = lazy(() =>
  import('./components/ContactPage/ContactPage').then((m) => ({
    default: m.ContactPage,
  })),
);
const UnsubscribePage = lazy(() =>
  import('./components/UnsubscribePage/UnsubscribePage').then((m) => ({
    default: m.UnsubscribePage,
  })),
);
const SubscribePage = lazy(() =>
  import('./components/SubscribePage/SubscribePage').then((m) => ({
    default: m.SubscribePage,
  })),
);
const ModalPreviewPage = lazy(() =>
  import('./components/ModalPreviewPage').then((m) => ({
    default: m.ModalPreviewPage,
  })),
);
const PaperbackWaitlistSection = lazy(() =>
  import('./components/FormatsSection/PaperbackWaitlistSection').then((m) => ({
    default: m.PaperbackWaitlistSection,
  })),
);

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <MetaPageViewTracker />
      <AnalyticsConsentBanner />
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isLanding = path === '/';
  const [scrolled, setScrolled] = useState(false);
  useEngagementTracking(isLanding);
  useSectionDeepLinkScroll(isLanding);
  useEmailLinkClickBeacon(isLanding);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (path === '/modal-preview') {
    return (
      <Suspense fallback={null}>
        <ModalPreviewPage />
      </Suspense>
    );
  }

  if (path === '/privacy-policy') {
    return (
      <Shell>
        <LegalPage type="privacy" />
      </Shell>
    );
  }

  if (path === '/terms-of-use') {
    return (
      <Shell>
        <LegalPage type="terms" />
      </Shell>
    );
  }

  if (path === '/unsubscribe') {
    return (
      <Shell>
        <UnsubscribePage />
      </Shell>
    );
  }

  if (path === '/subscribe') {
    return (
      <Shell>
        <SubscribePage />
      </Shell>
    );
  }

  if (path === '/contact') {
    return (
      <Shell>
        <ContactPage />
      </Shell>
    );
  }

  return (
    <div className="site-shell">
      <MetaPageViewTracker />
      <AnalyticsConsentBanner />
      <Header scrolled={scrolled} />
      <main>
        <Hero />
        <PositioningSection />
        <InsideBookSection />
        <AudienceSection />
        <FormatsSection />
        {getPaperbackMode() === 'waitlist' ? (
          <Suspense fallback={null}>
            <PaperbackWaitlistSection />
          </Suspense>
        ) : null}
        <AuthorSection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
