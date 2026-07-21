import type { topics } from '../../data/topics';
import './TopicCard.css';

type Topic = (typeof topics)[number];

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  return (
    <article className="topic-card">
      <img
        src={topic.iconSrc}
        alt=""
        width={56}
        height={56}
        className="topic-card__icon"
        aria-hidden="true"
        decoding="async"
      />
      <h3 className="topic-card__title">{topic.title}</h3>
      <p className="topic-card__description">{topic.description}</p>
    </article>
  );
}
