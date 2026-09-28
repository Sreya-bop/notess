import { useEffect, useState } from 'react';

/**
 * A small, dismissible note that pops in from the corner with a brief,
 * genuine bit of encouragement. Deliberately subtle: one appearance,
 * auto-fades if ignored, never blocks the interface.
 */
export default function MotivationalNote({ message, show, onDismiss, autoHideMs = 6000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return undefined;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(timer);
  }, [show, autoHideMs]);

  if (!show) return null;

  return (
    <div className={`motivational-note ${visible ? 'is-visible' : 'is-hidden'}`} role="status">
      <span className="motivational-note__icon" aria-hidden="true">
        ✦
      </span>
      <p>{message}</p>
      <button
        type="button"
        className="motivational-note__close"
        aria-label="Dismiss"
        onClick={() => {
          setVisible(false);
          onDismiss?.();
        }}
      >
        ×
      </button>
    </div>
  );
}
