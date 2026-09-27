import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { assertReportArtifactSet } from '@releaseproof/reporter';

const cliPath = path.resolve(process.cwd(), 'apps/cli/dist/index.js');

describe('real CLI binary contract', () => {
  const roots: string[] = [];

  beforeAll(async () => {
    await fs.access(cliPath);
  });

  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('propagates verify options while preserving project config fields', async () => {
    const root = await createNodeFixture(roots, `
const http = require('node:http');
http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(204); return res.end(); }
  res.writeHead(500); res.end('wrong health path');
}).listen(Number(process.env.PORT), '127.0.0.1');
`);
    const configuredPort = await getFreePort();
    const cliPort = await getFreePort();
    await fs.writeFile(path.join(root, '.releaseproof.json'), JSON.stringify({
      start: { port: configuredPort, healthCheckPath: '/health', stabilityWindowMs: 100 },
      checks: minimalChecks(),
    }));

    // Leave enough startup budget for a fully parallel Windows suite; the assertion below
    // still proves that the CLI port override and nested project config are both applied.
    const result = await runCli(['verify', root, '--port', String(cliPort), '--timeout', '8000', '--json', '--skip-sandbox']);
    expect(result.code, JSON.stringify(result)).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.verdict).toBe('READY');
    const artifactDir = path.join(root, '.releaseproof');
    const diskReport = JSON.parse(await fs.readFile(path.join(artifactDir, 'report.json'), 'utf8'));
    const htmlReport = await fs.readFile(path.join(artifactDir, 'report.html'), 'utf8');
    const aiHandoff = await fs.readFile(path.join(artifactDir, 'RELEASEPROOF_FIX.md'), 'utf8');
    await expect(assertReportArtifactSet(artifactDir, report.id)).resolves.toMatchObject({ id: report.id, verdict: report.verdict });
    expect(diskReport.id).toBe(report.id);
    expect(htmlReport).toContain(`Report ${report.id}`);
    expect(aiHandoff).toContain(`**Report ID**: ${report.id}`);
    expect(aiHandoff).toContain(`**Status**: ${report.verdict}`);
    const processEvidence = report.checks.find((check: any) => check.id === 'startup-check').evidence.find((item: any) => item.type === 'process');
    expect(processEvidence.port).toBe(cliPort);
    expect(report.checks.find((check: any) => check.id === 'startup-check').summary).toContain('100ms');
    const validReportCommand = await runCli(['report', root, '--no-open']);
    expect(validReportCommand.code, JSON.stringify(validReportCommand)).toBe(0);
    await fs.appendFile(path.join(artifactDir, 'report.html'), '<!-- unexpected stale data -->');
    const tamperedReportCommand = await runCli(['report', root, '--no-open']);
    expect(tamperedReportCommand.code).toBe(1);
    expect(tamperedReportCommand.stderr).toContain('No ReleaseProof report found.');
    const tamperedVibeCommand = await runCli(['vibe', root]);
    expect(tamperedVibeCommand.code).not.toBe(0);
    expect(tamperedVibeCommand.stdout).not.toContain('Vibe check');

    const repeated = await runCli(['verify', root, '--port', String(cliPort), '--timeout', '8000', '--json', '--skip-sandbox']);
    expect(repeated.code, JSON.stringify(repeated)).toBe(0);
    const repeatedReport = JSON.parse(repeated.stdout);
    expect(repeatedReport.id).not.toBe(report.id);
    const repeatedDiskReport = JSON.parse(await fs.readFile(path.join(artifactDir, 'report.json'), 'utf8'));
    expect(repeatedDiskReport.id).toBe(repeatedReport.id);
    await expect(assertReportArtifactSet(artifactDir, repeatedReport.id)).resolves.toMatchObject({ id: repeatedReport.id, verdict: repeatedReport.verdict });
    expect(await fs.readFile(path.join(artifactDir, 'report.html'), 'utf8')).toContain(`Report ${repeatedReport.id}`);
    expect(await fs.readFile(path.join(artifactDir, 'RELEASEPROOF_FIX.md'), 'utf8')).toContain(`**Report ID**: ${repeatedReport.id}`);
  }, 35000);

  it('publishes and validates the complete report set when vibe performs the first verification', async () => {
    const root = await createNodeFixture(roots, `require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT),'127.0.0.1');`);
    await fs.writeFile(path.join(root, '.releaseproof.json'), JSON.stringify({
      checks: minimalChecks(),
      start: { stabilityWindowMs: 100 },
    }));

    const result = await runCli(['vibe', root]);
    expect(result.code, JSON.stringify(result)).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
    await expect(assertReportArtifactSet(path.join(root, '.releaseproof'))).resolves.toMatchObject({ runStatus: 'completed' });
  }, 15000);

  it('uses stable exit codes for incomplete, not-ready, and internal-error outcomes', async () => {
    const root = await createNodeFixture(roots, `require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT),'127.0.0.1');`);
    await fs.writeFile(path.join(root, '.releaseproof.json'), JSON.stringify({ checks: minimalChecks(), start: { stabilityWindowMs: 50 } }));

    const foreign = http.createServer((_req, res) => res.end('foreign'));
    await new Promise<void>((resolve) => foreign.listen(0, '127.0.0.1', resolve));
    const address = foreign.address();
    const occupiedPort = typeof address === 'object' && address ? address.port : 0;
    try {
      const incomplete = await runCli(['verify', root, '--port', String(occupiedPort), '--json', '--skip-sandbox']);
      expect(incomplete.code, JSON.stringify(incomplete)).toBe(2);
    } finally {
      await new Promise<void>((resolve) => foreign.close(() => resolve()));
    }

    await fs.writeFile(path.join(root, 'server.cjs'), 'process.exit(17);');
    const notReady = await runCli(['verify', root, '--port', String(await getFreePort()), '--timeout', '500', '--json', '--skip-sandbox']);
    expect(notReady.code, JSON.stringify(notReady)).toBe(1);
    expect((await runCli(['verify', root, '--port', 'invalid', '--json', '--skip-sandbox'])).code).toBe(3);
  }, 15000);

  it.skipIf(process.platform === 'win32')('cleans its temporary workspace after SIGINT', async () => {
    const root = await createNodeFixture(roots, `require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT),'127.0.0.1');`);
    await fs.writeFile(path.join(root, '.releaseproof.json'), JSON.stringify({
      checks: minimalChecks(),
      start: { port: await getFreePort(), stabilityWindowMs: 15000 },
    }));
    const before = new Set((await fs.readdir(os.tmpdir())).filter((name) => name.startsWith('releaseproof-')));
    const child = spawn(process.execPath, [cliPath, 'verify', root, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });

    let created: string | undefined;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && !created) {
      const names = (await fs.readdir(os.tmpdir())).filter((name) => name.startsWith('releaseproof-'));
      created = names.find((name) => !before.has(name));
      if (!created) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(created).toBeDefined();
    child.kill('SIGINT');
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(code).toBe(130);
    expect(await exists(path.join(os.tmpdir(), created!))).toBe(false);
  }, 20000);
});

function minimalChecks() {
  return { install: false, build: false, startup: true, browser: false, routes: false, environment: false, secrets: false, documentation: false, devProd: false };
}

async function createNodeFixture(roots: string[], source: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-cli-e2e-'));
  roots.push(root);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'cli-e2e', scripts: { start: 'node server.cjs' } }));
  await fs.writeFile(path.join(root, 'server.cjs'), source);
  return root;
}

async function getFreePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function exists(target: string): Promise<boolean> {
  try { await fs.stat(target); return true; } catch { return false; }
}
