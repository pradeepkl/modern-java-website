import { useEffect } from 'react';
import { book } from '../../data/book';
import { navigation } from '../../data/navigation';
import type { ActiveSection } from '../../hooks/useActiveSection';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import './MobileMenu.css';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  activeSection: ActiveSection;
}

export function MobileMenu({ open, onClose, activeSection }: MobileMenuProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="mobile-menu__backdrop"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <nav
        id="mobile-menu"
        className="mobile-menu"
        aria-label="Mobile navigation"
      >
        <ul className="mobile-menu__list">
          {navigation.map((link) => {
            const sectionId = link.href.slice(1);
            const isActive = activeSection === sectionId;

            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`mobile-menu__link ${isActive ? 'mobile-menu__link--active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={onClose}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
        <a
          href={book.amazonUrl}
          className="button button-primary button-full mobile-menu__cta"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          Buy Now
        </a>
      </nav>
    </>
  );
}
