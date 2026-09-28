import { useCallback, useRef, useState } from 'react';

const MAX_MB = 25;

export default function Dropzone({ onFileSelected }) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  const validateAndSend = useCallback(
    (file) => {
      if (!file) return;
      if (file.type !== 'application/pdf') {
        setLocalError('Only PDF files are supported.');
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setLocalError(`That file is over ${MAX_MB}MB. Try a smaller PDF.`);
        return;
      }
      setLocalError('');
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      validateAndSend(file);
    },
    [validateAndSend]
  );

  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        aria-label="Upload a PDF by dragging it here or clicking to browse"
      >
        <div className="dropzone__icon" aria-hidden="true">
          📄
        </div>
        <p className="dropzone__title">Drop your PDF here</p>
        <p className="dropzone__subtitle">or click to browse &middot; max {MAX_MB}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => validateAndSend(e.target.files?.[0])}
        />
      </div>
      {localError && <p className="dropzone__error">{localError}</p>}
    </div>
  );
}
