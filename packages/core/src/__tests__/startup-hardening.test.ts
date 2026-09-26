import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { runStartupCheck } from '../checks/startup.js';

describe('startup ownership and stability hardening', () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('never accepts a foreign pre-existing listener as target evidence', async () => {
    const foreign = http.createServer((_req, res) => res.end('foreign'));
    await new Promise<void>((resolve) => foreign.listen(0, '127.0.0.1', resolve));
    const address = foreign.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    try {
      const result = await runStartupCheck(process.cwd(), 'node -e "process.exit(0)"', port, 1000, '/', 100);
      expect(result.checkResult.id).toBe('startup-port-occupied');
      expect(result.checkResult.status).toBe('unknown');
      expect(result.service).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => foreign.close(() => resolve()));
    }
  });

  it('blocks a server that exits during the stability window', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-delayed-crash-'));
    roots.push(root);
    const serverPath = path.join(root, 'server.cjs');
    await fs.writeFile(serverPath, `const http=require('node:http');\nconst s=http.createServer((_q,r)=>r.end('ok'));\ns.listen(Number(process.env.PORT),'127.0.0.1');\nsetTimeout(()=>process.exit(17),300);\n`);
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const result = await runStartupCheck(root, `node ${JSON.stringify(serverPath)}`, port, 3000, '/', 1000);
    expect(result.checkResult.id).toBe('startup-stability');
    expect(result.checkResult.status).toBe('block');
    expect(result.checkResult.classification).toBe('APPLICATION_FAILURE');
  });

  it('marks a live server with an unexplained delayed HTTP timeout as incomplete', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-delayed-timeout-'));
    roots.push(root);
    const serverPath = path.join(root, 'server.cjs');
    await fs.writeFile(serverPath, `let requests=0;require('node:http').createServer((_q,r)=>{requests++;if(requests===1)r.end('ok');}).listen(Number(process.env.PORT),'127.0.0.1');`);
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    // Keep startup allowance comfortably above the stability window so a slow
    // Windows/CI process launch cannot accidentally exercise the startup-timeout
    // branch instead of the delayed HTTP timeout this test is intended to cover.
    const result = await runStartupCheck(root, `node ${JSON.stringify(serverPath)}`, port, 5000, '/', 1000);
    expect(result.checkResult.status).toBe('unknown');
    expect(result.checkResult.classification).toBe('VERIFICATION_UNAVAILABLE');
  }, 15000);
});
