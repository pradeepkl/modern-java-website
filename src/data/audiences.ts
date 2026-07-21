import type { LucideIcon } from 'lucide-react';
import { Code2, Layers, TrendingUp, Users } from 'lucide-react';

export interface Audience {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const audiences: Audience[] = [
  {
    id: 'java-developers',
    label: 'Java developers ready to level up',
    icon: TrendingUp,
  },
  {
    id: 'engineers',
    label: 'Engineers building real-world systems',
    icon: Layers,
  },
  {
    id: 'teams',
    label: 'Teams adopting modern Java',
    icon: Users,
  },
  {
    id: 'clearer-code',
    label: 'Anyone who wants clearer, safer code',
    icon: Code2,
  },
];
