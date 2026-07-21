import { assets } from '../../data/assets';
import { DecorativeImage } from '../shared/Icon';
import { PurchaseButtons } from '../shared/PurchaseButtons';
import './Hero.css';

export function Hero() {
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
          <p className="hero-eyebrow">FOR EXPERIENCED JAVA DEVELOPERS</p>

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

          <PurchaseButtons
            size="large"
            className="hero-actions"
          />

          <p className="hero-meta">
            Java 21+ examples · Concepts through Java 25 · Companion source
            included
          </p>
        </div>

        <div className="hero-visual">
          <img
            src={assets.hero.paperback}
            alt="Modern Java: The Mindset Shift — 3D book cover"
            width={2000}
            height={2000}
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          <p className="hero-product-context">Kindle · Paperback</p>
        </div>
      </div>
    </section>
  );
}
