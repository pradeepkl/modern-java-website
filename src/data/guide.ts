export interface GuideFeature {
  id: string;
  title: string;
  description: string;
  icon: 'book' | 'code' | 'layers' | 'terminal' | 'java' | 'diagram';
}

export interface GuideValue {
  id: string;
  title: string;
  description: string;
  icon: 'target' | 'shield' | 'puzzle' | 'rocket' | 'users';
}

export const guideIntro = {
  eyebrow: 'A comprehensive guide',
  title: 'Everything you need to think, design, and code in modern Java',
  copy:
    'A complete resource to understand the intent behind modern Java, leverage the compiler and type system, and build software that is expressive, robust, and easy to evolve.',
} as const;

export const guideAvailability = [
  { id: 'kindle', label: 'Kindle', icon: 'amazon' as const },
  { id: 'digital', label: 'PDF + ePub', icon: 'download' as const },
  { id: 'paperback', label: 'Paperback', icon: 'book' as const },
] as const;

export const guideFeatures: GuideFeature[] = [
  {
    id: 'pages',
    title: '300+ Pages',
    description: 'In-depth coverage with clear explanations and visual aids.',
    icon: 'book',
  },
  {
    id: 'examples',
    title: '100+ Examples',
    description: 'Practical, real-world examples to reinforce every concept.',
    icon: 'code',
  },
  {
    id: 'chapters',
    title: '12 Chapters',
    description: 'A carefully structured journey from mindset to mastery.',
    icon: 'layers',
  },
  {
    id: 'production',
    title: 'Production-ready code',
    description:
      'Clean, focused, and tested code you can use as a starting point.',
    icon: 'terminal',
  },
  {
    id: 'modern',
    title: 'Modern Java 8–25 concepts',
    description: 'Covers the latest language features and best practices.',
    icon: 'java',
  },
  {
    id: 'diagrams',
    title: '50+ Illustrative Diagrams',
    description:
      'Visual explanations that make relationships, flows, and design trade-offs easier to grasp.',
    icon: 'diagram',
  },
];

export const guideValues: GuideValue[] = [
  {
    id: 'intent',
    title: 'Intent-first approach',
    description: 'Design with purpose, not just syntax.',
    icon: 'target',
  },
  {
    id: 'safer',
    title: 'Safer by design',
    description: 'Leverage the type system and compiler to catch issues early.',
    icon: 'shield',
  },
  {
    id: 'real-world',
    title: 'Real-world focus',
    description: 'From simple examples to enterprise-level patterns.',
    icon: 'puzzle',
  },
  {
    id: 'lasting',
    title: 'Built to last',
    description: "Write expressive code that's easy to evolve and maintain.",
    icon: 'rocket',
  },
  {
    id: 'career',
    title: 'For career growth',
    description: 'Sharpen your skills and stand out as a developer.',
    icon: 'users',
  },
];
