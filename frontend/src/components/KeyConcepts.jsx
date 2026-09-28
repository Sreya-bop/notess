export default function KeyConcepts({ concepts }) {
  if (!concepts || concepts.length === 0) {
    return (
      <div className="state-card">
        <p>No key concepts were extracted from this document.</p>
      </div>
    );
  }

  return (
    <div className="concepts-grid">
      {concepts.map((concept) => (
        <div className="concept-card" key={concept.term}>
          <p className="concept-card__term">{concept.term}</p>
          <p className="concept-card__definition">{concept.definition}</p>
        </div>
      ))}
    </div>
  );
}
