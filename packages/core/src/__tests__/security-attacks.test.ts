import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as http from 'node:http';
import { redactSecrets } from '@releaseproof/security';
import { execCommand, spawnService } from '@releaseproof/runner';
import { createCleanWorkspace } from '@releaseproof/sandbox';
import { formatTerminalReport, generateAiHandoffMarkdown, generateHtmlReport, publishReportArtifacts } from '@releaseproof/reporter';
import { VerificationReport } from '@releaseproof/schemas';
import { verifyProject } from '../engine.js';
import { runReadmeContractCheck } from '../checks/readme.js';

describe('security attack & hardening test suite', () => {
  const testRoots: string[] = [];

  afterEach(async () => {
    for (const r of testRoots) {
      try {
        await fs.rm(r, { recursive: true, force: true });
      } catch {}
    }
    testRoots.length = 0;
  });

  it('neutralizes HTML injection in report data preventing XSS', () => {
    const maliciousPayload = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
    const mockReport: VerificationReport = {
      id: 'attack-test',
      version: '0.1.0',
      runStatus: 'completed',
      timestamp: new Date().toISOString(),
      projectName: maliciousPayload,
      projectPath: '/test/' + maliciousPayload,
      target: { path: '.', kind: 'root' },
      profile: {
        name: maliciousPayload,
        root: '/test',
        runtime: [{ type: 'node' }],
        languages: ['javascript'],
        environmentVariables: [],
        capabilities: { browser: true, api: true, docker: false },
        frameworks: [{ type: 'generic-node', name: maliciousPayload, confidence: 1 }],
        packageManagers: [{ type: 'npm', lockfile: 'package-lock.json' }],
        entrypoints: ['/'],
        targetCandidates: [],
        ports: [3000],
        commands: { install: 'npm install', build: maliciousPayload, start: 'npm start' },
      },
      verdict: 'NOT_READY',
      score: 50,
      evidenceCoverage: 1,
      categoryScores: {
        install: { score: 15, max: 15, status: 'pass' },
        build: { score: 0, max: 15, status: 'fail' },
        runtime: { score: 0, max: 20, status: 'fail' },
        browser: { score: 0, max: 15, status: 'fail' },
        api: { score: 0, max: 10, status: 'fail' },
        environment: { score: 10, max: 10, status: 'pass' },
        documentation: { score: 5, max: 5, status: 'pass' },
        security: { score: 10, max: 10, status: 'pass' },
      },
      counts: { blockers: 1, warnings: 0, passed: 1, unknown: 0, skipped: 0, notApplicable: 0, total: 2 },
      browserVerification: { status: 'VERIFIED' },
      checks: [
        {
          id: 'xss-check',
          title: 'Malicious error: ' + maliciousPayload,
          category: 'security',
          status: 'block',
          severity: 'blocker',
          summary: 'Injected summary ' + maliciousPayload,
          evidence: [
            {
              type: 'command',
              command: maliciousPayload,
              exitCode: 1,
              stdout: maliciousPayload,
              stderr: maliciousPayload,
            },
          ],
        },
      ],
      durationMs: 1234,
      artifactsDir: '/test/.releaseproof',
      timings: { totalMs: 1234 },
      limitations: [],
    };

    const html = generateHtmlReport(mockReport);

    // The generated HTML MUST NOT execute raw script tags from report data
    expect(html).not.toContain('<script>alert("pwned")</script>');
    // The serializeSafeJson helper must escape < and > inside script tag
    expect(html).toContain('\\u003cscript\\u003ealert(\\"pwned\\")\\u003c/script\\u003e');
  });

  it('redacts all sensitive patterns including API keys, tokens, and private keys', () => {
    const secretText = 'Error connecting with AKIAIOSFODNN7EXAMPLE and ghp_123456789012345678901234567890123456';
    const redacted = redactSecrets(secretText);

    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('AKIA****************');
    expect(redacted).not.toContain('ghp_123456789012345678901234567890123456');
    expect(redacted).toContain('ghp_********************************');
  });

  it('prevents path traversal outside sandbox boundaries', async () => {
    const maliciousDir = path.join(os.tmpdir(), `rp-attack-${Date.now()}`);
    testRoots.push(maliciousDir);
    await fs.mkdir(maliciousDir, { recursive: true });

    await fs.writeFile(path.join(maliciousDir, 'package.json'), '{"name":"traversal"}');

    const workspace = await createCleanWorkspace(maliciousDir);
    try {
      // Sandbox should be safely created in a temp dir
      expect(workspace.path).not.toBe(maliciousDir);
      expect(path.isAbsolute(workspace.path)).toBe(true);
    } finally {
      await workspace.dispose();
    }
  });

  it('handles arguments containing spaces and quotes safely', async () => {
    // Run an echo command with spaced and quoted arguments
    const res = await execCommand('node -e "console.log(process.argv.slice(1).join(\'|\'))" "hello world" "foo bar"', {
      timeoutMs: 5000,
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toContain('hello world|foo bar');
  });

  it('terminates background process trees when killed', async () => {
    // Spawn a service that loops
    const code = 'setInterval(() => {}, 1000);';
    const service = spawnService(`node -e "${code}"`);

    // Give it a moment to spawn
    await new Promise((r) => setTimeout(r, 300));
    expect(service.pid).toBeGreaterThan(0);

    await service.kill();
    expect(service.isAlive()).toBe(false);
  });

  it('redacts explicitly provided values at JSON, HTML, AI handoff, and terminal boundaries', async () => {
    const secret = 'synthetic-secret-value';
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-redaction-e2e-'));
    testRoots.push(root);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'redaction-e2e', scripts: { start: 'node server.cjs' } }));
    await fs.writeFile(path.join(root, 'server.cjs'), `console.log(process.env.RELEASEPROOF_TEST_SECRET); require('node:http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT),'127.0.0.1');`);

    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const report = await verifyProject({
      projectDir: root,
      skipSandbox: true,
      config: {
        environment: { provide: { RELEASEPROOF_TEST_SECRET: secret } },
        start: { port, timeoutMs: 3000, stabilityWindowMs: 100 },
        checks: { install: false, build: false, browser: false, environment: false, secrets: false, documentation: false, devProd: false },
      },
    });
    await publishReportArtifacts(report, path.join(root, '.releaseproof'));
    const artifacts = [
      JSON.stringify(report),
      await fs.readFile(path.join(root, '.releaseproof', 'report.json'), 'utf8'),
      generateHtmlReport(report),
      generateAiHandoffMarkdown(report),
      formatTerminalReport(report),
    ];
    for (const artifact of artifacts) {
      expect(artifact).not.toContain(secret);
    }
  }, 15000);

  it('does not mistake pnpm install shorthand for a package script', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-readme-pnpm-'));
    testRoots.push(root);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'vite build' } }));
    await fs.writeFile(path.join(root, 'README.md'), '```bash\npnpm i # install dependencies\npnpm build\n```');
    const checks = await runReadmeContractCheck(root);
    expect(checks.find((check) => check.id === 'readme-invalid-scripts')).toBeUndefined();
  });
});
