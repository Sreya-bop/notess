/**
 * textCleaner.js
 *
 * Cleans raw text pulled out of a PDF by pdf-parse. PDF text extraction is
 * messy by nature: hyphenated line breaks, repeated headers/footers, stray
 * page-number lines, and inconsistent whitespace. This module turns that
 * into readable, model-friendly text before it gets chunked and sent to
 * the AI service.
 */

/**
 * Removes lines that repeat identically across many pages (likely running
 * headers/footers) by counting line frequency across the whole document.
 * @param {string[]} pages - array of raw per-page text
 * @returns {string[]} pages with repeated boilerplate lines removed
 */
function stripRepeatedHeadersFooters(pages) {
  if (pages.length < 3) return pages; // not enough pages to detect a pattern reliably

  const lineCounts = new Map();
  const perPageLines = pages.map((page) =>
    page.split('\n').map((l) => l.trim())
  );

  for (const lines of perPageLines) {
    const seenOnThisPage = new Set(lines.filter(Boolean));
    for (const line of seenOnThisPage) {
      lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
    }
  }

  const pageCount = pages.length;
  const repeatThreshold = Math.max(3, Math.floor(pageCount * 0.6));

  return perPageLines.map((lines) =>
    lines
      .filter((line) => {
        if (!line) return true; // keep blank lines for paragraph structure
        const count = lineCounts.get(line) || 0;
        // Drop short lines (typical of headers/footers/page numbers) that repeat a lot
        return !(count >= repeatThreshold && line.length < 80);
      })
      .join('\n')
  );
}

/**
 * Rejoins words that were split across a line break with a hyphen,
 * e.g. "under-\nstanding" -> "understanding".
 */
function dehyphenate(text) {
  return text.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');
}

/**
 * Collapses excessive whitespace while preserving paragraph breaks.
 */
function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +\n/g, '\n')
    .trim();
}

/**
 * Drops lines that are just a page number (e.g. "12", "Page 12", "- 12 -").
 */
function stripStandalonePageNumbers(text) {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !/^(page\s*)?[-–—]?\s*\d{1,4}\s*[-–—]?$/i.test(trimmed);
    })
    .join('\n');
}

/**
 * Main entry point: takes an array of per-page raw text strings (as produced
 * during extraction) and returns a single cleaned string ready for chunking.
 *
 * @param {string[]} pages
 * @returns {string} cleaned full-document text
 */
export function cleanExtractedText(pages) {
  const withoutBoilerplate = stripRepeatedHeadersFooters(pages);
  const joined = withoutBoilerplate.join('\n\n');
  const dehyphenated = dehyphenate(joined);
  const withoutPageNumbers = stripStandalonePageNumbers(dehyphenated);
  const normalized = normalizeWhitespace(withoutPageNumbers);
  return normalized;
}

/**
 * Quick heuristic to detect PDFs that extracted to little or no real text
 * (e.g. scanned image-only PDFs with no OCR layer), so the API can return
 * a clear, honest error instead of silently generating garbage notes.
 */
export function looksLikeUsableText(text, pageCount) {
  const words = text.split(/\s+/).filter(Boolean);
  const avgWordsPerPage = pageCount > 0 ? words.length / pageCount : 0;
  return words.length >= 40 && avgWordsPerPage >= 10;
}
