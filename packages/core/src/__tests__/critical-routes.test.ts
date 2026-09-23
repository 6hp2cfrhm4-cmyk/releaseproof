import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyProject } from '../engine.js';

describe('configured critical route coverage', () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('blocks when root is healthy but a configured critical route returns 500', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-critical-route-'));
    roots.push(root);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'critical-route', scripts: { start: 'node server.cjs' } }));
    await fs.writeFile(path.join(root, 'server.cjs'), `require('node:http').createServer((q,r)=>{ if(q.url==='/critical'){r.writeHead(500);return r.end('broken')} r.end('ok') }).listen(Number(process.env.PORT),'127.0.0.1');`);
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const report = await verifyProject({
      projectDir: root,
      skipSandbox: true,
      config: {
        criticalRoutes: ['/critical'],
        start: { port, timeoutMs: 3000, stabilityWindowMs: 100 },
        checks: { install: false, build: false, environment: false, secrets: false, documentation: false, devProd: false },
      },
    });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.checks.find((check) => check.id === 'browser-server-500')?.category).toBe('api');
  }, 15000);
});
