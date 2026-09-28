import { useState } from 'react';
import NotesView from './NotesView.jsx';
import KeyConcepts from './KeyConcepts.jsx';
import Flashcards from './Flashcards.jsx';

const TABS = [
  { id: 'notes', label: 'Notes' },
  { id: 'concepts', label: 'Key Concepts' },
  { id: 'flashcards', label: 'Flashcards' },
];

export default function StudyPackView({ studyPack, onStartOver, onDeckComplete }) {
  const [activeTab, setActiveTab] = useState('notes');

  return (
    <div className="study-pack">
      <header className="study-pack__header">
        <div>
          <p className="study-pack__eyebrow">{studyPack.fileName}</p>
          <h2>{studyPack.documentTitle}</h2>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onStartOver}>
          Start over
        </button>
      </header>

      {studyPack.meta?.truncated && (
        <p className="study-pack__notice">
          This document was long, so we focused on the first {studyPack.meta.chunksProcessed} of{' '}
          {studyPack.meta.chunkCount} sections to keep things fast.
        </p>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tabs__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'flashcards' && (
              <span className="tabs__count">{studyPack.flashcards.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="study-pack__panel">
        {activeTab === 'notes' && <NotesView sections={studyPack.sections} />}
        {activeTab === 'concepts' && <KeyConcepts concepts={studyPack.keyConcepts} />}
        {activeTab === 'flashcards' && (
          <Flashcards cards={studyPack.flashcards} onDeckComplete={onDeckComplete} />
        )}
      </div>
    </div>
  );
}
