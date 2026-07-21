import { Check } from 'lucide-react';
import './shared.css';

interface CheckListProps {
  items: readonly string[];
  className?: string;
  light?: boolean;
}

export function CheckList({ items, className = '', light = false }: CheckListProps) {
  const toneClass = light ? 'check-list--light' : '';

  return (
    <ul className={`check-list ${toneClass} ${className}`}>
      {items.map((item) => (
        <li key={item} className="check-list__item">
          <span className="check-list__icon" aria-hidden="true">
            <Check size={16} strokeWidth={2.5} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
