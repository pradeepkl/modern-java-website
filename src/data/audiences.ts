export interface Audience {
  id: string;
  label: string;
}

export const audiences: Audience[] = [
  {
    id: 'mindset',
    label: 'You want a strong engineering mindset',
  },
  {
    id: 'tradeoffs',
    label: 'You care about architectural design trade-offs',
  },
  {
    id: 'intent-first',
    label: 'You put intent first, implementation next',
  },
  {
    id: 'all-java',
    label: 'You write Java — at any level of experience',
  },
];
