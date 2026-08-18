export interface PurposePoint {
  id: string;
  title: string;
  description: string;
}

export const purposeIntro = {
  eyebrow: 'Why this book exists',
  title: 'This is definitely not another Java book.',
  description:
    'Most Java books show you what to use. This book explains why it exists—and how to think, design, and code with intent.',
} as const;

export const purposePoints: PurposePoint[] = [
  {
    id: 'catalog',
    title: 'Not a feature catalog',
    description:
      'Every topic is chosen because it helps you design and code better systems—not to fill a checklist of syntax.',
  },
  {
    id: 'versions',
    title: 'Not version-by-version Java',
    description:
      'The focus is on durable principles and how modern Java enables them across releases.',
  },
  {
    id: 'mindset',
    title: 'Focuses on engineering mindset',
    description:
      'Move from code that merely works to software that communicates intent and adapts to change.',
  },
  {
    id: 'why',
    title: 'Explains why features exist',
    description:
      'Understand the design problem behind each feature before deciding when and how to use it.',
  },
  {
    id: 'compiler',
    title: 'Connects the compiler and type system',
    description:
      'Learn how modern Java shifts responsibility to the compiler so mistakes surface earlier.',
  },
  {
    id: 'expressive',
    title: 'Helps you write expressive software',
    description:
      'Model your domain, enforce invariants, and build systems that remain clear as they evolve.',
  },
];

export const purposeGoal = {
  title:
    'The goal is simple: help you write code that communicates intent and design systems that last.',
  description: 'Less boilerplate. More intent. Better software.',
} as const;
