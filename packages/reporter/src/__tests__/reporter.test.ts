import { describe, it, expect } from 'vitest';
import {
  formatTerminalReport,
  formatVibeCheckCard,
  generateAiHandoffMarkdown,
  generateHtmlReport,
} from '../index.js';
import { VerificationReport } from '@releaseproof/schemas';

const mockReport: VerificationReport = {
  id: 'test-123',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
  projectName: 'test-app',
  projectPath: '/tmp/test-app',
  profile: {
    root: '/tmp/test-app',
    name: 'test-app',
    languages: ['typescript'],
    frameworks: [],
    runtime: [{ type: 'node', version: '22' }],
    packageManagers: [{ type: 'npm' }],
    commands: {},
    ports: [3000],
    environmentVariables: [],
    capabilities: { browser: true, api: false, docker: false },
    entrypoints: ['/'],
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
    total: 2,
    passed: 0,
    warnings: 0,
    blockers: 2,
    unknown: 0,
    skipped: 0,
  },
  checks: [
    {
      id: 'build-fail',
      title: 'Build failure',
      category: 'build',
      status: 'block',
      severity: 'blocker',
      summary: 'Build command failed with code 1',
      evidence: [
        {
          type: 'command',
          command: 'npm run build',
          exitCode: 1,
          stderr: 'SyntaxError',
        },
      ],
      remediation: 'Fix syntax error',
    },
  ],
  durationMs: 3400,
  artifactsDir: '/tmp/test-app/.releaseproof',
};

describe('reporters', () => {
  it('formats terminal report with verdict and blockers', () => {
    const text = formatTerminalReport(mockReport);
    expect(text).toContain('NOT READY TO SHIP');
    expect(text).toContain('75 / 100');
    expect(text).toContain('Build failure');
  });

  it('formats vibe card with ascii border', () => {
    const card = formatVibeCheckCard(mockReport);
    expect(card).toContain('ReleaseProof');
    expect(card).toContain('VIBE CHECK');
    expect(card).toContain('NOT READY TO SHIP');
  });

  it('generates AI handoff markdown with reproduction instructions', () => {
    const md = generateAiHandoffMarkdown(mockReport);
    expect(md).toContain('# ReleaseProof Fix Task');
    expect(md).toContain('Build command failed with code 1');
    expect(md).toContain('npx releaseproof verify');
  });

  it('generates standalone HTML report', () => {
    const html = generateHtmlReport(mockReport);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ReleaseProof Report — test-app');
    expect(html).toContain('copyForAi');
  });
});
