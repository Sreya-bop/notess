/**
 * Turns the simple markdown-style notes text the AI produces (paragraphs +
 * "- " bullet lines) into React elements, without pulling in a full
 * markdown parser dependency for what is intentionally a narrow format.
 */
export function renderNotes(notesText) {
  if (!notesText) return null;
  const lines = notesText.split('\n');
  const blocks = [];
  let currentList = null;

  const flushList = () => {
    if (currentList) {
      blocks.push(
        <ul key={`list-${blocks.length}`}>
          {currentList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      currentList = null;
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList = currentList || [];
      currentList.push(line.slice(2));
    } else {
      flushList();
      blocks.push(<p key={`p-${idx}`}>{line}</p>);
    }
  });
  flushList();

  return blocks;
}
