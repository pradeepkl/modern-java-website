export const assets = {
  brand: {
    logo: '/assets/brand/modern-java-logo-horizontal.svg',
    mark: '/assets/brand/modern-java-mark.svg',
    wordmark: '/assets/brand/logo-modern-java.svg',
    favicon: '/assets/brand/favicon.svg',
    javaIcon: '/assets/icons/brand/icon-java.svg',
  },

  hero: {
    radial: '/assets/hero/hero-radial.svg',
    circuitLeft: '/assets/hero/hero-circuit-left.svg',
    circuitRight: '/assets/hero/hero-circuit-right.svg',
    /** Default/fallback src; prefer 768w to match HTML preload href. */
    paperback: '/assets/hero/modern-java-3D-768.webp',
    paperbackSrcSet:
      '/assets/hero/modern-java-3D-480.webp 480w, /assets/hero/modern-java-3D-768.webp 768w, /assets/hero/modern-java-3D.webp 1200w',
    paperbackSizes: '(max-width: 560px) 390px, (max-width: 820px) 480px, 620px',
    paperbackEdition: '/assets/hero/paperback-3D.webp',
  },

  topicIcons: {
    records: '/assets/topic-icons/records.svg',
    patternMatching: '/assets/topic-icons/pattern-matching.svg',
    streams: '/assets/topic-icons/streams.svg',
    structuredConcurrency: '/assets/topic-icons/structured-concurrency.svg',
  },

  learningIcons: {
    intentFirst: '/assets/learning-icons/intent-first.svg',
    modelDomains: '/assets/learning-icons/model-real-domains.svg',
    makeExplicit: '/assets/learning-icons/make-explicit.svg',
    enforceBoundaries: '/assets/learning-icons/enforce-boundaries.svg',
    designConcurrency: '/assets/learning-icons/design-concurrency.svg',
  },

  formats: {
    devices: '/assets/formats/formats.webp',
    guideMockup: '/assets/formats/3Dmockup-tp-768.webp',
    guideMockupSrcSet:
      '/assets/formats/3Dmockup-tp-480.webp 480w, /assets/formats/3Dmockup-tp-768.webp 768w, /assets/formats/3Dmockup-tp-1200.webp 1200w, /assets/formats/3Dmockup-tp.webp 1600w',
    guideMockupSizes: '(max-width: 820px) 92vw, 640px',
    pdf: '/assets/icons/formats/pdf.png',
    epub: '/assets/icons/formats/epub.png',
    mobi: '/assets/icons/formats/mobi.png',
    kindle: '/assets/icons/formats/icon-kindle.svg',
    paperback: '/assets/icons/formats/icon-paperback.svg',
    amazon: '/assets/icons/brand/icon-amazon.svg',
    amazonLogo: '/assets/icons/brand/amazon-logo.svg',
  },

  author: {
    portrait: '/assets/author/pradeep_author.webp',
  },

  decorations: {
    headingDivider: '/assets/decorations/heading-divider.svg',
    sectionOrnament: '/assets/decorations/section-ornament.svg',
    eyebrowLine: '/assets/decorations/eyebrow-line.svg',
    footerCircuit: '/assets/decorations/footer-circuit.svg',
  },

  social: {
    ogPreview: '/assets/social/og-preview.jpg',
    github: '/assets/icons/social/icon-github.svg',
    linkedin: '/assets/icons/social/icon-linkedin.svg',
    email: '/assets/icons/social/icon-email.svg',
  },
} as const;
