import { describe, it, expect } from 'vitest';
import { redact, parseHar, detectKind, validateName, compareSetup, timeline, enrich, boundedContent } from '../src/parsers.js';
import type { Evidence } from '@tracelens/shared';

describe('Secret Redaction', () => {
  it('redacts authorization bearer tokens', () => {
    const input = 'Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
    const output = redact(input);
    expect(output).toContain('Bearer [REDACTED]');
    expect(output).not.toContain('eyJhbGci');
  });

  it('redacts cookies and api keys in JSON / headers', () => {
    const input = '{"cookie": "session=secret12345", "api_key": "sk-1234567890abcdef", "token": "abc123xyz"}';
    const output = redact(input);
    expect(output).toContain('"cookie": "[REDACTED]"');
    expect(output).toContain('"api_key": "[REDACTED]"');
    expect(output).not.toContain('secret12345');
  });

  it('redacts environment variable values while retaining key names', () => {
    const env = 'DATABASE_URL=postgres://user:pass@localhost:5432/db\nAPI_KEY=xyz987\nEMPTY_KEY=';
    const output = redact(env, true);
    expect(output).toContain('DATABASE_URL=[present; value redacted]');
    expect(output).toContain('API_KEY=[present; value redacted]');
    expect(output).toContain('EMPTY_KEY=[missing]');
  });
});

describe('HAR Parsing', () => {
  it('parses valid HAR with status, timing, and requestId', () => {
    const sampleHar = JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'Browser', version: '1.0' },
        entries: [
          {
            startedDateTime: '2026-10-26T10:00:00.000Z',
            time: 142,
            request: {
              method: 'POST',
              url: 'http://127.0.0.1:3001/api/demo/order',
              headers: [
                { name: 'X-Request-ID', value: 'req-order-123' },
                { name: 'Authorization', value: 'Bearer super-secret-token' }
              ]
            },
            response: {
              status: 500,
              statusText: 'Internal Server Error',
              headers: [
                { name: 'Content-Type', value: 'application/json' }
              ],
              content: {
                text: '{"error":"Demo inventory service unavailable"}'
              }
            }
          }
        ]
      }
    });

    const parsed = parseHar(sampleHar);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].method).toBe('POST');
    expect(parsed.entries[0].status).toBe(500);
    expect(parsed.entries[0].duration).toBe(142);
    expect(parsed.entries[0].requestId).toBe('req-order-123');
    // Verify secret was redacted in cleaned content
    expect(parsed.content).toContain('[REDACTED]');
    expect(parsed.content).not.toContain('super-secret-token');
  });

  it('rejects malformed HAR without log.entries', () => {
    expect(() => parseHar('{"invalid": true}')).toThrow(/Invalid HAR: expected log.entries array/);
  });

  it('rejects HAR entry missing request URL or response status', () => {
    const badHar = JSON.stringify({
      log: {
        entries: [{ request: {}, response: {} }]
      }
    });
    expect(() => parseHar(badHar)).toThrow(/Invalid HAR entry/);
  });
});

describe('File Validation & Path Traversal Prevention', () => {
  it('rejects filenames with path traversal characters', () => {
    expect(() => validateName('../../etc/passwd')).toThrow(/simple filename without directory components/);
    expect(() => validateName('sub/dir/file.ts')).toThrow(/simple filename without directory components/);
    expect(() => validateName('..\\windows\\system32')).toThrow(/simple filename without directory components/);
  });

  it('rejects unsupported and executable file extensions', () => {
    expect(() => validateName('malicious.exe')).toThrow(/Unsupported file type/);
    expect(() => validateName('script.sh')).toThrow(/Unsupported file type/);
    expect(() => validateName('archive.zip')).toThrow(/Unsupported file type/);
  });

  it('accepts supported source, log, har, env, and markdown files', () => {
    expect(() => validateName('Cart.tsx')).not.toThrow();
    expect(() => validateName('network.har')).not.toThrow();
    expect(() => validateName('server.log')).not.toThrow();
    expect(() => validateName('package.json')).not.toThrow();
    expect(() => validateName('.env.example')).not.toThrow();
  });

  it('detects evidence kind correctly', () => {
    expect(detectKind('screenshot.png')).toBe('image');
    expect(detectKind('traffic.har')).toBe('har');
    expect(detectKind('package.json')).toBe('manifest');
    expect(detectKind('package-lock.json')).toBe('lockfile');
    expect(detectKind('.env.production')).toBe('env');
    expect(detectKind('app.log')).toBe('log');
    expect(detectKind('README.md')).toBe('instructions');
    expect(detectKind('component.tsx')).toBe('source');
  });
});

describe('Deterministic Setup Forensics Comparisons', () => {
  const makeEvidence = (id: string, name: string, kind: Evidence['kind'], label: string, content: string): Evidence => ({
    id,
    investigationId: 'inv-1',
    displayName: name,
    kind,
    sourceLabel: label,
    uploadedAt: new Date().toISOString(),
    bytes: content.length,
    mime: 'text/plain',
    content,
    warnings: [],
    entries: [],
    observations: [],
    report: { accepted: 1, parsedEntries: 1, excluded: [], truncation: [] }
  });

  it('detects incompatible Node engines version', () => {
    const workingManifest = makeEvidence('e1', 'package.json', 'manifest', 'Working machine', JSON.stringify({ engines: { node: '>=22.13.0' } }));
    const workingRuntime = makeEvidence('e2', 'runtime.txt', 'runtime', 'Working machine', 'Node.js v22.14.0\nnpm 10.9.0');
    const brokenManifest = makeEvidence('e3', 'package.json', 'manifest', 'Broken machine', JSON.stringify({ engines: { node: '>=22.13.0' } }));
    const brokenRuntime = makeEvidence('e4', 'runtime.txt', 'runtime', 'Broken machine', 'Node.js v18.19.0\nnpm 10.2.0');

    const diffs = compareSetup([workingManifest, workingRuntime, brokenManifest, brokenRuntime]);
    const brokenNode = diffs.find(d => d.check.includes('Broken: Node engines'));
    expect(brokenNode).toBeDefined();
    expect(brokenNode?.severity).toBe('error');
    expect(brokenNode?.broken).toContain('INCOMPATIBLE');

    const workingNode = diffs.find(d => d.check.includes('Working: Node engines'));
    expect(workingNode?.severity).toBe('info');
    expect(workingNode?.broken).toContain('compatible');
  });

  it('detects missing declared required environment variable', () => {
    const instructions = makeEvidence('e1', 'setup.md', 'instructions', 'Broken machine', 'Setup instructions:\n# required API_KEY, DATABASE_URL');
    const brokenEnv = makeEvidence('e2', '.env', 'env', 'Broken machine', 'API_KEY=[present; value redacted]\nDATABASE_URL=[missing]');

    const diffs = compareSetup([instructions, brokenEnv]);
    const missingVar = diffs.find(d => d.check.includes('required variable DATABASE_URL'));
    expect(missingVar).toBeDefined();
    expect(missingVar?.severity).toBe('error');
    expect(missingVar?.broken).toContain('MISSING');
  });

  it('detects port in use error from log content', () => {
    const log = makeEvidence('e1', 'terminal.log', 'log', 'Broken machine', 'Error: listen EADDRINUSE: address already in use :::3000');
    const diffs = compareSetup([log]);
    const portError = diffs.find(d => d.check === 'Port in use');
    expect(portError).toBeDefined();
    expect(portError?.severity).toBe('error');
  });

  it('detects peer dependency conflict from log content', () => {
    const log = makeEvidence('e1', 'npm.log', 'log', 'Broken machine', 'npm error code ERESOLVE\nnpm error ERESOLVE could not resolve peer dependency');
    const diffs = compareSetup([log]);
    const peerError = diffs.find(d => d.check === 'Peer dependency conflict');
    expect(peerError).toBeDefined();
    expect(peerError?.severity).toBe('error');
  });
});

describe('Timeline Assembly', () => {
  it('correlates events via explicit request IDs', () => {
    const harEvidence: Evidence = {
      id: 'e-har',
      investigationId: 'inv-1',
      displayName: 'network.har',
      kind: 'har',
      sourceLabel: 'Browser',
      uploadedAt: '2026-10-26T10:00:00Z',
      bytes: 100,
      mime: 'application/json',
      content: '',
      warnings: [],
      entries: [
        {
          index: 0,
          method: 'POST',
          url: '/api/demo/order',
          status: 500,
          duration: 35,
          startedDateTime: '2026-10-26T10:00:01.000Z',
          requestId: 'req-order-99',
          responseDetails: 'Error 500'
        }
      ],
      observations: [],
      report: { accepted: 1, parsedEntries: 1, excluded: [], truncation: [] }
    };

    const logEvidence: Evidence = {
      id: 'e-log',
      investigationId: 'inv-1',
      displayName: 'server.log',
      kind: 'log',
      sourceLabel: 'Backend',
      uploadedAt: '2026-10-26T10:00:00Z',
      bytes: 100,
      mime: 'text/plain',
      content: '{"timestamp":"2026-10-26T10:00:01.020Z","event":"backend.order.failed","requestId":"req-order-99","status":500}',
      warnings: [],
      entries: [],
      observations: [],
      report: { accepted: 1, parsedEntries: 1, excluded: [], truncation: [] }
    };

    const events = timeline([harEvidence, logEvidence]);
    expect(events).toHaveLength(2);
    expect(events[0].requestId).toBe('req-order-99');
    expect(events[0].association).toBe('explicit ID');
    expect(events[1].requestId).toBe('req-order-99');
    expect(events[1].association).toBe('explicit ID');
  });
});
