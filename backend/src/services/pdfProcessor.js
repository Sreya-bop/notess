/**
 * pdfProcessor.js
 *
 * Wraps `pdf-parse` to extract per-page text from an uploaded PDF buffer.
 * We capture text page-by-page (rather than just one flat string) because
 * the cleaning step needs page boundaries to reliably detect repeated
 * headers/footers.
 */
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * @param {Buffer} fileBuffer
 * @returns {Promise<{ pages: string[], pageCount: number, info: object }>}
 */
export async function extractPdfText(fileBuffer) {
  const pages = [];

  await pdfParse(fileBuffer, {
    // pdf-parse calls this once per page during parsing; we stash each
    // page's text so downstream cleaning can work per-page.
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      pages.push(pageText);
      return pageText;
    },
  });

  return {
    pages,
    pageCount: pages.length,
  };
}
