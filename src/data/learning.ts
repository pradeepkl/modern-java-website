import { assets } from './assets';

export const learningOutcomes = [
  {
    id: 'intent-first',
    title: 'Intent-First Code',
    description:
      'Replace loops and boilerplate with pattern matching, records, and sealed types.',
    iconSrc: assets.learningIcons.intentFirst,
  },
  {
    id: 'model-domains',
    title: 'Model Real Domains',
    description:
      'Use records, sealed types, interfaces, and classes to model real-world problems clearly.',
    iconSrc: assets.learningIcons.modelDomains,
  },
  {
    id: 'make-explicit',
    title: 'Make It Explicit',
    description:
      'Make branching, absence, and failure explicit with modern Java constructs.',
    iconSrc: assets.learningIcons.makeExplicit,
  },
  {
    id: 'enforce-boundaries',
    title: 'Enforce Boundaries',
    description: 'Use the module system to enforce architectural boundaries.',
    iconSrc: assets.learningIcons.enforceBoundaries,
  },
  {
    id: 'concurrency',
    title: 'Design for Concurrency',
    description:
      'Use structured concurrency to write safe, clear, and maintainable concurrent code.',
    iconSrc: assets.learningIcons.designConcurrency,
  },
] as const;

export const positioningChecklist = [
  'Write intent-first code with records, sealed types, and patterns',
  'Model domains with clarity and enforce rules with the compiler',
  'Make branching, absence, and failure explicit',
  'Build safe, declarative pipelines with Streams',
  'Design concurrent systems with structured concurrency',
  'Think in modules and enforce architectural boundaries',
] as const;
