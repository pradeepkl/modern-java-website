import { ArrowRight } from 'lucide-react';
import { getPaperbackMode } from '../../config/features';
import { assets } from '../../data/assets';
import { trackCtaClick } from '../../lib/analytics';
import { DecorativeImage } from '../shared/Icon';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import './Hero.css';

export function Hero() {
  const formatLine =
    getPaperbackMode() === 'sales'
      ? 'Kindle · PDF + ePub · Paperback'
      : 'Kindle · PDF + ePub';

  return (
    <section id="top" className="hero" aria-labelledby="hero-heading">
      <DecorativeImage
        src={assets.hero.circuitLeft}
        className="hero-background-left"
        width={520}
        height={520}
      />
      <DecorativeImage
        src={assets.hero.circuitRight}
        className="hero-background-right"
        width={380}
        height={380}
      />

      <div className="hero-inner page-container">
        <div className="hero-copy">
          <SectionEyebrow className="hero-eyebrow">
            FOR EXPERIENCED JAVA DEVELOPERS
          </SectionEyebrow>

          <h1 id="hero-heading" className="hero-title">
            Write Java <span>with intent.</span>
          </h1>

          <p className="hero-lead">
            Move beyond implementation-heavy code and learn to design Java that
            is clearer, safer, and easier to evolve.
          </p>

          <p className="hero-secondary">
            Less ceremony. Stronger models. More help from the compiler.
          </p>

          <a
            href="#formats"
            className="button button-primary button-large hero-cta"
            onClick={() => trackCtaClick('choose_format', 'hero')}
          >
            Choose your format
            <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
          </a>

          <p className="hero-meta">
            Java 21+ examples · Concepts through Java 25 · Companion source
            included
          </p>
        </div>

        <div className="hero-visual">
          <img
            src={assets.hero.paperback}
            alt="Modern Java: The Mindset Shift — 3D book cover"
            width={1200}
            height={1200}
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          <p className="hero-product-context">{formatLine}</p>
        </div>
      </div>
    </section>
  );
}
