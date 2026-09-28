/**
 * chunker.js
 *
 * Splits cleaned document text into overlapping, paragraph-aware chunks so
 * long PDFs (textbooks, lecture packs, long reports) can be processed by an
 * LLM whose context window is finite and whose output quality degrades on
 * very long single requests.
 *
 * Strategy:
 *  - Split on paragraph boundaries first (never mid-sentence when avoidable).
 *  - Pack paragraphs into chunks up to a target character budget.
 *  - Carry a small overlap of trailing text into the next chunk so concepts
 *    that straddle a chunk boundary aren't lost/duplicated confusingly.
 */

const DEFAULT_CHUNK_CHARS = 9000; // ~2,200-2,500 tokens of source text per chunk
const DEFAULT_OVERLAP_CHARS = 400;

/**
 * @param {string} text - cleaned full document text
 * @param {object} [options]
 * @param {number} [options.chunkChars]
 * @param {number} [options.overlapChars]
 * @returns {{index: number, text: string}[]}
 */
export function chunkText(text, options = {}) {
  const chunkChars = options.chunkChars || DEFAULT_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }
  };

  for (const paragraph of paragraphs) {
    // A single paragraph longer than the whole chunk budget: hard-split it
    // on sentence boundaries so nothing ever gets silently dropped.
    if (paragraph.length > chunkChars) {
      if (current) {
        pushCurrent();
        current = '';
      }
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceBuffer = '';
      for (const sentence of sentences) {
        if ((sentenceBuffer + ' ' + sentence).length > chunkChars) {
          chunks.push(sentenceBuffer.trim());
          sentenceBuffer = sentence;
        } else {
          sentenceBuffer = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
        }
      }
      if (sentenceBuffer.trim()) {
        current = sentenceBuffer.trim();
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > chunkChars) {
      pushCurrent();
      // start next chunk with overlap tail from the previous chunk for continuity
      const tail = current.slice(-overlapChars);
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    } else {
      current = candidate;
    }
  }
  pushCurrent();

  return chunks.map((chunkTextValue, index) => ({ index, text: chunkTextValue }));
}
