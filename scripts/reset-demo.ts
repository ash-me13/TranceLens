/**
 * scripts/reset-demo.ts
 * Resets TraceLens demo events and clears any demo artifacts.
 */
import { Store } from '../apps/server/src/store.js';
import path from 'node:path';

async function resetDemo() {
  const port = process.env.PORT || '3001';
  const host = process.env.HOST || '127.0.0.1';
  const url = `http://${host}:${port}/api/demo/reset`;

  console.log(`[TraceLens] Resetting demo state via ${url}...`);

  try {
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log('✓ Demo logs and backend state successfully reset via active server.');
      return;
    }
  } catch {
    console.log('ℹ Server not currently running on port 3001. Directly clearing local demo data store...');
  }

  // Also clean SQLite demo items if data dir exists
  const root = path.resolve(import.meta.dirname, '..');
  const dataDir = path.resolve(root, process.env.DATA_DIR || 'data');
  try {
    const store = new Store(dataDir);
    // Find and clean sample investigations
    const list = store.list();
    for (const inv of list) {
      if (inv.sample) {
        store.delete(inv.id);
      }
    }
    store.close();
    console.log('✓ Reset sample investigations in SQLite database.');
  } catch (err: any) {
    console.log(`ℹ Store clean note: ${err.message}`);
  }

  console.log('✓ Demo state clean reset complete.');
}

resetDemo().catch(err => {
  console.error('Failed to reset demo:', err);
  process.exit(1);
});
