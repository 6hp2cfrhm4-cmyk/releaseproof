import { describe, it, expect } from 'vitest';
import {
  CheckResultSchema,
  EvidenceSchema,
  ProjectProfileSchema,
  VerificationReportSchema,
} from '../index.js';

describe('schemas', () => {
  it('validates a check result with command evidence', () => {
    const evidence = EvidenceSchema.parse({
      type: 'command',
      command: 'npm run build',
      exitCode: 1,
      stdout: 'Building...',
      stderr: 'Error: Module not found',
      durationMs: 1200,
    });

    const check = CheckResultSchema.parse({
      id: 'build-check',
      title: 'Production build',
      category: 'build',
      status: 'block',
      severity: 'blocker',
      summary: 'Build exited with code 1',
      evidence: [evidence],
      remediation: 'Install missing module',
    });

    expect(check.status).toBe('block');
    expect(check.evidence[0].type).toBe('command');
  });

  it('validates a complete project profile', () => {
    const profile = ProjectProfileSchema.parse({
      root: '/app',
      name: 'my-app',
      languages: ['typescript'],
      frameworks: [
        {
          type: 'nextjs',
          name: 'Next.js',
          version: '15.0.0',
          confidence: 0.95,
        },
      ],
      runtime: [{ type: 'node', version: '22.0.0' }],
      packageManagers: [{ type: 'pnpm', lockfile: 'pnpm-lock.yaml' }],
      commands: {
        build: 'pnpm build',
        start: 'pnpm start',
      },
      ports: [3000],
      capabilities: {
        browser: true,
        api: true,
        docker: false,
      },
    });

    expect(profile.frameworks[0].type).toBe('nextjs');
    expect(profile.capabilities.browser).toBe(true);
  });

  it('validates a verification report', () => {
    const report = VerificationReportSchema.parse({
      id: 'report-123',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      projectName: 'my-app',
      projectPath: '/app',
      profile: {
        root: '/app',
        name: 'my-app',
      },
      verdict: 'NOT_READY',
      score: 75,
      categoryScores: {
        install: { max: 15, score: 15, status: 'pass' },
        build: { max: 15, score: 0, status: 'fail' },
        runtime: { max: 20, score: 20, status: 'pass' },
        browser: { max: 15, score: 15, status: 'pass' },
        api: { max: 10, score: 10, status: 'pass' },
        environment: { max: 10, score: 10, status: 'pass' },
        documentation: { max: 5, score: 5, status: 'pass' },
        security: { max: 10, score: 0, status: 'fail' },
      },
      counts: {
        total: 8,
        passed: 6,
        warnings: 0,
        blockers: 2,
        unknown: 0,
        skipped: 0,
      },
      checks: [],
      durationMs: 4500,
      artifactsDir: '/app/.releaseproof',
    });

    expect(report.verdict).toBe('NOT_READY');
  });
});
