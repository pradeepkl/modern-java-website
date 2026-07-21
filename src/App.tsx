import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PurposeSection } from './components/PurposeSection/PurposeSection';
import { GuideSection } from './components/GuideSection/GuideSection';
import { InsideBookSection } from './components/InsideBookSection/InsideBookSection';
import { AuthorSection } from './components/AuthorSection/AuthorSection';
import { FormatsSection } from './components/FormatsSection/FormatsSection';
import { Footer } from './components/Footer/Footer';
import { useActiveSection } from './hooks/useActiveSection';

function App() {
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
        <AuthorSection />
        <FormatsSection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
