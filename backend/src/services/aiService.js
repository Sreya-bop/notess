/**
 * aiService.js
 *
 * Talks to a LOCAL Ollama server (https://ollama.com) to turn cleaned,
 * chunked PDF text into:
 *   - structured notes (a title + markdown-style bullet notes) per chunk
 *   - a de-duplicated list of key concepts (term + plain-language definition)
 *   - high-quality question/answer flashcards
 *
 * No API key, account, or internet connection is required at generation
 * time: Ollama runs the model entirely on your own machine and exposes a
 * local HTTP API at OLLAMA_BASE_URL (default http://localhost:11434).
 *
 * Pipeline shape: this is a "map" over chunks (one local-model call per
 * chunk, run with bounded concurrency) followed by a lightweight in-process
 * "reduce" that merges/de-duplicates the per-chunk results. We deliberately
 * avoid a second giant synthesis LLM call over the whole document, because
 * that reintroduces the same context-length problem chunking was meant to
 * solve. See README.md "AI pipeline" for the rationale.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 8192;
// Local models typically run one request at a time on consumer hardware
// (one GPU/CPU, one model loaded), so default concurrency is conservative.
const CONCURRENCY = Number(process.env.OLLAMA_CONCURRENCY) || 1;
const MAX_CHUNKS_PROCESSED = 10; // bounds latency on very long documents when running locally
const FLASHCARDS_PER_CHUNK = 5;
const MAX_TOTAL_FLASHCARDS = 60;

/**
 * Checks whether Ollama is reachable and whether the configured model has
 * been pulled. Used by the /api/health route and the startup warning.
 */
export async function checkOllamaStatus() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) {
      return { reachable: false, modelAvailable: false, model: MODEL };
    }
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const modelAvailable = models.some(
      (name) => name === MODEL || name.startsWith(`${MODEL}:`)
    );
    return { reachable: true, modelAvailable, model: MODEL, installedModels: models };
  } catch {
    return { reachable: false, modelAvailable: false, model: MODEL };
  }
}

const SYSTEM_PROMPT = `You are an expert study coach and teacher who turns raw textbook/lecture excerpts into excellent study material for students.

You always respond with ONLY a single valid JSON object and nothing else: no markdown code fences, no commentary before or after.

Rules for quality:
- Notes should be clear, well-organized, and written in your own words (never copy long verbatim passages from the source).
- Key concepts should be genuinely important terms/ideas from the excerpt, each with a short, precise, student-friendly definition (1-2 sentences).
- Flashcards must test real understanding, not trivial recall of a single word. Prefer "why/how/compare/apply" style questions where the source supports it, mixed with clear factual questions where appropriate. Answers should be concise but complete (1-3 sentences).
- If the excerpt is a fragment (e.g. starts or ends mid-sentence because it's one chunk of a larger document), still produce your best coherent output for the content that is present.
- Never invent facts that are not supported by the excerpt.`;

function buildChunkPrompt(chunk, chunkIndex, totalChunks, fileName) {
  return `Source document: "${fileName}"
This is chunk ${chunkIndex + 1} of ${totalChunks} from the document (chunks are sequential excerpts, in order).

Excerpt text:
"""
${chunk.text}
"""

Return ONLY a JSON object with this exact shape:
{
  "sectionTitle": "short descriptive title for what this excerpt covers (max 8 words)",
  "notes": "markdown-style study notes for this excerpt, using short paragraphs and '- ' bullet points where useful",
  "keyConcepts": [ { "term": "string", "definition": "string" } ],
  "flashcards": [ { "question": "string", "answer": "string" } ]
}

Produce between 3 and 8 keyConcepts and exactly ${FLASHCARDS_PER_CHUNK} flashcards for this excerpt (fewer only if the excerpt is very short).`;
}

function safeParseJson(rawText) {
  // Models occasionally wrap JSON in code fences despite instructions; strip defensively.
  const stripped = rawText
    .trim()
    .replace(/^```(json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (err) {
    throw new Error(`AI response was not valid JSON: ${err.message}`);
  }
}

async function generateForChunk(chunk, chunkIndex, totalChunks, fileName) {
  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: 'json', // ask Ollama to constrain output to valid JSON
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildChunkPrompt(chunk, chunkIndex, totalChunks, fileName) },
        ],
        options: {
          temperature: 0.4,
          num_ctx: NUM_CTX,
          num_predict: 2000,
        },
      }),
    });
  } catch (networkErr) {
    const err = new Error(
      `Could not reach Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is installed and running (run "ollama serve" or open the Ollama app).`
    );
    err.code = 'OLLAMA_UNREACHABLE';
    throw err;
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    if (response.status === 404 || /model .* not found/i.test(bodyText)) {
      const err = new Error(
        `The model "${MODEL}" is not installed in Ollama yet. Run: ollama pull ${MODEL}`
      );
      err.code = 'MODEL_NOT_FOUND';
      throw err;
    }
    const err = new Error(`Ollama returned an error (status ${response.status}): ${bodyText}`);
    err.code = 'OLLAMA_ERROR';
    throw err;
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (!content) {
    throw new Error('Ollama response contained no content.');
  }
  return safeParseJson(content);
}

/** Runs async work over items with a bounded number of concurrent in-flight calls. */
async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
  return results;
}

function mergeKeyConcepts(perChunkResults) {
  const seen = new Map(); // lowercase term -> { term, definition }
  for (const result of perChunkResults) {
    for (const concept of result.keyConcepts || []) {
      const key = (concept.term || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, { term: concept.term.trim(), definition: concept.definition?.trim() || '' });
    }
  }
  return Array.from(seen.values());
}

function mergeFlashcards(perChunkResults) {
  const cards = [];
  for (const result of perChunkResults) {
    for (const card of result.flashcards || []) {
      if (!card.question || !card.answer) continue;
      cards.push({
        id: `card-${cards.length + 1}`,
        question: card.question.trim(),
        answer: card.answer.trim(),
      });
      if (cards.length >= MAX_TOTAL_FLASHCARDS) return cards;
    }
  }
  return cards;
}

/**
 * @param {{index:number, text:string}[]} chunks
 * @param {string} fileName
 * @param {(progress: {completed:number, total:number}) => void} [onProgress]
 */
export async function generateStudyPack(chunks, fileName, onProgress) {
  const boundedChunks = chunks.slice(0, MAX_CHUNKS_PROCESSED);
  const truncated = chunks.length > boundedChunks.length;

  let completed = 0;
  const perChunkResults = await runWithConcurrency(
    boundedChunks,
    async (chunk, idx) => {
      const result = await generateForChunk(chunk, idx, boundedChunks.length, fileName);
      completed += 1;
      if (onProgress) onProgress({ completed, total: boundedChunks.length });
      return result;
    },
    CONCURRENCY
  );

  const sections = perChunkResults.map((result, idx) => ({
    order: idx,
    title: result.sectionTitle || `Section ${idx + 1}`,
    notes: result.notes || '',
  }));

  return {
    documentTitle: fileName.replace(/\.pdf$/i, ''),
    sections,
    keyConcepts: mergeKeyConcepts(perChunkResults),
    flashcards: mergeFlashcards(perChunkResults),
    meta: {
      chunkCount: chunks.length,
      chunksProcessed: boundedChunks.length,
      truncated,
    },
  };
}
