import { Github, Instagram, Linkedin } from 'lucide-react';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { trackOutboundClick } from '../../lib/analytics';
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
        href={book.instagramUrl}
        className="social-links__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow Classpath Publications on Instagram"
        onClick={() => trackOutboundClick(book.instagramUrl, 'instagram')}
      >
        <Instagram size={size} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        href={book.linkedinUrl}
        className="social-links__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
        onClick={() => trackOutboundClick(book.linkedinUrl, 'linkedin')}
      >
        <Linkedin size={size} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        href={book.githubUrl}
        className="social-links__link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        onClick={() => trackOutboundClick(book.githubUrl, 'github')}
      >
        <Github size={size} strokeWidth={1.75} aria-hidden="true" />
      </a>
      {includeEmail ? (
        <a
          href={`mailto:${book.email}`}
          className="social-links__link"
          aria-label="Email"
          onClick={() =>
            trackOutboundClick(`mailto:${book.email}`, 'email')
          }
        >
          <Icon src={assets.social.email} size={size} />
        </a>
      ) : null}
    </div>
  );
}
