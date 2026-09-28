/**
 * routes/process.js
 *
 * POST /api/process
 *   Accepts a single PDF upload (multipart/form-data, field name "pdf"),
 *   runs it through the full pipeline (extract -> clean -> chunk -> AI
 *   generate), and returns the resulting study pack as JSON.
 *
 * This is intentionally one endpoint that does the whole pipeline
 * synchronously: it keeps the architecture simple and easy to run locally.
 * For very large PDFs this request can take a while (see README for
 * timing/cost notes); the frontend shows a loading state while it waits.
 */
import { Router } from 'express';
import multer from 'multer';

import { extractPdfText } from '../services/pdfProcessor.js';
import { cleanExtractedText, looksLikeUsableText } from '../utils/textCleaner.js';
import { chunkText } from '../services/chunker.js';
import { generateStudyPack } from '../services/aiService.js';

export const processRouter = Router();

const maxUploadBytes = (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are supported.'));
    }
    cb(null, true);
  },
});

processRouter.post('/process', (req, res) => {
  upload.single('pdf')(req, res, async (multerErr) => {
    if (multerErr) {
      const status = multerErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        multerErr.code === 'LIMIT_FILE_SIZE'
          ? `File is too large. Max size is ${process.env.MAX_UPLOAD_MB || 25}MB.`
          : multerErr.message;
      return res.status(status).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file was uploaded. Attach a file under field name "pdf".' });
    }

    try {
      const { pages, pageCount } = await extractPdfText(req.file.buffer);

      if (pageCount === 0) {
        return res.status(422).json({
          error: 'Could not read any pages from this PDF. The file may be corrupted.',
        });
      }

      const cleanedText = cleanExtractedText(pages);

      if (!looksLikeUsableText(cleanedText, pageCount)) {
        return res.status(422).json({
          error:
            'This PDF has little or no extractable text. It may be a scanned/image-only document without OCR text, which this tool cannot process.',
        });
      }

      const chunks = chunkText(cleanedText);

      const studyPack = await generateStudyPack(chunks, req.file.originalname);

      return res.json({
        fileName: req.file.originalname,
        pageCount,
        characterCount: cleanedText.length,
        ...studyPack,
      });
    } catch (err) {
      if (err.code === 'OLLAMA_UNREACHABLE') {
        return res.status(503).json({ error: err.message });
      }
      if (err.code === 'MODEL_NOT_FOUND') {
        return res.status(503).json({ error: err.message });
      }
      console.error('Processing error:', err);
      return res.status(500).json({
        error: 'Something went wrong while generating your notes. Please try again.',
      });
    }
  });
});
