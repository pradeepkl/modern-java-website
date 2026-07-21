import type { LucideIcon } from 'lucide-react';
import { Lightbulb, ShieldCheck, Target } from 'lucide-react';

export interface WhyThisBookItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const whyThisBookItems: WhyThisBookItem[] = [
  {
    id: 'clearer-intent',
    title: 'Clearer intent',
    description:
      'Design code that communicates purpose, not just mechanics.',
    icon: Target,
  },
  {
    id: 'safer-design',
    title: 'Safer design',
    description:
      'Leverage the type system and compiler to catch mistakes early.',
    icon: ShieldCheck,
  },
  {
    id: 'modern-mindset',
    title: 'Modern Java mindset',
    description:
      'Think in terms of intent, models, and boundaries—not just syntax.',
    icon: Lightbulb,
  },
];
