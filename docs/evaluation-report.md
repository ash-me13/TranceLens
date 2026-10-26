# TraceLens: Evaluation and Verification Report

> **“Never replace a failed model response with an undisclosed hardcoded diagnosis. Never fabricate evaluation scores or claim tests passed when they were not run.”**

This document provides the verified testing and live Gemma 4 evaluation results for TraceLens across all test suites, browser journeys, and real local model inferences.

---

## 1. Automated Vitest Test Suite (Unit & Integration)

TraceLens includes 30 automated unit and integration tests across parser logic, SQLite persistence, and the shared investigation engine.

- **Command**: `npm test`
- **Runner**: Vitest v4
- **Status**: **30 / 30 Passed (100%)**
- **Duration**: ~2.5 seconds

### Verified Coverage

| Test File | Tests | Coverage | Status |
| :--- | :--- | :--- | :--- |
| `apps/server/test/parsers.test.ts` | 15 | Secret redaction (Bearer, cookies, tokens, env vars), HAR parsing with correlation IDs, semantic versioning logic, deterministic setup comparisons, lockfile consistency assertions (npm v2/v3, pnpm v6/v9), file content and path traversal validation. | **PASSED** |
| `apps/server/test/store.test.ts` | 4 | SQLite DatabaseSync persistence, WAL mode, foreign key constraints, cascade deletion on investigations, settings and interactions tables. | **PASSED** |
| `apps/server/test/engine.test.ts` | 6 | Multi-revision investigation pipeline, observation ID mapping (`o-<evId>-L<line>`), hypothesis identity normalization across revisions, detection of unsupported claims, detection of invented citations, and correct handling of insufficient evidence. | **PASSED** |
| `apps/server/test/api.test.ts` | 5 | Express HTTP API endpoints: `/api/health`, `/api/model/status`, `/api/investigations`, `/api/demo/order`, Markdown and JSON export integrity. | **PASSED** |

---

## 2. End-to-End User Journeys (Playwright)

TraceLens includes 6 comprehensive Playwright end-to-end browser journeys executing in real browser windows against the full-stack web application.

- **Command**: `npm run test:e2e`
- **Runner**: `@playwright/test` using Chrome channel
- **Status**: **6 / 6 Passed (100%)**
- **Duration**: 20.6 seconds

### Verified User Journeys

1. **Journey 1: Investigation Creation, Evidence Upload & Cited Source Inspection**
   - Creates an investigation in State Conflicts mode.
   - Adds evidence via file upload and paste modal.
   - Executes analysis via test provider.
   - Clicks cited evidence reference and inspects line-numbered source viewer in `EvidenceModal`.
2. **Journey 2: Interactive Hypothesis Refinement & Revision History**
   - Submits user answer to the follow-up question.
   - Verifies revision counter advances (`Revision 2`).
   - Asserts previous observations and findings are preserved.
   - Asserts the changelog panel displays the explanation of what changed.
3. **Journey 3: State Conflicts Bug Reproduction & Fix Verification**
   - Opens two real browser windows (`#demo-tab-a` and `#demo-tab-b`).
   - **Bug A (Cross-Tab Synchronization)**: Adds an item in Tab A. Asserts Tab B remains stale in Buggy mode (different cart totals). Toggles to Fixed mode; asserts active `storage` listener synchronizes Tab B in real time.
   - **Bug B (Optimistic Profile Save)**: Submits profile edit with simulated 500 error. Asserts Buggy mode displays false "Saved" badge. Asserts Fixed mode shows error alert and clears status.
   - **Bug C (Inconsistent Cart Sources)**: Asserts cart page and checkout page show mismatched item counts in Buggy mode. Asserts unified store resolves conflict in Fixed mode.
4. **Journey 4: Request Detective Journey**
   - Places order triggering simulated HTTP 500.
   - In Buggy mode, asserts spinner remains stuck indefinitely.
   - In Fixed mode, asserts error message is displayed and loading spinner is immediately cleared.
5. **Journey 5: Setup Forensics Journey**
   - Ingests working and broken environment fixtures (Node 18 vs Node >=22.13.0).
   - Verifies deterministic engine incompatibility warning is flagged side-by-side.
6. **Journey 6: Persistence Recovery & Export Lifecycle**
   - Reloads the browser window; verifies the active investigation is recovered from the SQLite store.
   - Exports investigation as Markdown and JSON.
   - Deletes the investigation; verifies records and files are removed cleanly.

---

## 3. Live Gemma 4 Evaluation Harness

TraceLens includes a dedicated live evaluation script (`scripts/evaluate.ts`) that executes real inference against the local Ollama instance (`http://127.0.0.1:11434`, model `gemma4:e4b-it-q4_K_M`, 7.5B parameters).

- **Command**: `npm run eval:live`
- **Model**: `gemma4:e4b` (quantization `Q4_K_M`, 6.6 GB GGUF)
- **Hardware Profile**: Apple Silicon Mac (M-series, 16 GB unified RAM under host load)
- **Evaluation Criteria**:
  1. **Top-3 Hit**: Whether the expected root cause appears in the top 3 proposed hypotheses (or missing evidence flagged for insufficient cases).
  2. **Citations Resolved**: Whether all cited observation and evidence IDs strictly resolve to supplied evidence (no hallucinated IDs or invented line numbers).
  3. **Actionable Tests**: Whether every distinguishing test provides an actionable step, at least 2 distinct expected outcomes, and a clear interpretation for each outcome.
  4. **No False Claims**: Whether unsupported claims without evidence references are prohibited or flagged with low strength.
  5. **Follow-Up Useful**: Whether the generated follow-up question directly targets unresolved diagnostic uncertainty with a clear rationale.
  6. **Duration (ms)**: Real measured end-to-end wall-clock latency.

### Measured Live Results

| Case ID | Scenario Name | Top-3 Hit | Citations | Actionable Tests | No False Claims | Follow-up | Duration | Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `state-bug-1` | Cross-tab cart synchronization | — | — | — | — | — | Timed out | **FAIL** (Context timeout > 180s on large multi-file prompt) |
| `state-bug-2` | Optimistic profile save without persistence | — | — | — | — | — | Cut off | **FAIL** (Grammar token limit exhausted: Unexpected end of JSON) |
| `state-bug-3` | Inconsistent cart & checkout sources | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | 139,839 ms | **PASS (100%)** |
| `request-failure-1` | Order button HTTP 500 with stuck spinner | — | — | — | — | — | Cut off | **FAIL** (Grammar token limit exhausted: Unterminated string at byte 7377) |
| `setup-failure-1` | Node version incompatibility (v18 vs >=22.13.0) | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | 305,761 ms | **PASS (100%)** |
| `setup-failure-2` | Missing required API_KEY variable | — | — | — | — | — | Caught | **FAIL** (Ungrounded claim rejected: "Observed graph claims need evidence") |
| `setup-failure-3` | Lockfile mismatch (React 17 in lock vs 19 in manifest) | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | 126,244 ms | **PASS (100%)** |
| `insufficient-evidence-1`| Unclear single vague log without context | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | 67,325 ms | **PASS (100%)** |

---

## 4. Engineering Findings & Insights from Live Evaluation

1. **Strict Rejection of Ungrounded Claims Works**:
   - In `setup-failure-2`, the local model attempted to propose an `observed` graph claim without providing citations to the supplied environment manifest. TraceLens's `validateResult` rejected the output, prompted for a repair attempt, and upon failure threw a recoverable error rather than persisting an ungrounded claim.
2. **Token Generation Budgets on CPU/Metal**:
   - On a host under memory pressure, generating 2,500 structured tokens under strict JSON grammar takes ~2.5 to 3.5 minutes.
   - When prompts are concise (e.g., `state-bug-3`, `setup-failure-3`, `insufficient-evidence-1`), the model produces complete, highly calibrated structured outputs in 67s to 139s that pass all 5 verification dimensions.
3. **Handling of Insufficient Evidence**:
   - In `insufficient-evidence-1`, when presented with a single vague log sentence, Gemma 4 correctly declined to fabricate a diagnosis, set `hypotheses` to low strength or empty, populated `missingEvidence`, and asked a high-value clarifying question.
