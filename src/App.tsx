import { useCallback, useEffect, useState } from 'react';
import { AnalyticsConsentBanner } from './components/AnalyticsConsent/AnalyticsConsentBanner';
import { MetaPageViewTracker } from './components/analytics/MetaPageViewTracker';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PurposeSection } from './components/PurposeSection/PurposeSection';
import { GuideSection } from './components/GuideSection/GuideSection';
import { InsideBookSection } from './components/InsideBookSection/InsideBookSection';
import { SampleChapterSection } from './components/SampleChapterSection/SampleChapterSection';
import { AuthorSection } from './components/AuthorSection/AuthorSection';
import { TrustSection } from './components/TrustSection/TrustSection';
import { FormatsSection } from './components/FormatsSection/FormatsSection';
import { PaperbackWaitlistSection } from './components/FormatsSection/PaperbackWaitlistSection';
import { Footer } from './components/Footer/Footer';
import { LegalPage } from './components/LegalPage/LegalPage';
import { ContactPage } from './components/ContactPage/ContactPage';
import { UnsubscribePage } from './components/UnsubscribePage/UnsubscribePage';
import { ModalPreviewPage } from './components/ModalPreviewPage';
import { useActiveSection } from './hooks/useActiveSection';
import { useEngagementTracking } from './hooks/useEngagementTracking';
import { useSectionDeepLinkScroll } from './hooks/useSectionDeepLinkScroll';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isLanding = path === '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeSection = useActiveSection();
  useEngagementTracking(isLanding);
  useSectionDeepLinkScroll(isLanding);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleMenuToggle = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
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
      <Header
        menuOpen={menuOpen}
        onMenuToggle={handleMenuToggle}
        onMenuClose={handleMenuClose}
        scrolled={scrolled}
        activeSection={activeSection}
      />
      <main>
        <Hero />
        <PurposeSection />
        <GuideSection />
        <InsideBookSection />
        <SampleChapterSection />
        <AuthorSection />
        <TrustSection />
        <FormatsSection />
        <PaperbackWaitlistSection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
