import { describe, it, expect } from 'vitest';
import { computeScore } from '../index.js';
import { CheckResult } from '@releaseproof/schemas';

describe('scoring engine', () => {
  it('gives 100 score and READY verdict when all checks pass', () => {
    const checks: CheckResult[] = [
      {
        id: '1',
        title: 'Install',
        category: 'install',
        status: 'pass',
        severity: 'info',
        summary: 'ok',
        evidence: [],
      },
      {
        id: '2',
        title: 'Build',
        category: 'build',
        status: 'pass',
        severity: 'info',
        summary: 'ok',
        evidence: [],
      },
      {
        id: '3',
        title: 'Runtime',
        category: 'runtime',
        status: 'pass',
        severity: 'info',
        summary: 'ok',
        evidence: [],
      },
    ];

    const result = computeScore(checks);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('READY');
    expect(result.counts.blockers).toBe(0);
  });

  it('forces NOT_READY whenever a blocker exists even if score is high', () => {
    const checks: CheckResult[] = [
      {
        id: '1',
        title: 'Install',
        category: 'install',
        status: 'pass',
        severity: 'info',
        summary: 'ok',
        evidence: [],
      },
      {
        id: '2',
        title: 'Build',
        category: 'build',
        status: 'pass',
        severity: 'info',
        summary: 'ok',
        evidence: [],
      },
      {
        id: '3',
        title: 'Secrets',
        category: 'security',
        status: 'block',
        severity: 'blocker',
        summary: 'Leaked AWS key',
        evidence: [],
      },
    ];

    const result = computeScore(checks);
    expect(result.verdict).toBe('NOT_READY');
    expect(result.counts.blockers).toBe(1);
    expect(result.categoryScores.security.score).toBe(0);
    expect(result.score).toBe(75); // normalized across categories with evidence
  });

  it('marks zero checks and skipped-only verification incomplete with no earned score', () => {
    const empty = computeScore([]);
    expect(empty.verdict).toBe('INCOMPLETE');
    expect(empty.score).toBe(0);

    const skipped = computeScore([{
      id: 'skip', title: 'Skipped', category: 'runtime', status: 'skipped',
      severity: 'info', summary: 'not run', evidence: [],
    }]);
    expect(skipped.verdict).toBe('INCOMPLETE');
    expect(skipped.score).toBe(0);
  });

  it('excludes explicitly not-applicable categories from the denominator', () => {
    const result = computeScore([
      { id: 'ok', title: 'API', category: 'api', status: 'pass', severity: 'info', summary: 'ok', evidence: [] },
      { id: 'na', title: 'Browser', category: 'browser', status: 'not_applicable', severity: 'info', summary: 'API only', evidence: [] },
    ]);
    expect(result.categoryScores.browser.max).toBe(0);
    expect(result.categoryScores.browser.status).toBe('not_applicable');
    expect(result.counts.notApplicable).toBe(1);
  });
});
