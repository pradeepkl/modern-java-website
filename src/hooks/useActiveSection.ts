import { useEffect, useState } from 'react';

const SECTION_IDS = [
  'top',
  'why-this-book',
  'about-the-book',
  'inside-the-book',
  'author',
  'formats',
] as const;

export type ActiveSection = (typeof SECTION_IDS)[number] | '';

export function useActiveSection() {
  const [active, setActive] = useState<ActiveSection>('top');

  useEffect(() => {
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      Boolean,
    ) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActive(visible[0].target.id as ActiveSection);
        }
      },
      {
        rootMargin: '-40% 0px -45% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}
