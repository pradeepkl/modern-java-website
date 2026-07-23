import { assets } from '../../data/assets';
import { navigation } from '../../data/navigation';
import { trackCtaClick } from '../../lib/analytics';
import type { ActiveSection } from '../../hooks/useActiveSection';
import { MobileMenu } from '../MobileMenu/MobileMenu';
import './Header.css';

interface HeaderProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  scrolled: boolean;
  activeSection: ActiveSection;
}

export function Header({
  menuOpen,
  onMenuToggle,
  onMenuClose,
  scrolled,
  activeSection,
}: HeaderProps) {
  return (
    <header className={`site-header ${scrolled ? 'site-header--scrolled' : ''}`}>
        <div className="header-inner page-container">
        <a className="brand-link" href="#top" aria-label="Modern Java home">
          <img
            src={assets.brand.logo}
            alt="Modern Java — The Mindset Shift"
            width={300}
            height={72}
            className="header-logo"
          />
        </a>

        <nav className="header-nav" aria-label="Main navigation">
          <ul className="header-nav__list">
            {navigation.map((link) => {
              const sectionId = link.href.slice(1);
              const isActive = activeSection === sectionId;

              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`header-nav__link ${isActive ? 'header-nav__link--active' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => {
                      if (link.href === '#formats') {
                        trackCtaClick('nav_formats', 'header');
                      }
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="header-menu-button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={onMenuToggle}
        >
          <span className="header-menu-button__icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={onMenuClose}
        activeSection={activeSection}
      />
    </header>
  );
}
