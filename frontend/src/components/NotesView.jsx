import { renderNotes } from '../utils/renderNotes.jsx';

export default function NotesView({ sections }) {
  if (!sections || sections.length === 0) {
    return (
      <div className="state-card">
        <p>No notes were generated for this document.</p>
      </div>
    );
  }

  return (
    <div className="notes-view">
      {sections.map((section) => (
        <article className="notes-view__section" key={section.order}>
          <h3>{section.title}</h3>
          <div className="notes-view__body">{renderNotes(section.notes)}</div>
        </article>
      ))}
    </div>
  );
}
