import { describe, it, expect } from 'vitest';
import { validateResult } from '../src/engine.js';
import type { ModelResult, InvestigationDetail, Observation } from '@stateghost/shared';

describe('Investigation Engine Validation', () => {
  const baseInvestigation: InvestigationDetail = {
    id: 'inv-test',
    title: 'Cart desync',
    mode: 'state',
    createdAt: '2026-10-26T10:00:00Z',
    updatedAt: '2026-10-26T10:00:00Z',
    sample: false,
    evidence: [
      {
        id: 'ev-1',
        investigationId: 'inv-test',
        displayName: 'Cart.tsx',
        kind: 'source',
        sourceLabel: 'Frontend',
        uploadedAt: '2026-10-26T10:00:00Z',
        bytes: 50,
        mime: 'text/plain',
        content: 'line 1\nline 2\nline 3\nline 4\nline 5',
        warnings: [],
        entries: [],
        observations: [],
        report: { accepted: 1, parsedEntries: 1, excluded: [], truncation: [] }
      }
    ],
    analyses: [],
    interactions: []
  };

  const sampleObservations: Observation[] = [
    {
      id: 'o-1',
      statement: 'State does not register window storage listener',
      evidenceRefs: [{ evidenceId: 'ev-1', locator: 'line 2', line: 2 }],
      origin: 'parser',
      verification: 'confirmed'
    }
  ];

  const validResult: ModelResult = {
    summary: 'Detected missing storage event listener in Cart.tsx',
    summaryObservationIds: ['o-1'],
    hypotheses: [
      {
        id: 'h-1',
        title: 'Missing cross-tab storage synchronization',
        explanation: 'The component updates localStorage but does not listen for storage events emitted by other tabs.',
        supportingObservationIds: ['o-1'],
        contradictingObservationIds: [],
        evidenceStrength: 'high',
        status: 'active',
        distinguishingTest: {
          action: 'Modify cart in Tab A and inspect Tab B before and after manual refresh.',
          expectedOutcomes: ['Tab B only updates after refresh', 'Tab B updates immediately'],
          interpretationForEachOutcome: ['Supports stale in-memory state', 'Contradicts missing listener hypothesis'],
          safetyNote: 'Use mock test cart data.'
        }
      }
    ],
    missingEvidence: [],
    nextQuestion: {
      id: 'q-sync',
      question: 'Does Tab B update immediately when Tab A adds an item?',
      answerOptions: ['Yes', 'No', 'Only after refresh'],
      allowFreeText: true,
      whyUseful: 'Distinguishes browser storage propagation from in-memory React state retention.',
      affectedHypothesisIds: ['h-1']
    },
    stateGraph: {
      nodes: [
        { id: 'n1', label: 'Tab A UI', kind: 'observed', evidenceRefs: [{ evidenceId: 'ev-1', locator: 'line 1' }] },
        { id: 'n2', label: 'Tab B Memory', kind: 'inferred', evidenceRefs: [] }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'out of sync', kind: 'inferred', evidenceRefs: [] }
      ]
    },
    changes: 'Initial analysis created.'
  };

  it('passes validation for well-formed model result', () => {
    expect(() => validateResult(validResult, baseInvestigation, sampleObservations)).not.toThrow();
  });

  it('rejects unknown evidence reference in observation', () => {
    const badObs: Observation[] = [
      {
        id: 'o-bad',
        statement: 'Invalid reference',
        evidenceRefs: [{ evidenceId: 'non-existent-evidence', locator: 'line 1' }],
        origin: 'parser',
        verification: 'confirmed'
      }
    ];
    expect(() => validateResult(validResult, baseInvestigation, badObs)).toThrow(/Unknown evidence reference/);
  });

  it('rejects invented source line beyond file line count', () => {
    const badObs: Observation[] = [
      {
        id: 'o-line-bad',
        statement: 'Line out of bounds',
        evidenceRefs: [{ evidenceId: 'ev-1', locator: 'line 999', line: 999 }],
        origin: 'parser',
        verification: 'confirmed'
      }
    ];
    expect(() => validateResult(validResult, baseInvestigation, badObs)).toThrow(/Invented source line 999/);
  });

  it('rejects unknown observation ID in hypothesis support', () => {
    const badHypothesisResult = {
      ...validResult,
      hypotheses: [
        {
          ...validResult.hypotheses[0],
          supportingObservationIds: ['o-invented']
        }
      ]
    };
    expect(() => validateResult(badHypothesisResult, baseInvestigation, sampleObservations)).toThrow(/Unknown observation o-invented/);
  });

  it('rejects unsupported hypothesis claiming high evidence strength', () => {
    const badHypothesisResult = {
      ...validResult,
      hypotheses: [
        {
          ...validResult.hypotheses[0],
          supportingObservationIds: [],
          evidenceStrength: 'high' as const
        }
      ]
    };
    expect(() => validateResult(badHypothesisResult, baseInvestigation, sampleObservations)).toThrow(/An unsupported hypothesis must have low evidence strength/);
  });

  it('requires missingEvidence when observations are empty and forbids diagnosing without evidence', () => {
    const emptyResult: ModelResult = {
      ...validResult,
      summaryObservationIds: [],
      hypotheses: [],
      missingEvidence: [],
      nextQuestion: {
        ...validResult.nextQuestion,
        affectedHypothesisIds: []
      }
    };
    expect(() => validateResult(emptyResult, baseInvestigation, [])).toThrow(/Without observations, request evidence/);
  });
});
