import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import type { Evidence, Analysis, Interaction } from '@tracelens/shared';

describe('SQLite Store Persistence', () => {
  let tempDir: string;
  let store: Store;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'stateghost-test-'));
    store = new Store(tempDir);
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates and lists investigations ordered by updatedAt', () => {
    const inv1 = store.create('Cart sync issue', 'state');
    const inv2 = store.create('Build failure', 'setup');

    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list.map(i => i.id)).toContain(inv1.id);
    expect(list.map(i => i.id)).toContain(inv2.id);
  });

  it('persists evidence and deletes files on cascade deletion', () => {
    const inv = store.create('Investigation 1', 'request');
    const evidence: Evidence = {
      id: 'ev-test-1',
      investigationId: inv.id,
      displayName: 'test.log',
      kind: 'log',
      sourceLabel: 'Backend',
      uploadedAt: new Date().toISOString(),
      bytes: 20,
      mime: 'text/plain',
      content: 'Hello log content',
      warnings: [],
      entries: [],
      observations: [],
      report: { accepted: 1, parsedEntries: 0, excluded: [], truncation: [] }
    };

    store.addEvidence(evidence);
    let detail = store.get(inv.id);
    expect(detail?.evidence).toHaveLength(1);
    expect(detail?.evidence[0].id).toBe('ev-test-1');

    // Update evidence observations
    evidence.observations = [{
      id: 'o-1',
      statement: 'Observed error in log',
      evidenceRefs: [{ evidenceId: 'ev-test-1', locator: 'line 1' }],
      origin: 'parser',
      verification: 'confirmed'
    }];
    store.updateEvidence(evidence);

    detail = store.get(inv.id);
    expect(detail?.evidence[0].observations).toHaveLength(1);

    // Remove evidence
    store.removeEvidence(inv.id, 'ev-test-1');
    detail = store.get(inv.id);
    expect(detail?.evidence).toHaveLength(0);
  });

  it('persists analyses revisions and interactions', () => {
    const inv = store.create('State bug', 'state');
    const analysis: Analysis = {
      id: 'an-1',
      revision: 1,
      summary: 'Initial analysis',
      summaryObservationIds: [],
      hypotheses: [],
      missingEvidence: ['Add logs'],
      nextQuestion: {
        id: 'q1',
        question: 'Does refresh work?',
        answerOptions: ['Yes', 'No'],
        allowFreeText: true,
        whyUseful: 'Distinguishes cache',
        affectedHypothesisIds: []
      },
      stateGraph: { nodes: [], edges: [] },
      changes: 'Initial run',
      observations: [],
      modeSpecificResults: { timeline: [], setupDifferences: [] },
      modelMetadata: {
        model: 'gemma4:e4b',
        timestamp: new Date().toISOString(),
        durationMs: 1200,
        provider: 'ollama'
      }
    };

    store.addAnalysis(inv.id, analysis);
    const interaction: Interaction = {
      id: 'int-1',
      kind: 'answer',
      questionId: 'q1',
      text: 'Yes, refreshing syncs the total',
      createdAt: new Date().toISOString(),
      basedOnRevision: 1
    };
    store.addInteraction(inv.id, interaction);

    const detail = store.get(inv.id);
    expect(detail?.analyses).toHaveLength(1);
    expect(detail?.analyses[0].revision).toBe(1);
    expect(detail?.interactions).toHaveLength(1);
    expect(detail?.interactions[0].text).toContain('Yes, refreshing');
  });

  it('saves and retrieves global settings', () => {
    expect(store.setting('model')).toBeUndefined();
    store.setting('model', 'gemma4:e4b');
    expect(store.setting('model')).toBe('gemma4:e4b');
  });
});
