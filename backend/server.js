/**
 * server.js
 *
 * Entry point for the PDF Notes & Flashcards backend. Loads environment
 * variables, wires up CORS + JSON middleware, mounts the API routes, and
 * starts the HTTP server.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { processRouter } from './src/routes/process.js';
import { checkOllamaStatus } from './src/services/aiService.js';

const app = express();
const PORT = process.env.PORT || 5050;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Allow the configured local origin, plus any GitHub Codespaces forwarded
// frontend origin (these look like "https://<name>-5173.app.github.dev"
// and change per Codespace, so we match the pattern rather than one fixed URL).
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin / non-browser requests
      if (origin === CORS_ORIGIN) return callback(null, true);
      try {
        const { hostname } = new URL(origin);
        if (/\.app\.github\.dev$/.test(hostname)) return callback(null, true);
      } catch {
        // fall through to rejection below
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const ollama = await checkOllamaStatus();
  res.json({
    status: 'ok',
    ollamaReachable: ollama.reachable,
    modelConfigured: ollama.model,
    modelAvailable: ollama.modelAvailable,
  });
});

app.use('/api', processRouter);

// Fallback error handler (e.g. malformed JSON bodies)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, async () => {
  console.log(`PDF Notes & Flashcards backend listening on http://localhost:${PORT}`);

  const ollama = await checkOllamaStatus();
  if (!ollama.reachable) {
    console.warn(
      `\n⚠️  Could not reach Ollama at ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}.\n` +
        '   Install it from https://ollama.com, then run "ollama serve" (or open the Ollama app) before uploading a PDF.\n'
    );
  } else if (!ollama.modelAvailable) {
    console.warn(
      `\n⚠️  Ollama is running, but the model "${ollama.model}" isn't pulled yet.\n` +
        `   Run: ollama pull ${ollama.model}\n`
    );
  } else {
    console.log(`✓ Ollama is running and "${ollama.model}" is ready.`);
  }
});
