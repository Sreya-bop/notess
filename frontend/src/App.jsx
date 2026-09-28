import { useState } from 'react';
import Dropzone from './components/Dropzone.jsx';
import LoadingState from './components/LoadingState.jsx';
import ErrorState from './components/ErrorState.jsx';
import StudyPackView from './components/StudyPackView.jsx';
import MotivationalNote from './components/MotivationalNote.jsx';
import { processPdf } from './api.js';

const LOADING_MESSAGES = [
  "Good notes take a minute to make well — hang tight.",
  "While this works, take a breath. Studying starts calmer than you think.",
];

const COMPLETION_MESSAGES = [
  "You've been through every card once. That's real progress.",
  "First full pass done — the second time through is where it sticks.",
];

function pickMessage(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function App() {
  const [appState, setAppState] = useState('idle'); // idle | loading | success | error
  const [fileName, setFileName] = useState('');
  const [studyPack, setStudyPack] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showLoadingNote, setShowLoadingNote] = useState(false);
  const [showCompletionNote, setShowCompletionNote] = useState(false);
  const [loadingMessage] = useState(() => pickMessage(LOADING_MESSAGES));
  const [completionMessage] = useState(() => pickMessage(COMPLETION_MESSAGES));

  const handleFileSelected = async (file) => {
    setFileName(file.name);
    setAppState('loading');
    setErrorMessage('');
    setShowLoadingNote(true);

    try {
      const result = await processPdf(file);
      setStudyPack(result);
      setAppState('success');
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong.');
      setAppState('error');
    }
  };

  const handleStartOver = () => {
    setAppState('idle');
    setStudyPack(null);
    setFileName('');
    setErrorMessage('');
    setShowCompletionNote(false);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
            📖
          </span>
          <span className="app-header__name">Nook</span>
        </div>
        <p className="app-header__tagline">Turn any PDF into notes you'll actually study</p>
      </header>

      <main className="app-main">
        {appState === 'idle' && (
          <div className="state-card empty-state">
            <Dropzone onFileSelected={handleFileSelected} />
            <p className="empty-state__hint">
              Upload lecture slides, a textbook chapter, or a reading — we'll pull out the key
              ideas and build flashcards from it.
            </p>
          </div>
        )}

        {appState === 'loading' && <LoadingState fileName={fileName} />}

        {appState === 'error' && <ErrorState message={errorMessage} onRetry={handleStartOver} />}

        {appState === 'success' && studyPack && (
          <StudyPackView
            studyPack={studyPack}
            onStartOver={handleStartOver}
            onDeckComplete={() => setShowCompletionNote(true)}
          />
        )}
      </main>

      <MotivationalNote
        message={loadingMessage}
        show={showLoadingNote && appState === 'loading'}
        onDismiss={() => setShowLoadingNote(false)}
      />
      <MotivationalNote
        message={completionMessage}
        show={showCompletionNote}
        onDismiss={() => setShowCompletionNote(false)}
      />
    </div>
  );
}
