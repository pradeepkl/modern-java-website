import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { navigation } from '../../data/navigation';
import './Footer.css';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner page-container">
        <div className="site-footer__brand">
          <img
            src={assets.brand.logo}
            alt="Modern Java"
            width={240}
            height={58}
            className="site-footer__logo"
            loading="lazy"
            decoding="async"
          />
          <p className="site-footer__tagline">{book.tagline}</p>
        </div>

        <div className="site-footer__links">
          <h2 className="site-footer__heading">Links</h2>
          <ul className="site-footer__nav">
            {navigation.map((link) => (
              <li key={link.href}>
                <a href={`/${link.href}`} className="site-footer__nav-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="site-footer__bottom page-container">
        <div className="site-footer__legal">
          <a href="/privacy-policy" className="site-footer__legal-link">
            Privacy Policy
          </a>
          <span aria-hidden="true">·</span>
          <a href="/terms-of-use" className="site-footer__legal-link">
            Terms of Use
          </a>
        </div>
        <p className="site-footer__copyright">
          © {book.copyrightYear} {book.author}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
