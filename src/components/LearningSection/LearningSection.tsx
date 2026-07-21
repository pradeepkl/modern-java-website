import { topics } from '../../data/topics';
import { SectionHeading } from '../shared/SectionHeading';
import { TopicCard } from './TopicCard';
import './LearningSection.css';

export function LearningSection() {
  return (
    <section
      id="what-you-will-learn"
      className="learning-section"
      aria-labelledby="learn-heading"
    >
      <div className="learning-section__inner page-container">
        <SectionHeading id="learn-heading" variant="landing">
          What you&apos;ll learn
        </SectionHeading>

        <div className="learning-grid">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </div>
    </section>
  );
}
