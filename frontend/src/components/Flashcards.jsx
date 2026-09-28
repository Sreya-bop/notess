import { useMemo, useState } from 'react';

export default function Flashcards({ cards, onDeckComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [seenIds, setSeenIds] = useState(() => new Set());
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);

  const total = cards.length;
  const current = cards[currentIndex];

  const progressPercent = useMemo(
    () => (total > 0 ? Math.round((seenIds.size / total) * 100) : 0),
    [seenIds, total]
  );

  if (!cards || total === 0) {
    return (
      <div className="state-card">
        <p>No flashcards were generated for this document.</p>
      </div>
    );
  }

  const markSeenAndMaybeCelebrate = (id) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (next.size === total && !hasNotifiedComplete) {
        setHasNotifiedComplete(true);
        onDeckComplete?.();
      }
      return next;
    });
  };

  const flip = () => {
    setIsFlipped((f) => !f);
    if (!isFlipped) markSeenAndMaybeCelebrate(current.id);
  };

  const goTo = (nextIndex) => {
    const clamped = (nextIndex + total) % total;
    setCurrentIndex(clamped);
    setIsFlipped(false);
  };

  return (
    <div className="flashcards">
      <div className="flashcards__progress-row">
        <div className="flashcards__progress-track">
          <div className="flashcards__progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="flashcards__progress-label">
          {seenIds.size} / {total} reviewed
        </span>
      </div>

      <div className="flashcards__stage">
        <button
          type="button"
          className="flashcards__nav-btn"
          onClick={() => goTo(currentIndex - 1)}
          aria-label="Previous card"
        >
          ‹
        </button>

        <div
          className={`flip-card ${isFlipped ? 'is-flipped' : ''}`}
          onClick={flip}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') flip();
          }}
          aria-label="Flashcard, click to flip"
        >
          <div className="flip-card__inner">
            <div className="flip-card__face flip-card__face--front">
              <span className="flip-card__label">Question</span>
              <p>{current.question}</p>
              <span className="flip-card__hint">Click to reveal answer</span>
            </div>
            <div className="flip-card__face flip-card__face--back">
              <span className="flip-card__label">Answer</span>
              <p>{current.answer}</p>
              <span className="flip-card__hint">Click to flip back</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="flashcards__nav-btn"
          onClick={() => goTo(currentIndex + 1)}
          aria-label="Next card"
        >
          ›
        </button>
      </div>

      <p className="flashcards__counter">
        Card {currentIndex + 1} of {total}
      </p>
    </div>
  );
}
