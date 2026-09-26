import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyProject } from '../engine.js';
import { isPortListening } from '@releaseproof/runner';

describe('verification cancellation', () => {
  const roots: string[] = [];

  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('returns no shipping verdict and terminates its owned server on AbortSignal', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-cancel-run-'));
    roots.push(root);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
      name: 'cancel-run',
      scripts: { start: 'node server.cjs' },
    }));
    await fs.writeFile(path.join(root, 'server.cjs'), "require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT),'127.0.0.1');\n");

    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const controller = new AbortController();
    const report = await verifyProject({
      projectDir: root,
      skipSandbox: true,
      signal: controller.signal,
      config: {
        start: { port, timeoutMs: 5000, stabilityWindowMs: 5000 },
        checks: { install: false, build: false, browser: false, environment: false, secrets: false, documentation: false, devProd: false },
      },
      onProgress: (step, status) => {
        if (step === 'Starting production server' && status === 'running') {
          setTimeout(() => controller.abort(), 200);
        }
      },
    });

    expect(report.runStatus).toBe('cancelled');
    expect(report.verdict).toBe('CANCELLED');
    expect(report.score).toBe(0);
    expect(await isPortListening(port, '127.0.0.1', 100)).toBe(false);
  }, 15000);
});
