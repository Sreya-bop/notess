import { useEffect, useState } from 'react';

const STAGES = [
  'Reading your PDF…',
  'Cleaning up the text…',
  'Splitting it into study-sized pieces…',
  'Writing your notes…',
  'Drafting flashcards…',
  'Almost there…',
];

export default function LoadingState({ fileName }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="state-card loading-state">
      <div className="loading-state__spinner" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="loading-state__file">{fileName}</p>
      <p className="loading-state__stage">{STAGES[stageIndex]}</p>
      <p className="loading-state__hint">
        Longer PDFs take a little more time &mdash; we're reading closely, not skimming.
      </p>
    </div>
  );
}
