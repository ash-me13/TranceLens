# TraceLens System Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 TraceLens Web App                      │
                  │   (React 18 + TypeScript + Vite + Tailwind + XYFlow)   │
                  └──────────────────────────┬─────────────────────────────┘
                                             │ HTTP & SSE Proxied via :5173
                                             ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                TraceLens API Server                    │
                  │         (Node.js + Express + SQLite Database)          │
                  └──────┬───────────────────┬──────────────────────┬──────┘
                         │                   │                      │
                         ▼                   ▼                      ▼
                ┌────────────────┐  ┌────────────────┐    ┌─────────────────┐
                │ SQLite Storage │  │ Deterministic  │    │ Local Ollama    │
                │  - Evidence    │  │ Parser Engine  │    │ Gemma 4 (:11434)│
                │  - Revisions   │  │  - Redaction   │    │  - Vision OCR   │
                │  - Answers     │  │  - Semver/Deps │    │  - Hypotheses   │
                │  - Tests       │  │  - HAR & Logs  │    │  - Questions    │
                └────────────────┘  └────────────────┘    └─────────────────┘
```

## Component Architecture

### 1. Frontend (`apps/web`)
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS tailored to an IDE visual palette: deep navy backgrounds (`#0B132B`, `#0A101B`), neutral surfaces (`#111B2A`, `#1E293B`), teal for observed facts and checks (`#14B8A6`, `#64DCC6`), amber for unresolved questions (`#F59E0B`, `#EFC078`), and coral for contradictions (`#F43F5E`, `#FF8F91`).
- **State Conflict Graph**: Built with `@xyflow/react` (React Flow) to interactively display state flow across UI, React memory, browser storage, and API backend. Nodes and edges are strictly categorized as `observed`, `inferred`, or `unknown`.
- **Request Timeline**: Visual step-by-step trace correlating user actions, network events, server logs, and frontend status.
- **Setup Differences**: Side-by-side environment comparison displaying deterministic package manager, engine, lockfile, and environment variable audits.
- **Offline / Local**: Google Inter font is locally bundled via `@fontsource-variable/inter`. Zero CDN or external web requests are made.

### 2. Backend Server (`apps/server`)
- **Runtime**: Node.js 22+ with Express.
- **Storage**: In-process persistent SQLite database (`node:sqlite` DatabaseSync) storing investigations, file metadata, analysis revisions, and interaction history. All tables enforce foreign keys and cascade deletion.
- **Security & Secret Redaction**: Deterministic sanitization of bearer tokens, cookies, passwords, API keys, and environment variables before persisting or passing context to inference. Path traversal validation protects all file uploads.
- **Job Processing**: Asynchronous job runner with stage reporting (`Reading evidence`, `Analyzing screenshots`, `Comparing explanations`, `Validating results`) and non-blocking polling endpoints.
- **Cancellation**: Full `AbortController` cancellation propagates directly to local Ollama requests to terminate upstream inference immediately when cancelled by the developer.

### 3. Model Engine (`apps/server/src/engine.ts` & `model.ts`)
- **Native Ollama API**:
  - `GET /api/tags`: Discovers installed models.
  - `POST /api/show`: Inspects model capabilities (verifies `vision` input capability).
  - `POST /api/chat`: Runs structured analysis with `format` JSON Schema and `temperature: 0.1`.
- **Vision Extraction**: Actual image data is base64-encoded and passed to Gemma 4 vision projector to extract visible text and layout descriptions without fabricated bounding boxes. Model extractions remain marked `unverified` until user confirmation.
- **Grounding Validation**: Every returned hypothesis must cite valid evidence references and observation IDs. Unsupported hypotheses are barred from claiming high confidence. One repair attempt is permitted for invalid model output before presenting a recoverable error.

### 4. Demo Playground (`demo-app`)
- **Independent Scenarios**:
  - **Bug A**: Cross-tab cart synchronization with dual browser window support.
  - **Bug B**: Optimistic profile save without backend persistence.
  - **Bug C**: Split cart state sources between cart and checkout.
  - **Request Mode**: Button click with HTTP 500 server error and stuck loading spinner.
- **Buggy vs Fixed Mode**: Independent toggles demonstrating both root causes and corrected implementations.
