/**
 * scripts/evaluate.ts
 * Live Gemma 4 evaluation harness for TraceLens.
 * Evaluates real investigations across all modes and reports actual measured metrics.
 */
import { Ollama, isGemma4 } from '../apps/server/src/model.js';
import { Store } from '../apps/server/src/store.js';
import { analyze } from '../apps/server/src/engine.js';
import { enrich, detectKind } from '../apps/server/src/parsers.js';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Evidence, Mode } from '@tracelens/shared';

interface TestCase {
  id: string;
  name: string;
  mode: Mode;
  expectedRootCauseKeywords: string[];
  evidenceFiles: Array<{ name: string; sourceLabel: string; content?: string; filePath?: string }>;
  isInsufficientEvidenceCase?: boolean;
}

const root = path.resolve(import.meta.dirname, '..');

const testCases: TestCase[] = [
  // 1. State Bug Case 1: Cross-tab cart sync
  {
    id: 'state-bug-1',
    name: 'State: Cross-tab cart synchronization',
    mode: 'state',
    expectedRootCauseKeywords: ['storage', 'sync', 'listener', 'cross-tab', 'tab', 'stale'],
    evidenceFiles: [
      { name: 'cart-tab-a.log', sourceLabel: 'Tab A log', filePath: 'fixtures/state/cart-tab-a.log' },
      { name: 'cart-tab-b.log', sourceLabel: 'Tab B log', filePath: 'fixtures/state/cart-tab-b.log' },
      { name: 'CartContext.tsx', sourceLabel: 'Cart component source', filePath: 'fixtures/state/CartContext.tsx' }
    ]
  },
  // 2. State Bug Case 2: Optimistic profile save without persistence
  {
    id: 'state-bug-2',
    name: 'State: Optimistic profile save without persistence',
    mode: 'state',
    expectedRootCauseKeywords: ['optimistic', 'persistence', 'fail', 'save', 'refresh', 'api'],
    evidenceFiles: [
      { name: 'ProfileForm.tsx', sourceLabel: 'Profile form source', filePath: 'fixtures/state/ProfileForm.tsx' }
    ]
  },
  // 3. State Bug Case 3: Two inconsistent cart state sources
  {
    id: 'state-bug-3',
    name: 'State: Inconsistent cart & checkout sources',
    mode: 'state',
    expectedRootCauseKeywords: ['source', 'checkout', 'separate', 'inconsistent', 'cart', 'store'],
    evidenceFiles: [
      {
        name: 'CartSources.log',
        sourceLabel: 'State logs',
        content: 'Cart page rendered 2 items using CartContext. Checkout rendered 0 items reading legacy localStorage key "checkout_cart".'
      }
    ]
  },
  // 4. Request Failure Case: Order failure with stuck spinner
  {
    id: 'request-failure-1',
    name: 'Request: Order button HTTP 500 with stuck spinner',
    mode: 'request',
    expectedRootCauseKeywords: ['500', 'error', 'spinner', 'loading', 'cleanup', 'catch', 'finally'],
    evidenceFiles: [
      { name: 'order-failure.har', sourceLabel: 'Browser network export', filePath: 'fixtures/request/order-failure.har' },
      { name: 'frontend.log', sourceLabel: 'Frontend logger', filePath: 'fixtures/request/frontend.log' },
      { name: 'backend.log', sourceLabel: 'Backend logger', filePath: 'fixtures/request/backend.log' }
    ]
  },
  // 5. Setup Case 1: Unsupported Node version
  {
    id: 'setup-failure-1',
    name: 'Setup: Node version incompatibility (v18 vs >=22.13.0)',
    mode: 'setup',
    expectedRootCauseKeywords: ['node', 'engine', 'version', '18', '22', 'incompatible'],
    evidenceFiles: [
      { name: 'package.json', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/broken/package.json' },
      { name: 'runtime.txt', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/broken/runtime-node18.txt' }
    ]
  },
  // 6. Setup Case 2: Missing required environment variable
  {
    id: 'setup-failure-2',
    name: 'Setup: Missing required API_KEY variable',
    mode: 'setup',
    expectedRootCauseKeywords: ['api_key', 'environment', 'variable', 'missing', 'required'],
    evidenceFiles: [
      { name: 'README.md', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/working/README.md' },
      { name: '.env', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/broken/env-missing.env' }
    ]
  },
  // 7. Setup Case 3: Dependency / lockfile mismatch
  {
    id: 'setup-failure-3',
    name: 'Setup: Lockfile mismatch (React 17 in lock vs 19 in manifest)',
    mode: 'setup',
    expectedRootCauseKeywords: ['lockfile', 'dependency', 'mismatch', 'react', 'version'],
    evidenceFiles: [
      { name: 'package.json', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/broken/package.json' },
      { name: 'package-lock.json', sourceLabel: 'Broken machine', filePath: 'fixtures/setup/broken/package-lock-mismatch.json' }
    ]
  },
  // 8. Insufficient Evidence Case: Empty / insufficient evidence
  {
    id: 'insufficient-evidence-1',
    name: 'Insufficient: Unclear single vague log without context',
    mode: 'state',
    expectedRootCauseKeywords: ['insufficient', 'missing', 'more evidence'],
    isInsufficientEvidenceCase: true,
    evidenceFiles: [
      {
        name: 'unclear.log',
        sourceLabel: 'Unknown origin',
        content: 'Button was clicked at some point.'
      }
    ]
  }
];

async function runEvaluation() {
  const modelName = process.env.OLLAMA_MODEL || 'gemma4:e4b';
  const provider = new Ollama();

  console.log('====================================================');
  console.log(' TraceLens Live Gemma 4 Evaluation Harness');
  console.log('====================================================');
  console.log(`Checking connection to local Ollama at ${provider.base}...`);

  const status = await provider.status(modelName);
  console.log(`Ollama Connected: ${status.connected}`);
  console.log(`Selected Model: ${modelName}`);
  console.log(`Model Available: ${status.available}`);
  console.log(`Image-Input Capability: ${status.imageInput}`);
  console.log(`Status Message: ${status.message}\n`);

  if (!status.available) {
    console.error('❌ Model is unavailable for live evaluation. Please run: ollama pull ' + modelName);
    console.error('TraceLens will not fabricate results or claim tests passed when not run.');
    process.exit(1);
  }

  const results: Array<{
    id: string;
    name: string;
    durationMs: number;
    expectedInTop3: boolean;
    citationsResolved: boolean;
    distinguishingTestsActionable: boolean;
    unsupportedClaimsFound: boolean;
    followUpUseful: boolean;
    tokens?: { prompt?: number; completion?: number };
  }> = [];

  for (const tc of testCases) {
    console.log(`\n▶ Evaluating [${tc.id}]: ${tc.name}...`);
    const tempDir = mkdtempSync(path.join(tmpdir(), `eval-${tc.id}-`));
    const store = new Store(tempDir);

    try {
      const inv = store.create(tc.name, tc.mode);

      // Ingest evidence files
      for (const ef of tc.evidenceFiles) {
        let content = ef.content || '';
        if (ef.filePath) {
          content = readFileSync(path.join(root, ef.filePath), 'utf-8');
        }

        const e: Evidence = {
          id: `ev-${Math.random().toString(36).slice(2, 8)}`,
          investigationId: inv.id,
          displayName: ef.name,
          kind: detectKind(ef.name),
          sourceLabel: ef.sourceLabel,
          uploadedAt: new Date().toISOString(),
          bytes: content.length,
          mime: 'text/plain',
          content,
          warnings: [],
          entries: [],
          observations: [],
          report: { accepted: 1, parsedEntries: 1, excluded: [], truncation: [] }
        };

        enrich(e);
        writeFileSync(path.join(store.dir, 'evidence', e.id), e.content);
        store.addEvidence(e);
      }

      const controller = new AbortController();
      const startTime = Date.now();
      const analysis = await analyze(store, inv.id, provider, modelName, controller.signal, stage => {
        process.stdout.write(`  [${stage}] `);
      });
      console.log('');
      const durationMs = Date.now() - startTime;

      // 1. Check whether expected cause appears in top 3 hypotheses (or missing evidence for insufficient case)
      let expectedInTop3 = false;
      if (tc.isInsufficientEvidenceCase) {
        expectedInTop3 = (analysis.missingEvidence.length > 0) || (analysis.hypotheses.length === 0) ||
          analysis.hypotheses.some(h => h.evidenceStrength === 'low');
      } else {
        const top3 = analysis.hypotheses.slice(0, 3);
        expectedInTop3 = top3.some(h => {
          const text = (h.title + ' ' + h.explanation).toLowerCase();
          return tc.expectedRootCauseKeywords.some(kw => text.includes(kw.toLowerCase()));
        });
      }

      // 2. Check citations resolve to supplied evidence
      const evidenceIds = new Set(store.get(inv.id)!.evidence.map(e => e.id));
      let citationsResolved = true;
      for (const obs of analysis.observations) {
        for (const ref of obs.evidenceRefs) {
          if (!evidenceIds.has(ref.evidenceId)) {
            citationsResolved = false;
          }
        }
      }

      // 3. Check distinguishing tests actionable
      const distinguishingTestsActionable = analysis.hypotheses.every(h => {
        return h.distinguishingTest.action.length > 10 &&
          h.distinguishingTest.expectedOutcomes.length >= 2 &&
          h.distinguishingTest.interpretationForEachOutcome.length === h.distinguishingTest.expectedOutcomes.length;
      });

      // 4. Check unsupported claims
      const unsupportedClaimsFound = analysis.hypotheses.some(h => {
        return h.supportingObservationIds.length === 0 && h.evidenceStrength !== 'low';
      });

      // 5. Follow-up usefulness
      const followUpUseful = analysis.nextQuestion.question.length > 10 && analysis.nextQuestion.whyUseful.length > 10;

      console.log(`  ✓ Duration: ${durationMs} ms`);
      console.log(`  ✓ Expected Cause in Top 3: ${expectedInTop3 ? 'YES' : 'NO'}`);
      console.log(`  ✓ Citations Resolved: ${citationsResolved ? 'YES' : 'NO'}`);
      console.log(`  ✓ Distinguishing Tests Actionable: ${distinguishingTestsActionable ? 'YES' : 'NO'}`);
      console.log(`  ✓ Unsupported Claims: ${unsupportedClaimsFound ? 'FLAGGED' : 'NONE'}`);
      console.log(`  ✓ Follow-Up Question Useful: ${followUpUseful ? 'YES' : 'NO'}`);

      results.push({
        id: tc.id,
        name: tc.name,
        durationMs,
        expectedInTop3,
        citationsResolved,
        distinguishingTestsActionable,
        unsupportedClaimsFound,
        followUpUseful,
        tokens: {
          prompt: analysis.modelMetadata.promptTokens,
          completion: analysis.modelMetadata.completionTokens
        }
      });
    } catch (err: any) {
      console.error(`  ❌ Failed evaluation for ${tc.name}:`, err.message);
      results.push({
        id: tc.id,
        name: tc.name,
        durationMs: 0,
        expectedInTop3: false,
        citationsResolved: false,
        distinguishingTestsActionable: false,
        unsupportedClaimsFound: true,
        followUpUseful: false
      });
    } finally {
      store.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // Summary Table
  console.log('\n====================================================');
  console.log(' EVALUATION REPORT SUMMARY');
  console.log('====================================================');
  console.table(results.map(r => ({
    Case: r.id,
    'Top-3 Hit': r.expectedInTop3 ? 'PASS' : 'FAIL',
    Citations: r.citationsResolved ? 'PASS' : 'FAIL',
    'Actionable Tests': r.distinguishingTestsActionable ? 'PASS' : 'FAIL',
    'No False Claims': !r.unsupportedClaimsFound ? 'PASS' : 'FAIL',
    'Follow-up': r.followUpUseful ? 'PASS' : 'FAIL',
    'Duration (ms)': r.durationMs
  })));

  const allPassed = results.every(r => r.expectedInTop3 && r.citationsResolved && r.distinguishingTestsActionable && !r.unsupportedClaimsFound && r.followUpUseful);
  console.log(`\nOverall Evaluation: ${allPassed ? 'ALL CASES PASSED' : 'SOME CASES FAILED'}`);
  console.log('Report generated with real local Gemma 4 inference without fabricated values.');
}

runEvaluation().catch(err => {
  console.error('Evaluation run aborted:', err);
  process.exit(1);
});
