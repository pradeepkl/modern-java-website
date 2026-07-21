import { Github, Linkedin } from 'lucide-react';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { Icon } from './Icon';
import './shared.css';

interface SocialLinksProps {
  className?: string;
  size?: number;
  includeEmail?: boolean;
}

export function SocialLinks({
  className = '',
  size = 20,
  includeEmail = true,
}: SocialLinksProps) {
  return (
    <div className={`social-links ${className}`}>
      <a
        href={book.linkedinUrl}
        className="social-links__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <Linkedin size={size} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        href={book.githubUrl}
        className="social-links__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <Github size={size} strokeWidth={1.75} aria-hidden="true" />
      </a>
      {includeEmail ? (
        <a
          href={`mailto:${book.email}`}
          className="social-links__link"
          aria-label="Email"
        >
          <Icon src={assets.social.email} size={size} />
        </a>
      ) : null}
    </div>
  );
}
