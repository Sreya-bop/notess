# Nook — PDF Notes & Flashcards

Upload a PDF (lecture slides, a textbook chapter, a reading) and get back
clean, organized notes, a list of key concepts, and a deck of interactive
Q&A flashcards — generated entirely by a **free, local AI model running on
your own computer**. No API key, no account, no billing, and your PDF
content never leaves your machine.

---

## 1. Tech stack, and why

| Layer     | Choice                                   | Why |
|-----------|-------------------------------------------|-----|
| Frontend  | **React 18 + Vite**                        | Fast local dev server, no config ceremony, small bundle. Plain CSS (no UI framework) so the design stays intentional rather than templated. |
| Backend   | **Node.js + Express**                      | Same language as the frontend, minimal boilerplate, easy to read end-to-end for a project this size. |
| PDF text extraction | **pdf-parse**                    | Mature, dependency-light library for pulling text (and per-page text) out of PDFs without needing a headless browser or external service. |
| AI model  | **Ollama** (local LLM runtime), default model `llama3.1` | Runs entirely offline on your own hardware — no API key, no account, no cost, no data leaving your machine. Ollama exposes a simple local HTTP API that the backend calls directly with `fetch` (no extra SDK needed). Model is swappable via `.env`. |
| Uploads   | **Multer** (memory storage)                | Simple multipart handling; the file never touches disk, it's processed straight from the upload buffer. |

No database is used — this is a stateless "upload → process → view" tool,
so there's nothing to persist between sessions.

### Why Ollama instead of a cloud API

Ollama downloads an open-weight model once and runs it locally using your
CPU/GPU. That means: no API key to manage, no per-request cost, no rate
limits, and your PDF's content is never sent anywhere over the internet.
The tradeoff is speed and quality: a local model on a laptop is slower
than a cloud model and can be somewhat less polished, which is why the
prompts, chunk size, and concurrency in this project are tuned for
realistic local hardware (see "AI pipeline" below).

---

## 2. Folder structure

```
pdf-notes-flashcards/
├── .devcontainer/                  # Auto-setup config for GitHub Codespaces (optional)
│   ├── devcontainer.json
│   ├── setup.sh                     # Installs Ollama + deps, runs once on Codespace creation
│   └── start-ollama.sh              # Ensures Ollama is running, runs on every Codespace start
├── backend/
│   ├── server.js                  # Express app entry point
│   ├── package.json
│   ├── .env.example                # Copy to .env and fill in your key
│   ├── uploads/                    # Empty; multer uses memory storage, not this folder
│   └── src/
│       ├── routes/
│       │   └── process.js          # POST /api/process — the whole pipeline
│       ├── services/
│       │   ├── pdfProcessor.js     # PDF -> per-page raw text (pdf-parse)
│       │   ├── chunker.js          # cleaned text -> paragraph-aware chunks
│       │   └── aiService.js        # chunks -> Claude calls -> merged study pack
│       └── utils/
│           └── textCleaner.js      # raw per-page text -> cleaned document text
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example                # Only needed if backend isn't on the default port
│   └── src/
│       ├── main.jsx                 # React root
│       ├── App.jsx                  # State machine: idle/loading/success/error
│       ├── api.js                   # fetch wrapper for the backend API
│       ├── components/
│       │   ├── Dropzone.jsx         # Drag-and-drop + click-to-browse upload
│       │   ├── LoadingState.jsx
│       │   ├── ErrorState.jsx
│       │   ├── StudyPackView.jsx    # Tab nav: Notes / Key Concepts / Flashcards
│       │   ├── NotesView.jsx
│       │   ├── KeyConcepts.jsx
│       │   ├── Flashcards.jsx       # Flip card, nav, progress tracking
│       │   └── MotivationalNote.jsx # The two subtle encouragement dialogs
│       ├── utils/
│       │   └── renderNotes.jsx      # Tiny markdown-ish -> JSX renderer
│       └── styles/
│           └── index.css            # Design system + all component styles
├── .gitignore
└── README.md
```

---

## 3. Setup

### Prerequisites
- Node.js 18+ and npm
- **Ollama**, installed and running (free, no account needed): download from
  https://ollama.com for Windows, Mac, or Linux and install it like any
  normal application.

### 0. Install Ollama and pull a model (one-time setup)

After installing Ollama, open a terminal and run:

```bash
ollama pull llama3.1
```

This downloads the default model this project uses (about 4.7GB). On
Windows/Mac, installing Ollama also sets it up to run automatically in the
background; on Linux you may need to start it yourself with `ollama serve`.

**If your computer has limited RAM/no dedicated GPU**, use a smaller model
instead — it'll respond faster with a modest quality tradeoff:

```bash
ollama pull llama3.2      # ~2GB, needs ~8GB RAM
# or
ollama pull phi3          # ~2.3GB, similarly light
```

If you pull a different model than `llama3.1`, set `OLLAMA_MODEL` in
`backend/.env` (see below) to match.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

No editing of `.env` is required for the default setup — it already points
at `http://localhost:11434` (Ollama's default address) and the `llama3.1`
model. The backend starts on **http://localhost:5050**. Visiting
`http://localhost:5050/api/health` should return something like
`{"status":"ok","ollamaReachable":true,"modelAvailable":true}`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173** (Vite's default). Open
that URL in a browser and upload a PDF.

> If you change the backend's port, also copy `frontend/.env.example` to
> `frontend/.env` and update `VITE_API_BASE_URL` to match.

### Environment variables

**`backend/.env`** (see `backend/.env.example`) — no API keys involved:

| Variable | Required | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | No (default `http://localhost:11434`) | Where your local Ollama server is running. |
| `OLLAMA_MODEL` | No (default `llama3.1`) | Which locally-installed model to use. Must match a model you've pulled. |
| `OLLAMA_NUM_CTX` | No (default `8192`) | Context window (tokens) requested per call — large enough to fit one chunk plus the response. |
| `OLLAMA_CONCURRENCY` | No (default `1`) | How many chunks to send to Ollama at once. Local models usually handle one request at a time. |
| `PORT` | No (default `5050`) | Backend server port. |
| `CORS_ORIGIN` | No (default `http://localhost:5173`) | Which frontend origin may call the API. |
| `MAX_UPLOAD_MB` | No (default `25`) | Max accepted PDF size. |

**`frontend/.env`** (see `frontend/.env.example`, optional):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL, if not the default `http://localhost:5050`. |

There is nothing secret to protect here since no cloud API key is used —
but the `.gitignore` still excludes `.env` files as good practice, since
you may later point `OLLAMA_BASE_URL` at an internal/private server.

### Deployment notes

This is two independent Node processes (an API and a static/SPA frontend),
plus Ollama as a third local process:
- **Backend**: deploy as a normal Node service (Render, Railway, Fly.io, a VPS, etc.). Ollama and the model need to be installed and reachable on whatever machine runs the backend — this generally means self-hosting on your own server/VPS rather than a typical serverless platform, since Ollama needs a persistent process and real CPU/GPU. Update `CORS_ORIGIN` to your deployed frontend's URL and `OLLAMA_BASE_URL` if Ollama runs on a different host/port there.
- **Frontend**: run `npm run build` in `frontend/` to produce `frontend/dist/`, then serve that as a static site (Vercel, Netlify, Cloudflare Pages, or any static host), setting `VITE_API_BASE_URL` at build time to your deployed backend's URL.
- For most people, the simplest path is just running everything locally as described above — that's what this project is optimized for.

---

## 4. Running it in GitHub Codespaces (no local installs at all)

If you'd rather not install Node or Ollama on your own computer, this repo
includes a `.devcontainer/` configuration that runs the entire project in a
free, browser-based GitHub Codespace instead.

### Push this project to GitHub

The simplest way, with no command line needed:
1. Install **GitHub Desktop** (free) from https://desktop.github.com and sign in with (or create) a GitHub account.
2. In GitHub Desktop, choose **File → Add Local Repository** and select this unzipped `pdf-notes-flashcards` folder.
3. Click **Publish repository** (top bar). Give it a name and click Publish. Either "public" or "private" works.

### Open it as a Codespace

1. On github.com, open the repository you just published.
2. Click the green **Code** button → the **Codespaces** tab → **Create codespace on main**.
3. Wait for it to finish setting up (a few minutes the first time) — it automatically installs Ollama, pulls a lightweight model (`phi3`), and runs `npm install` in both `backend/` and `frontend/` for you. You'll see this progress in a terminal at the bottom of the screen.

### Run the app inside the Codespace

Once setup finishes, you'll have a terminal open at the repo root:

```bash
cd backend
npm run dev
```

Open a second terminal (the `+` button next to the terminal tabs) and run:

```bash
cd frontend
npm run dev
```

A popup should appear saying a service is running on port 5173 — click
**Open in Browser**. That opens the actual website in a new tab, running
entirely in the cloud. Upload a PDF and try it out; no local install of
Node, Ollama, or anything else was required.

**Notes specific to Codespaces:**
- The frontend automatically detects it's running in a Codespace and points itself at the matching backend URL — no manual configuration needed (see `frontend/src/api.js`).
- The default model here is `phi3` (smaller/faster) rather than `llama3.1`, because Codespaces run on modest shared hardware. You can pull a different model with `ollama pull <model>` in the terminal and change `OLLAMA_MODEL` in `backend/.env` to match.
- Free GitHub accounts include a monthly quota of Codespaces usage hours; check github.com/settings/billing if you're unsure how much you have left.
- If you stop and later reopen the same Codespace, Ollama restarts automatically (`postStartCommand` in `.devcontainer/devcontainer.json`) — you shouldn't need to redo setup.

---

## 5. Architecture & data flow

```
 ┌──────────┐   drag/drop PDF    ┌───────────────┐
 │  Browser │ ─────────────────▶ │  POST /api/   │
 │ (React)  │                    │    process    │
 └──────────┘                    └───────┬───────┘
      ▲                                  │
      │ JSON: notes, concepts,           ▼
      │ flashcards, meta          ┌─────────────────┐
      │                           │ pdfProcessor.js  │  pdf-parse extracts
      │                           │  (per-page text) │  raw text per page
      │                           └────────┬─────────┘
      │                                    ▼
      │                           ┌─────────────────┐
      │                           │ textCleaner.js   │  strip repeated headers/
      │                           │                  │  footers, de-hyphenate,
      │                           │                  │  drop page numbers
      │                           └────────┬─────────┘
      │                                    ▼
      │                           ┌─────────────────┐
      │                           │  chunker.js      │  paragraph-aware split
      │                           │                  │  into ~9,000-char chunks
      │                           └────────┬─────────┘
      │                                    ▼
      │                           ┌─────────────────┐
      └────────────────────────── │  aiService.js    │  one local-model call
                                   │ (Ollama, local)  │  per chunk (bounded
                                   └─────────────────┘  concurrency), merged
```

The whole pipeline runs inside a single `POST /api/process` request. The
frontend shows a loading state while it waits and then renders the result;
there's no polling or websocket layer, which keeps the architecture simple
for a project of this scope.

---

## 6. PDF processing & chunking

**Extraction (`pdfProcessor.js`)**: `pdf-parse` walks every page of the PDF
and we capture each page's text separately (rather than one flat string),
because the cleaning step needs page boundaries.

**Cleaning (`textCleaner.js`)**:
- Detects lines that repeat near-identically across most pages (typical of
  running headers/footers) and removes them.
- Rejoins words split by a line-break hyphen (`under-\nstanding` → `understanding`).
- Drops standalone page-number lines.
- Collapses excess whitespace while preserving paragraph breaks.
- `looksLikeUsableText()` catches PDFs that extracted to little or no real
  text (e.g. a scanned page-image PDF with no OCR layer) and returns a
  clear error instead of generating notes from garbage input.

**Chunking (`chunker.js`)**: Splits the cleaned text on paragraph
boundaries and packs paragraphs into ~9,000-character chunks (roughly
2,000–2,500 tokens of source text), carrying a small overlap into the next
chunk so ideas that straddle a boundary aren't lost. A paragraph longer
than the whole budget (rare) is hard-split on sentence boundaries so
nothing is silently dropped. This keeps each AI call small enough to stay
fast, accurate, and cheap, while still covering an entire long document.

---

## 7. AI pipeline & prompts

For each chunk, `aiService.js` sends one request to Ollama's local
`/api/chat` endpoint (`http://localhost:11434/api/chat` by default) with:
- A **system prompt** establishing the model's role ("expert study coach"),
  a strict "respond with only one JSON object" instruction, and quality
  rules (notes in the model's own words, concepts genuinely important,
  flashcards that test understanding rather than trivia, never invent
  facts not in the excerpt).
- A **user prompt** containing the chunk's text plus the exact JSON shape
  expected: `{ sectionTitle, notes, keyConcepts[], flashcards[] }`.
- `format: "json"` — an Ollama option that constrains decoding to valid
  JSON, which meaningfully improves reliability on smaller local models
  compared to prompting alone.
- `options.num_ctx` set explicitly (default 8192 tokens) — Ollama's default
  context window is quite small (2048 tokens) unless raised, which would
  otherwise silently truncate a chunk plus its response.

This is a **map** step (one call per chunk) followed by an in-process
**reduce**:
- Each chunk becomes one notes "section" (in original order).
- `keyConcepts` are merged and de-duplicated case-insensitively by term.
- `flashcards` are concatenated and capped at 60 total.

Concurrency defaults to **1** (`OLLAMA_CONCURRENCY`), because a local model
on typical consumer hardware only has one GPU/CPU to work with — sending
several requests "at once" just queues them anyway, and a concurrency of 1
avoids resource contention. Very long documents are capped at the first 10
chunks (`MAX_CHUNKS_PROCESSED` in `aiService.js`) to keep total local
processing time reasonable; if a document is truncated, the frontend shows
a small notice saying so.

We deliberately do **not** run a second giant "synthesis" LLM call over the
whole merged document — that would reintroduce the same context-length
problem chunking was meant to solve, and the per-chunk sections already
read as a coherent, ordered set of notes.

Model responses are parsed as strict JSON (with defensive stripping of
accidental code-fence wrapping, in case a model wraps output despite
`format: "json"`); a parse failure surfaces as a clear "something went
wrong" error rather than a silent bad result. Two other failure modes get
specific, actionable error messages instead of a generic one: Ollama not
running at all, and the configured model not being pulled yet.

---

## 8. Frontend states & interaction

- **Empty** — the initial screen: a drag-and-drop zone plus a "click to
  browse" fallback, with basic client-side validation (must be a PDF,
  under the size limit) before it ever reaches the network.
- **Loading** — a spinner, the current file name, and rotating status text
  ("Reading your PDF…" → "Writing your notes…" etc.) so a multi-second
  wait doesn't feel stalled.
- **Error** — a plain-language message (bad file, no extractable text,
  missing API key, network failure) with a "try a different file" action.
- **Success** — a tabbed view (`StudyPackView.jsx`) across Notes, Key
  Concepts, and Flashcards.
- **Flashcards** (`Flashcards.jsx`) — click or press Enter/Space to flip a
  card (CSS 3D flip), previous/next navigation, and a progress bar that
  tracks how many *unique* cards have been revealed at least once out of
  the total deck.
- **Motivational notes** (`MotivationalNote.jsx`) — two intentionally
  subtle, dismissible toasts: one shown once while processing starts, and
  one shown once the learner has flipped every card in the deck at least
  once. Both auto-fade and never block interaction.

---

## 9. Key files & functions at a glance

| File | Key export | What it does |
|---|---|---|
| `backend/server.js` | — | Boots Express, mounts routes, checks Ollama reachability on startup and warns clearly if it's not running or the model isn't pulled. |
| `backend/src/routes/process.js` | `processRouter` | The `POST /api/process` endpoint: validates the upload, runs the full pipeline, shapes error responses by failure type (bad file, unreadable PDF, Ollama unreachable, model not found, generation failure). |
| `backend/src/services/pdfProcessor.js` | `extractPdfText()` | PDF buffer → `{ pages, pageCount }`. |
| `backend/src/utils/textCleaner.js` | `cleanExtractedText()`, `looksLikeUsableText()` | Raw per-page text → cleaned document text; usability check. |
| `backend/src/services/chunker.js` | `chunkText()` | Cleaned text → ordered, overlapping chunks. |
| `backend/src/services/aiService.js` | `generateStudyPack()`, `checkOllamaStatus()` | Chunks → local Ollama calls → merged `{ sections, keyConcepts, flashcards, meta }`; plus a health-check helper. |
| `frontend/src/api.js` | `processPdf()` | Uploads the file and returns the parsed study pack, or throws a user-readable error. |
| `frontend/src/App.jsx` | `App` | Owns the idle/loading/success/error state machine and both motivational-note triggers. |
| `frontend/src/components/Flashcards.jsx` | `Flashcards` | Flip/reveal, navigation, and "unique cards seen" progress tracking. |

---

## 10. Known limitations

- Scanned/image-only PDFs without an OCR text layer will be rejected with
  a clear error — no OCR step is included in this pipeline.
- Very long documents are capped at 10 processed chunks to keep total local
  processing time reasonable; the UI discloses when this happens. You can
  raise `MAX_CHUNKS_PROCESSED` in `aiService.js` if your hardware can keep up.
- Local models are slower than a cloud API and, especially at smaller
  sizes (e.g. `llama3.2`, `phi3`), can produce somewhat less polished notes
  than a large cloud model would. `llama3.1` (the default) is a reasonable
  balance of quality and hardware requirements for most laptops.
- There is no persistence layer: refreshing the page clears the current
  study pack. Adding a database or local export (e.g. "save as Markdown")
  would be a natural next step but was left out to keep the stack minimal.
