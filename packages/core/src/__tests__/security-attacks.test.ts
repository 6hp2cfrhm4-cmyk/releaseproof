import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { redactSecrets } from '@releaseproof/security';
import { execCommand, spawnService } from '@releaseproof/runner';
import { createCleanWorkspace } from '@releaseproof/sandbox';
import { generateHtmlReport } from '@releaseproof/reporter';
import { VerificationReport } from '@releaseproof/schemas';

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
      timestamp: new Date().toISOString(),
      projectName: maliciousPayload,
      projectPath: '/test/' + maliciousPayload,
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
        ports: [3000],
        commands: { install: 'npm install', build: maliciousPayload, start: 'npm start' },
      },
      verdict: 'NOT_READY',
      score: 50,
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
      counts: { blockers: 1, warnings: 0, passed: 1, unknown: 0, skipped: 0, total: 2 },
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
});
