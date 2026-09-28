import { describe, expect, it } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { formatMetric, loadFixtureExpected, parseFixtureExpected, parseGitPorcelainStatus, selectBenchmarkFixtures } from './run-bench.js';

describe('authoritative benchmark integrity', () => {
  it('rejects missing or invalid expectations instead of assuming READY', async () => {
    await expect(loadFixtureExpected(path.join(os.tmpdir(), `missing-${Date.now()}.json`), 'fixture-a'))
      .rejects.toThrow(/missing expected\.json/);
    expect(() => parseFixtureExpected('{broken', 'fixture-a')).toThrow(/invalid expected\.json/);
    expect(() => parseFixtureExpected('{}', 'fixture-a')).toThrow(/must declare expectedVerdict/);
  });

  it('validates expectation values and unknown fields', () => {
    expect(() => parseFixtureExpected(JSON.stringify({ expectedVerdict: 'MAYBE' }), 'fixture-b'))
      .toThrow(/expectedVerdict/);
    expect(() => parseFixtureExpected(JSON.stringify({ expectedVerdict: 'READY', minBlockers: -1 }), 'fixture-b'))
      .toThrow(/invalid minBlockers/);
    expect(() => parseFixtureExpected(JSON.stringify({ expectedVerdict: 'READY', mystery: true }), 'fixture-b'))
      .toThrow(/unsupported field/);
    expect(parseFixtureExpected(JSON.stringify({
      expectedVerdict: 'NOT_READY',
      expectedBlockerCategory: 'build',
      expectedBlockerCheckId: 'build-check',
      minBlockers: 1,
    }), 'fixture-b').expectedVerdict).toBe('NOT_READY');
  });

  it('rejects vacuous and misspelled fixture selections', () => {
    expect(() => selectBenchmarkFixtures([], [])).toThrow(/selection is empty/);
    expect(() => selectBenchmarkFixtures(['express-working'], ['express-wroking']))
      .toThrow(/Unknown benchmark fixture/);
    expect(selectBenchmarkFixtures(['a', 'b'], ['b'])).toEqual(['b']);
    expect(selectBenchmarkFixtures(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('reports N/A rather than 100 percent when a metric denominator is zero', () => {
    expect(formatMetric(0, 0)).toBe('N/A');
    expect(formatMetric(2, 4)).toBe('50.0%');
  });

  it('retains porcelain status entries for source-integrity diagnostics', () => {
    expect(parseGitPorcelainStatus(' M benchmarks/run-bench.ts\r\n?? new-file.txt\r\n')).toEqual([
      ' M benchmarks/run-bench.ts',
      '?? new-file.txt',
    ]);
    expect(parseGitPorcelainStatus('')).toEqual([]);
  });

  it('rejects a fixture directory without its expectation file', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'releaseproof-benchmark-test-'));
    try {
      await expect(loadFixtureExpected(path.join(directory, 'expected.json'), 'fixture-c'))
        .rejects.toThrow(/missing expected\.json/);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
