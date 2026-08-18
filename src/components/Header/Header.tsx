import { assets } from '../../data/assets';
import { navigation } from '../../data/navigation';
import './Header.css';

interface HeaderProps {
  scrolled: boolean;
}

export function Header({ scrolled }: HeaderProps) {
  return (
    <header className={`site-header${scrolled ? ' site-header--scrolled' : ''}`}>
      <div className="header-inner page-container">
        <a className="brand-link" href="#top" aria-label="Modern Java home">
          <img
            src={assets.brand.logo}
            alt="Modern Java — The Mindset Shift"
            width={300}
            height={72}
            className="header-logo"
            decoding="async"
          />
        </a>

        <nav className="header-nav" aria-label="Main navigation">
          <ul className="header-nav__list">
            {navigation.map((link) => (
              <li key={link.href}>
                <a className="header-nav__link" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
