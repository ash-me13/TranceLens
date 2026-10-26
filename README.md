# StateGhost

> **“Find where your app’s story breaks.”**

StateGhost is an evidence-grounded debugging assistant powered by local **Google Gemma 4** running via Ollama. It helps developers investigate confusing software behavior using screenshots, source code, network HAR exports, logs, and environment manifests.

---

## 1. Product Purpose & Three Investigation Modes

Most software bugs are not simple syntax errors—they are contradictions between what an interface displays and what application memory or the backend actually stores. StateGhost provides three specialized investigation modes sharing an evidence library and an interactive investigation engine:

1. **State Conflicts** (*“Why does my app contradict itself?”*)
   - Traces the gap between what your interface shows and what your app remembers.
   - Interactive React Flow state graph mapping UI state, React memory, browser storage, and server API.
   - Every node and edge is explicitly labeled as **observed**, **inferred**, or **unknown**.
2. **Request Detective** (*“Where did my button click go?”*)
   - Follows one user action through click handlers, network dispatch, HAR entries, backend log correlation, and frontend spinner cleanup.
   - Correlates events via explicit request/correlation IDs (`X-Request-ID`) and flags timing uncertainties.
3. **Setup Forensics** (*“It works on their laptop. Why not mine?”*)
   - Side-by-side deterministic environment checks: Node engines semver compatibility, package manager versions, manifest/lockfile consistency, and required environment variables.
   - Safe copyable diagnostic steps (StateGhost **never** executes commands automatically on the user's system).

### The Five-Layer Rigor Principle
StateGhost strictly distinguishes between five categories of information:
- **Observed Evidence**: Facts proven directly by code lines, logs, or confirmed visual extractions.
- **Model Interpretations**: Inductive explanations proposed by Gemma 4, never asserted as raw ground truth.
- **Suspected Explanations**: Competing hypotheses categorized with qualitative evidence strength (`low`, `medium`, `high`).
- **Missing Information**: Blindspots and unverified assumptions explicitly requested from the developer.
- **User-Reported Test Results**: Developer-submitted outcomes that strengthen, weaken, or contradict hypotheses across revisions.

---

## 2. Technology Stack & Workspace Architecture

StateGhost is structured as an npm workspace with strict TypeScript typing:

```
├── apps/
│   ├── web/          # React 18, Vite, Tailwind CSS, @xyflow/react, Lucide icons
│   └── server/       # Node.js 22+, Express, SQLite (node:sqlite DatabaseSync), sharp, multer
├── packages/
│   └── shared/       # Shared Zod schemas, domain models, and system prompts
├── demo-app/         # Real React demo lab with reproducible state & request bugs
├── fixtures/         # Reproducible test fixtures for setup, state, and request modes
├── docs/             # Architecture, demo script, judging matrix, limitations, Gemma 4 guide
├── scripts/          # reset-demo.ts, evaluate.ts
└── tests/
    └── e2e/          # Playwright user journey tests with real browser tabs
```

---

## 3. Local Gemma 4 Setup & Prerequisites

### Prerequisites
1. **Node.js**: Node.js `>= 22.13.0` installed.
2. **Ollama**: Installed from [ollama.com](https://ollama.com).

### Step-by-Step Setup
```bash
# 1. Start Ollama locally
ollama serve

# 2. Download Gemma 4 (7.5B multimodal model)
ollama pull gemma4:e4b

# 3. Clone and configure environment
cp .env.example .env

# 4. Install dependencies
npm install

# 5. Build applications
npm run build

# 6. Start development servers (frontend & proxied API)
npm run dev
```

Open your browser to: **`http://127.0.0.1:5173`**

### Hardware & Memory Notes
- **Download Size vs Runtime Memory**: The GGUF Q4_K_M weights take approximately 6.6 GB on disk. At runtime, the model allocates approximately 4.5 GB to 7.0 GB of memory (RAM/VRAM) depending on context length (`num_ctx: 16384`).
- **Tested Hardware**: Apple Silicon Mac (M-series with unified memory). Inference times range from 25s to 90s per structured revision.
- **Local Loopback Only**: All inference calls query `http://127.0.0.1:11434`. No external API keys or cloud connections are required. StateGhost is air-gapped capable; typography uses bundled Inter WOFF2 fonts without any CDN dependency.

---

## 4. Root CLI Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs both `@stateghost/server` (port 3001) and `@stateghost/web` (port 5173 with proxy). |
| `npm run build` | Compiles the React frontend into `apps/web/dist` and bundles the backend into `apps/server/dist`. |
| `npm run typecheck` | Typechecks `packages/shared`, `apps/server`, and `apps/web` with strict TypeScript. |
| `npm test` | Runs 30 fast, reliable Vitest unit and integration tests across parsers, store, and engine. |
| `npm run test:e2e` | Runs 6 Playwright browser user journeys (including real two-tab cross-tab synchronization). |
| `npm run demo:reset` | Cleans local demo logs and resets storage keys to baseline state. |
| `npm run eval:live` | Runs live evaluation against local Gemma 4 across 8 real test cases. |

---

## 5. Demo Lab: Reproducible Bug Scenarios

Navigate to the **Demo Lab** tab in StateGhost (`/#demo` or top navigation):

1. **Bug A: Cross-Tab Cart Synchronization**
   - Click **"Open Tab A in New Window"** and **"Open Tab B in New Window"**.
   - In **Buggy Mode**: Tab A adds an item, writing to localStorage. Tab B does not register a `storage` listener and retains stale in-memory state until manually refreshed.
   - In **Fixed Mode**: Tab B attaches a native `window.addEventListener('storage', ...)` listener and updates immediately in real time.
2. **Bug B: Optimistic Profile Save Without Persistence**
   - In **Buggy Mode**: Submitting a name immediately displays *"Saved"* in the UI, even though the simulated backend endpoint returns HTTP 500. Page refresh reverts to the original name.
   - In **Fixed Mode**: Proper loading status is shown, and HTTP failures display an error banner without falsely displaying *"Saved"*.
3. **Bug C: Two Inconsistent Cart Sources**
   - In **Buggy Mode**: Cart Page and Checkout Page read from two separate uncoordinated storage keys; items added in Cart do not appear in Checkout (*"Your cart is empty"*).
   - In **Fixed Mode**: Both views share an authoritative unified cart store.
4. **Request Detective: Failed Order & Stuck Spinner**
   - Click *"Place Order Now"*, calling `/api/demo/order` which returns HTTP 500.
   - In **Buggy Mode**: The frontend omits a `finally` or `catch` cleanup, leaving the loading spinner active indefinitely and disabling the button.
   - In **Fixed Mode**: The spinner is cleaned up, error details are displayed, and a retry button is provided.

---

## 6. Honest Demo Behavior & Recorded Samples

- **Live Analysis**: Uses uploaded evidence and actual local Gemma 4 model inference.
- **Sample Investigation**: Accessible via **"Load Sample Investigation"** on the dashboard. Visibly labeled with **`Sample investigation — recorded example`**. StateGhost **never** presents a pre-recorded diagnosis as live model output, nor does it silently fall back from live inference to recorded answers.

---

## 7. Deliverables & Documentation Index

- [Architecture & Topology](file:///Users/sakshamarc/Desktop/Trace-lens-2/docs/architecture.md)
- [3-Minute Demo Script](file:///Users/sakshamarc/Desktop/Trace-lens-2/docs/demo-script.md)
- [Feature-to-Evidence Judging Matrix](file:///Users/sakshamarc/Desktop/Trace-lens-2/docs/judging-matrix.md)
- [Measured Limitations & Constraints](file:///Users/sakshamarc/Desktop/Trace-lens-2/docs/limitations.md)
- [Role of Local Gemma 4](file:///Users/sakshamarc/Desktop/Trace-lens-2/docs/gemma-role.md)
