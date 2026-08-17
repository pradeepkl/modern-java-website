import { useEffect, useState } from 'react';
import { AnalyticsConsentBanner } from './components/AnalyticsConsent/AnalyticsConsentBanner';
import { MetaPageViewTracker } from './components/analytics/MetaPageViewTracker';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PositioningSection } from './components/PositioningSection/PositioningSection';
import { InsideBookSection } from './components/InsideBookSection/InsideBookSection';
import { AudienceSection } from './components/AudienceSection/AudienceSection';
import { FormatsSection } from './components/FormatsSection/FormatsSection';
import { PaperbackWaitlistSection } from './components/FormatsSection/PaperbackWaitlistSection';
import { Footer } from './components/Footer/Footer';
import { LegalPage } from './components/LegalPage/LegalPage';
import { ContactPage } from './components/ContactPage/ContactPage';
import { UnsubscribePage } from './components/UnsubscribePage/UnsubscribePage';
import { SubscribePage } from './components/SubscribePage/SubscribePage';
import { ModalPreviewPage } from './components/ModalPreviewPage';
import { useEngagementTracking } from './hooks/useEngagementTracking';
import { useSectionDeepLinkScroll } from './hooks/useSectionDeepLinkScroll';
import { useEmailLinkClickBeacon } from './hooks/useEmailLinkClickBeacon';

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
    return <ModalPreviewPage />;
  }

  if (path === '/privacy-policy') {
    return (
      <>
        <MetaPageViewTracker />
        <AnalyticsConsentBanner />
        <LegalPage type="privacy" />
      </>
    );
  }

  if (path === '/terms-of-use') {
    return (
      <>
        <MetaPageViewTracker />
        <AnalyticsConsentBanner />
        <LegalPage type="terms" />
      </>
    );
  }

  if (path === '/unsubscribe') {
    return (
      <>
        <MetaPageViewTracker />
        <AnalyticsConsentBanner />
        <UnsubscribePage />
      </>
    );
  }

  if (path === '/subscribe') {
    return (
      <>
        <MetaPageViewTracker />
        <AnalyticsConsentBanner />
        <SubscribePage />
      </>
    );
  }

  if (path === '/contact') {
    return (
      <>
        <MetaPageViewTracker />
        <AnalyticsConsentBanner />
        <ContactPage />
      </>
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
        <PaperbackWaitlistSection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
