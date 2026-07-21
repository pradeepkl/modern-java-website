import { assets } from './assets';

export const topics = [
  {
    id: 'records',
    title: 'Records',
    description:
      'Immutable data carriers that reduce boilerplate and make domain models clearer.',
    iconSrc: assets.topicIcons.records,
  },
  {
    id: 'pattern-matching',
    title: 'Pattern Matching',
    description:
      'Expressive branching and data deconstruction with less ceremony.',
    iconSrc: assets.topicIcons.patternMatching,
  },
  {
    id: 'streams',
    title: 'Streams',
    description:
      'Declarative pipelines for collection processing that express intent.',
    iconSrc: assets.topicIcons.streams,
  },
  {
    id: 'concurrency',
    title: 'Structured Concurrency',
    description:
      'Safer, clearer concurrent code with structured task scopes.',
    iconSrc: assets.topicIcons.structuredConcurrency,
  },
] as const;
