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

  it('gives unknown and skipped checks zero credit and reports evidence coverage separately', () => {
    const result = computeScore([
      { id: 'pass', title: 'Startup', category: 'runtime', status: 'pass', severity: 'info', summary: 'ok', evidence: [] },
      { id: 'unknown', title: 'Browser', category: 'browser', status: 'unknown', severity: 'medium', summary: 'unavailable', evidence: [] },
      { id: 'skipped', title: 'Build', category: 'build', status: 'skipped', severity: 'info', summary: 'not run', evidence: [] },
    ]);

    expect(result.categoryScores.browser.score).toBe(0);
    expect(result.categoryScores.build.score).toBe(0);
    expect(result.evidenceCoverage).toBeCloseTo(1 / 3);
    expect(result.verdict).toBe('INCOMPLETE');
  });

  it('averages warnings and passes within a category while a blocker remains decisive', () => {
    const result = computeScore([
      { id: 'pass-1', title: 'Pass', category: 'runtime', status: 'pass', severity: 'info', summary: 'ok', evidence: [] },
      { id: 'warn-1', title: 'Warn', category: 'runtime', status: 'warn', severity: 'medium', summary: 'concern', evidence: [] },
      { id: 'block', title: 'Block', category: 'build', status: 'block', severity: 'blocker', summary: 'failed', evidence: [] },
    ]);

    expect(result.categoryScores.runtime.score).toBe(15);
    expect(result.categoryScores.runtime.max).toBe(20);
    expect(result.verdict).toBe('NOT_READY');
  });

  it('keeps per-check score credit distinct from category status precedence', () => {
    const result = computeScore([
      { id: 'observed', title: 'Observed', category: 'environment', status: 'pass', severity: 'info', summary: 'ok', evidence: [] },
      { id: 'unavailable', title: 'Unavailable', category: 'environment', status: 'unknown', severity: 'medium', summary: 'unknown', evidence: [] },
    ]);

    expect(result.categoryScores.environment.status).toBe('unknown');
    expect(result.categoryScores.environment.score).toBe(5);
    expect(result.evidenceCoverage).toBe(0.5);
    expect(result.verdict).toBe('INCOMPLETE');
  });
});
