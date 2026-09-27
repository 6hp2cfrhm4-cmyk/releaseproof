import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cliPath = path.join(root, 'apps/cli/dist/index.js');
const workerPath = path.join(root, 'apps/desktop/dist/worker/verify.js');
const tempRoot = path.resolve(os.tmpdir());
const testRoot = await fs.mkdtemp(path.join(tempRoot, 'releaseproof-parity-'));
if (path.dirname(testRoot) !== tempRoot || !path.basename(testRoot).startsWith('releaseproof-parity-')) {
  throw new Error('Refusing to use an unexpected parity fixture directory.');
}

const commonChecks = {
  install: false,
  build: false,
  startup: false,
  browser: false,
  routes: false,
  environment: false,
  secrets: false,
  documentation: false,
  devProd: false,
};
const cases = [
  {
    name: 'healthy', verdict: 'READY',
    package: { scripts: { start: 'node server.cjs' } },
    files: { 'server.cjs': `require('node:http').createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }).listen(Number(process.env.PORT), '127.0.0.1');` },
    config: { checks: { ...commonChecks, startup: true } },
  },
  {
    name: 'build-failure', verdict: 'NOT_READY',
    package: { scripts: { build: 'node -e "process.exit(17)"' } },
    files: {},
    config: { checks: { ...commonChecks, build: true } },
  },
  {
    name: 'runtime-failure', verdict: 'NOT_READY',
    package: { scripts: { start: 'node -e "process.exit(17)"' } },
    files: {},
    config: { checks: { ...commonChecks, startup: true } },
  },
  {
    name: 'browser-failure', verdict: 'NOT_READY',
    package: { dependencies: { next: '14.2.0' }, scripts: { start: 'node server.cjs' } },
    files: { 'server.cjs': `require('node:http').createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body><main>Ready</main><script>setTimeout(() => { throw new Error("parity browser regression"); }, 100);</script></body></html>'); }).listen(Number(process.env.PORT), '127.0.0.1');` },
    config: { browser: { timeoutMs: 10000, observationWindowMs: 500 }, checks: { ...commonChecks, startup: true, browser: true } },
  },
  {
    name: 'external-dependency', verdict: 'INCOMPLETE',
    package: { dependencies: { pg: '^8.11.0' }, scripts: { start: 'node server.cjs' } },
    files: { 'server.cjs': `console.error('ConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:5432'); process.exit(1);` },
    config: { environment: { required: ['DATABASE_URL'] }, checks: { ...commonChecks, environment: true, startup: true } },
  },
];

try {
  for (const item of cases) {
    const projectPath = path.join(testRoot, item.name);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: `rp-parity-${item.name}`, ...item.package }, null, 2));
    for (const [file, content] of Object.entries(item.files)) {
      await fs.writeFile(path.join(projectPath, file), content, 'utf8');
    }
    await fs.writeFile(path.join(projectPath, '.releaseproof.json'), JSON.stringify({ ...item.config, start: { timeoutMs: 12000, stabilityWindowMs: 500 }, browser: { ...(item.config.browser ?? {}), timeoutMs: item.config.browser?.timeoutMs ?? 5000, observationWindowMs: item.config.browser?.observationWindowMs ?? 0 } }, null, 2));

    const cli = await runCli(projectPath);
    assert.ok([0, 1, 2].includes(cli.code), `${item.name}: unexpected CLI exit ${cli.code}: ${cli.stderr}`);
    assert.ok(cli.stdout.trim(), `${item.name}: CLI produced no JSON output (exit ${cli.code}): ${cli.stderr}`);
    const cliReport = JSON.parse(cli.stdout);
    assert.equal(cliReport.verdict, item.verdict, `${item.name}: CLI verdict (${JSON.stringify({ browser: cliReport.browserVerification, checks: cliReport.checks.map(({ id, status, classification }) => ({ id, status, classification })) })})`);

    const desktopReport = await runDesktopWorker(projectPath);
    assert.equal(desktopReport.verdict, item.verdict, `${item.name}: Desktop verdict`);
    assert.deepEqual(normalize(cliReport), normalize(desktopReport), `${item.name}: CLI/Desktop report mismatch`);
    console.log(`${item.name}: ${cliReport.verdict}, score ${cliReport.score}, ${cliReport.checks.length} checks, browser ${cliReport.browserVerification.status}`);
  }
  console.log(`CLI/Desktop parity passed for ${cases.length} safe cases.`);
} finally {
  await fs.rm(testRoot, { recursive: true, force: true });
}

function normalize(report) {
  return {
    verdict: report.verdict,
    score: report.score,
    runStatus: report.runStatus,
    browserMode: report.browserVerification.status,
    checks: report.checks.map(({ id, status, classification }) => ({ id, status, classification })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function runCli(projectPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, 'verify', projectPath, '--json'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runDesktopWorker(projectPath) {
  return new Promise((resolve, reject) => {
    const runId = `parity-${path.basename(projectPath)}`;
    const worker = fork(workerPath, [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
    let stderr = '';
    worker.stderr?.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { worker.kill(); reject(new Error(`${runId}: Desktop worker timed out. ${stderr}`)); }, 90000);
    worker.once('error', (error) => { clearTimeout(timer); reject(error); });
    worker.on('message', (event) => {
      if (event.runId !== runId) return;
      if (event.type === 'error') { clearTimeout(timer); worker.kill(); reject(new Error(`${runId}: ${event.message}\n${stderr}`)); }
      if (event.type === 'finished') {
        clearTimeout(timer);
        worker.once('exit', () => resolve(event.report));
      }
    });
    worker.send({ runId, projectPath, timeoutMs: 12000, cleanWorkspace: true });
  });
}
