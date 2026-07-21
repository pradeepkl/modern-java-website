import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PurposeSection } from './components/PurposeSection/PurposeSection';
import { GuideSection } from './components/GuideSection/GuideSection';
import { InsideBookSection } from './components/InsideBookSection/InsideBookSection';
import { SampleChapterSection } from './components/SampleChapterSection/SampleChapterSection';
import { AuthorSection } from './components/AuthorSection/AuthorSection';
import { TrustSection } from './components/TrustSection/TrustSection';
import { FormatsSection } from './components/FormatsSection/FormatsSection';
import { Footer } from './components/Footer/Footer';
import { LegalPage } from './components/LegalPage/LegalPage';
import { useActiveSection } from './hooks/useActiveSection';

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeSection = useActiveSection();

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

  if (path === '/privacy-policy') {
    return <LegalPage type="privacy" />;
  }

  if (path === '/terms-of-use') {
    return <LegalPage type="terms" />;
  }

  return (
    <div className="site-shell">
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
      </main>
      <Footer />
    </div>
  );
}

export default App;
