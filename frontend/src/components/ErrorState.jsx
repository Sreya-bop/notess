export default function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card error-state">
      <div className="error-state__icon" aria-hidden="true">
        ⚠
      </div>
      <p className="error-state__title">Something didn't work</p>
      <p className="error-state__message">{message}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Try a different file
      </button>
    </div>
  );
}
