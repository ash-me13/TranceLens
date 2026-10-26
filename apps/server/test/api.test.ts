import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { Store } from '../src/store.js';
import { testProvider } from '../src/test-provider.js';

describe('TraceLens API Integration', () => {
  let tempDir: string;
  let store: Store;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'tracelens-api-test-'));
    store = new Store(tempDir);
    app = createApp(store, testProvider);
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/health returns ok status and storage', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.storage).toBe('SQLite');
  });

  it('GET /api/model/status reports provider status', async () => {
    const res = await request(app).get('/api/model/status');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.imageInput).toBe(true);
  });

  it('manages investigation lifecycle: create, add evidence, analyze, answer, test, export, delete', async () => {
    // 1. Create investigation
    const createRes = await request(app)
      .post('/api/investigations')
      .send({ title: 'Two tabs out of sync', mode: 'state' });
    expect(createRes.status).toBe(201);
    const invId = createRes.body.id;

    // 2. Add text evidence
    const evidenceRes = await request(app)
      .post(`/api/investigations/${invId}/evidence`)
      .send({
        displayName: 'Cart.tsx',
        kind: 'source',
        sourceLabel: 'Tab A code',
        content: 'export function useCart() { const [cart, setCart] = useState([]); return cart; }'
      });
    expect(evidenceRes.status).toBe(201);
    expect(evidenceRes.body.displayName).toBe('Cart.tsx');

    // 3. Start analysis job
    const analyzeRes = await request(app)
      .post(`/api/investigations/${invId}/analyze`);
    expect(analyzeRes.status).toBe(202);
    const jobId = analyzeRes.body.id;

    // 4. Poll job until completed
    let jobCompleted = false;
    for (let i = 0; i < 20; i++) {
      const jobRes = await request(app).get(`/api/investigations/${invId}/jobs/${jobId}`);
      if (jobRes.body.status === 'completed') {
        jobCompleted = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    expect(jobCompleted).toBe(true);

    // 5. Verify analysis was persisted as Revision 1
    const invDetailRes = await request(app).get(`/api/investigations/${invId}`);
    expect(invDetailRes.status).toBe(200);
    expect(invDetailRes.body.analyses).toHaveLength(1);
    expect(invDetailRes.body.analyses[0].revision).toBe(1);
    const qId = invDetailRes.body.analyses[0].nextQuestion.id;

    // 6. Answer follow-up question -> triggers job for Revision 2
    const answerRes = await request(app)
      .post(`/api/investigations/${invId}/answers`)
      .send({
        questionId: qId,
        text: 'Refreshing the second tab updates the cart to match Tab A.'
      });
    expect(answerRes.status).toBe(202);
    const answerJobId = answerRes.body.id;

    for (let i = 0; i < 20; i++) {
      const jobRes = await request(app).get(`/api/investigations/${invId}/jobs/${answerJobId}`);
      if (jobRes.body.status === 'completed') break;
      await new Promise(r => setTimeout(r, 100));
    }

    const afterAnswer = await request(app).get(`/api/investigations/${invId}`);
    expect(afterAnswer.body.analyses).toHaveLength(2);
    expect(afterAnswer.body.analyses[1].revision).toBe(2);
    expect(afterAnswer.body.interactions).toHaveLength(1);

    // 7. Export as Markdown
    const exportMd = await request(app).get(`/api/investigations/${invId}/export?format=markdown`);
    expect(exportMd.status).toBe(200);
    expect(exportMd.headers['content-type']).toContain('text/markdown');
    expect(exportMd.text).toContain('# Two tabs out of sync');
    expect(exportMd.text).toContain('## Revision 1');
    expect(exportMd.text).toContain('## Revision 2');

    // 8. Export as JSON
    const exportJson = await request(app).get(`/api/investigations/${invId}/export`);
    expect(exportJson.status).toBe(200);
    expect(exportJson.body.limitations).toBeDefined();

    // 9. Delete investigation
    const deleteRes = await request(app).delete(`/api/investigations/${invId}`);
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await request(app).get(`/api/investigations/${invId}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('creates sample recorded investigation via POST /api/samples', async () => {
    const res = await request(app).post('/api/samples');
    expect(res.status).toBe(201);
    expect(res.body.sample).toBe(true);
    expect(res.body.analyses).toHaveLength(1);
    expect(res.body.analyses[0].modelMetadata.provider).toBe('recorded');
    expect(res.body.analyses[0].summary).toContain('Sample investigation — recorded example');
  });

  it('handles cancellation properly', async () => {
    const createRes = await request(app)
      .post('/api/investigations')
      .send({ title: 'Cancel test', mode: 'state' });
    const invId = createRes.body.id;

    await request(app)
      .post(`/api/investigations/${invId}/evidence`)
      .send({
        displayName: 'test.log',
        kind: 'log',
        sourceLabel: 'Test',
        content: 'Sample test log'
      });

    const analyzeRes = await request(app).post(`/api/investigations/${invId}/analyze`);
    const jobId = analyzeRes.body.id;

    // Immediately cancel
    const cancelRes = await request(app).post(`/api/investigations/${invId}/jobs/${jobId}/cancel`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.cancelled).toBe(true);
  });
});
