import type { LucideIcon } from 'lucide-react';
import { Building2, GraduationCap, PenLine } from 'lucide-react';

export interface AuthorFocus {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const authorProfile = {
  eyebrow: 'About the author',
  name: 'Pradeep Kumar L',
  role: 'Architect. Trainer. Author.',
  introduction:
    'Pradeep brings more than two decades of software development and architecture experience to the ideas in Modern Java.',
  biography:
    'His work spans enterprise platforms, distributed systems, and developer education. He helps teams move beyond language syntax to make clearer design decisions, use the compiler as a partner, and build systems that remain understandable as they evolve.',
  perspective:
    'I wrote this book to connect modern Java features to the design problems they actually solve—not as isolated syntax, but as a practical way to express intent.',
} as const;

export const authorFocus: AuthorFocus[] = [
  {
    id: 'architecture',
    title: 'Enterprise architecture',
    description:
      'Designing resilient platforms and guiding systems through long-term change.',
    icon: Building2,
  },
  {
    id: 'education',
    title: 'Developer education',
    description:
      'Turning complex language and design concepts into decisions teams can apply.',
    icon: GraduationCap,
  },
  {
    id: 'writing',
    title: 'Practitioner-led writing',
    description:
      'Grounding every lesson in the trade-offs developers encounter in real codebases.',
    icon: PenLine,
  },
];
