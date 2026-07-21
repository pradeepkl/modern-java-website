import type { learningOutcomes } from '../../data/learning';
import './LearningCard.css';

type LearningOutcome = (typeof learningOutcomes)[number];

interface LearningCardProps {
  outcome: LearningOutcome;
}

export function LearningCard({ outcome }: LearningCardProps) {
  return (
    <article className="learning-card">
      <img
        src={outcome.iconSrc}
        alt=""
        width={62}
        height={62}
        className="learning-card__icon"
        aria-hidden="true"
        decoding="async"
      />
      <h3 className="learning-card__title">{outcome.title}</h3>
      <p className="learning-card__description">{outcome.description}</p>
    </article>
  );
}
