# StateGhost: Measured Limitations & Boundary Conditions

StateGhost is engineered to provide truthful, evidence-grounded investigations. In accordance with honest engineering principles, the system explicitly declares its operational boundaries, hardware trade-offs, and design constraints.

---

### 1. Local Inference Latency & Hardware Profile
- **Observed Hardware**: Apple Silicon Mac (M-series, unified memory).
- **Model**: `gemma4:e4b` (7.5B parameter multimodal model, Q4_K_M quantization, 6.6 GB on disk).
- **Observed Latency**:
  - Structured reasoning and hypothesis proposal: **25 – 90 seconds** per revision, depending on context size and prompt evaluation token count.
  - Vision extraction (single screenshot): **8 – 18 seconds**.
- **Mitigation**: StateGhost utilizes background jobs with live stage reporting (`Reading evidence` → `Analyzing screenshots` → `Comparing explanations` → `Validating results`) so the browser UI never freezes during inference. A 180-second timeout and instant client-side cancellation protect against runaway execution.

---

### 2. Context Budgets & Bounded Extractions
- **Context Limit**: Total evidence context passed to Gemma 4 is strictly capped at **240,000 characters**.
- **No Silent Truncation**: Files exceeding limits are processed via **bounded extraction**—preserving the header, tail, and all lines matching relevant diagnostic keywords (`error`, `fail`, `storage`, `fetch`, `version`, `lockfile`, etc.).
- **Notice of Absence**: Omitted lines are accompanied by an explicit diagnostic notice: *"Source excerpts are bounded; omitted content is not evidence of absence."*

---

### 3. Cross-Machine Clock Skew & Causal Uncertainty
- **Clock Drift**: Client browsers, developer laptops, and remote servers frequently have unsynchronized system clocks.
- **Principle**: StateGhost strictly preserves original timestamps and ISO-8601 strings. It never assumes upload time is event time, and it never synthesizes a false causal ordering when clock uncertainty exists. Correlation is prioritized via explicit request IDs (`X-Request-ID`, `traceparent`).

---

### 4. Vision Observation Verification
- **Unverified Status**: Text and visual facts extracted from screenshots by Gemma 4 vision projector are stored with status `unverified`.
- **Developer Review**: Developers can inspect, edit, and mark observations as `confirmed` or `corrected` before triggering root cause diagnoses.
- **No Invented Bounding Boxes**: Spatial locations are described as human-readable UI regions (e.g., *"Top-right header cart icon"*), avoiding ungrounded pixel coordinates.

---

### 5. Supported File Formats & Exclusions
- **Allowed Uploads**: PNG, JPEG, WebP screenshots; HAR network exports; package.json and supported lockfiles; text/JSON logs; source code files; `.env` templates; Markdown setup instructions.
- **File Limits**: 10 MB per file, 30 MB total per investigation, max 12 items.
- **Deterministic Lockfile Support**: Full semantic versioning and dependency consistency checks are implemented for `package-lock.json` (v2 & v3) and `pnpm-lock.yaml` (v6 & v9). Unsupported lockfiles (e.g., Yarn v1, Pipfile) can still be inspected as source text, but automatic consistency assertions are skipped with an explicit warning.
- **Executable Rejection**: Binary executables, ELF/Mach-O binaries, archives (`.zip`, `.tar`), and executable shell scripts are rejected upon upload to prevent local path or command injection.

---

### 6. No Autonomous Destructive Actions
- **Safe Diagnostic Steps**: In Setup Forensics, StateGhost generates copyable diagnostic shell commands with explanatory rationale.
- **Safety Rule**: StateGhost **never** executes commands or alters environment variables automatically on the developer's system.
