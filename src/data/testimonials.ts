import { book } from './book';

export interface QuotePart {
  text: string;
  highlight?: boolean;
}

export interface Testimonial {
  id: string;
  quote: QuotePart[];
  name: string;
  role: string;
  initials: string;
  accent: string;
}

export interface SocialStat {
  id: string;
  label: string;
  icon: 'users' | 'globe' | 'shield' | 'book' | 'code';
}

export const testimonialsIntro = {
  eyebrow: 'Trusted by developers',
  title: 'What readers are saying',
  copy:
    "Modern Java is already helping developers write clearer code and design better systems. Here's what early readers and reviewers have to say.",
  rating: '4.9',
  ratingCaption: 'out of 5',
  ratingNote: 'Based on 120+ reader ratings and reviews',
} as const;

export const testimonials: Testimonial[] = [
  {
    id: 'arun',
    quote: [
      { text: 'This book truly ' },
      { text: 'changes your mindset', highlight: true },
      {
        text: '. After years of writing Java the old way, I finally see how modern features fit together.',
      },
    ],
    name: 'Arun Gupta',
    role: 'Principal Engineer',
    initials: 'AG',
    accent: '#1556c0',
  },
  {
    id: 'neha',
    quote: [
      { text: 'The ' },
      { text: 'perfect examples', highlight: true },
      {
        text: ' make every concept click. I\'ve already started applying the patterns at work.',
      },
    ],
    name: 'Neha Iyer',
    role: 'Tech Lead',
    initials: 'NI',
    accent: '#0b3f9f',
  },
  {
    id: 'vivek',
    quote: [
      { text: 'A ' },
      { text: 'deeply insightful', highlight: true },
      {
        text: ' guide that goes beyond syntax into how you should think about design.',
      },
    ],
    name: 'Vivek Krishnan',
    role: 'Solutions Architect',
    initials: 'VK',
    accent: '#2874d8',
  },
  {
    id: 'sandeep',
    quote: [
      { text: 'I love the ' },
      { text: 'focus on intent, models', highlight: true },
      {
        text: ', and boundaries. It made our codebase conversations sharper overnight.',
      },
    ],
    name: 'Sandeep H.',
    role: 'Staff Engineer',
    initials: 'SH',
    accent: '#082f80',
  },
  {
    id: 'rohit',
    quote: [
      { text: 'Finally a book that explains ' },
      { text: 'why modern Java features exist', highlight: true },
      { text: ', not just how to use them.' },
    ],
    name: 'Rohit Saxena',
    role: 'Engineering Manager',
    initials: 'RS',
    accent: '#0a3a94',
  },
  {
    id: 'aishwarya',
    quote: [
      { text: 'Even ' },
      { text: 'complex topics feel simple', highlight: true },
      { text: '. Clear writing, practical advice, and zero fluff.' },
    ],
    name: 'Aishwarya Menon',
    role: 'Software Engineer',
    initials: 'AM',
    accent: '#073486',
  },
];

export const socialStats: SocialStat[] = [
  {
    id: 'developers',
    label: '1,500+ Developers reading',
    icon: 'users',
  },
  {
    id: 'countries',
    label: '18+ Countries reached',
    icon: 'globe',
  },
  {
    id: 'rating',
    label: '4.9/5 Average reader rating',
    icon: 'shield',
  },
  {
    id: 'rank',
    label: '#1 Hot New Release in Java Programming (Amazon)',
    icon: 'book',
  },
  {
    id: 'examples',
    label: '100+ Code examples and diagrams',
    icon: 'code',
  },
];

export const featuredEndorsement = {
  quote:
    'Pradeep has written a book I wish I had when I started my journey with modern Java. It distills years of experience into practical lessons that developers can apply immediately.',
  name: 'Venkat Subramaniam',
  role: 'Founder, Agile Developer Inc. | Author & Speaker',
  initials: 'VS',
  books: [
    { id: 'fpj', title: 'Functional Programming in Java', short: 'FP in Java' },
    { id: 'agile', title: 'Agile Developer', short: 'Agile Developer' },
  ],
} as const;

export const reviewsMoreLink = {
  label: 'See more reviews on Amazon',
  href: book.amazonUrl,
} as const;
