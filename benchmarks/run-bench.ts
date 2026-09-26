import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { verifyProject } from '@releaseproof/core';
import { allFixtures, cleanupFixtureArtifacts } from './setup-fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

interface FixtureExpected {
  expectedVerdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
  expectedBlockerCategory?: string;
  expectedWarningCategory?: string;
  minBlockers?: number;
  minWarnings?: number;
  maxBlockers?: number;
  maxWarnings?: number;
  expectedBrowserVerification?: 'VERIFIED' | 'HTTP_FALLBACK' | 'UNAVAILABLE' | 'SKIPPED';
}

interface BenchResult {
  name: string;
  verdict: 'READY' | 'NOT_READY' | 'INCOMPLETE' | 'CANCELLED';
  expectedVerdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
  blockers: number;
  warnings: number;
  unknowns: number;
  isFalseBlocker: boolean;
  isMissedBug: boolean;
  durationMs: number;
  passed: boolean;
}

export async function runBenchmark(): Promise<void> {
  const mode = (process.env.RELEASEPROOF_BENCH_MODE || 'AUTHORITATIVE').toUpperCase();
  if (mode !== 'FAST' && mode !== 'AUTHORITATIVE') {
    throw new Error(`Unsupported RELEASEPROOF_BENCH_MODE: ${mode}`);
  }
  console.log('');
  console.log(pc.dim(`Mode: ${mode}`));
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.bold('               RELEASEPROOF BENCHMARK SUITE                '));
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.dim(`Running verification against test fixtures in: fixtures`));
  console.log('');

  const entries = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const requestedFixtures = new Set(
    (process.env.RELEASEPROOF_BENCH_FIXTURES || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  );
  const fixtureDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => requestedFixtures.size === 0 || requestedFixtures.has(name));

  const results: BenchResult[] = [];
  let tp = 0; // True Positives: broken apps correctly blocked
  let tn = 0; // True Negatives: working / env-incomplete apps not falsely blocked
  let fp = 0; // False Positives: working apps falsely blocked (False Blockers)
  let fn = 0; // False Negatives: broken apps falsely passed
  let totalUnknowns = 0;
  let totalDuration = 0;

  for (const name of fixtureDirs) {
    const fixDir = path.join(fixturesRoot, name);
    const expectedPath = path.join(fixDir, 'expected.json');

    let expected: FixtureExpected = { expectedVerdict: 'READY' };
    try {
      const raw = await fs.readFile(expectedPath, 'utf-8');
      expected = JSON.parse(raw);
    } catch {}

    const start = Date.now();
    try {
      const report = await verifyProject({
        projectDir: fixDir,
        skipSandbox: mode === 'FAST',
        config: {
          ...(process.env.RELEASEPROOF_PYTHON_INTERPRETER
            ? { python: { interpreter: process.env.RELEASEPROOF_PYTHON_INTERPRETER } }
            : {}),
          start: {
            timeoutMs: mode === 'FAST' ? 2500 : 10000,
            stabilityWindowMs: mode === 'FAST' ? 250 : 1000,
          },
          browser: {
            maxPages: 3,
            timeoutMs: mode === 'FAST' ? 3000 : 10000,
            observationWindowMs: mode === 'FAST' ? 100 : 500,
          },
        },
      });

      const durationMs = Date.now() - start;
      totalDuration += durationMs;

      if (report.runStatus !== 'completed') {
        throw new Error(`Fixture verification ended with run status ${report.runStatus}.`);
      }

      // Calculate precision / recall metrics
      const isFalseBlocker = expected.expectedVerdict !== 'NOT_READY' && report.verdict === 'NOT_READY';
      const isMissedBug = expected.expectedVerdict === 'NOT_READY' && report.verdict !== 'NOT_READY';

      if (expected.expectedVerdict === 'NOT_READY' && report.verdict === 'NOT_READY') {
        tp++;
      } else if (expected.expectedVerdict !== 'NOT_READY' && report.verdict !== 'NOT_READY') {
        tn++;
      }

      if (isFalseBlocker) fp++;
      if (isMissedBug) fn++;
      if (report.counts.unknown > 0) totalUnknowns++;

      const blockerCategories = new Set(report.checks.filter((c) => c.status === 'block').map((c) => c.category));
      const warningCategories = new Set(report.checks.filter((c) => c.status === 'warn').map((c) => c.category));
      const match = report.verdict === expected.expectedVerdict
        && (expected.expectedBlockerCategory === undefined || blockerCategories.has(expected.expectedBlockerCategory as any))
        && (expected.expectedWarningCategory === undefined || warningCategories.has(expected.expectedWarningCategory as any))
        && (expected.minBlockers === undefined || report.counts.blockers >= expected.minBlockers)
        && (expected.maxBlockers === undefined || report.counts.blockers <= expected.maxBlockers)
        && (expected.minWarnings === undefined || report.counts.warnings >= expected.minWarnings)
        && (expected.maxWarnings === undefined || report.counts.warnings <= expected.maxWarnings)
        && (expected.expectedBrowserVerification === undefined || report.browserVerification.status === expected.expectedBrowserVerification);

      results.push({
        name,
        verdict: report.verdict,
        expectedVerdict: expected.expectedVerdict,
        blockers: report.counts.blockers,
        warnings: report.counts.warnings,
        unknowns: report.counts.unknown,
        isFalseBlocker,
        isMissedBug,
        durationMs,
        passed: match,
      });

      const mark = match ? pc.green('✓') : pc.red('✗');
      const timeStr = `${(durationMs / 1000).toFixed(1)}s`.padStart(5, ' ');
      const verdictStr = report.verdict.padEnd(10, ' ');
      console.log(`  ${mark} ${name.padEnd(30, ' ')} ${verdictStr} (${report.counts.blockers}b, ${report.counts.warnings}w, ${report.counts.unknown}u) ${pc.dim(timeStr)}`);
      if (!match) {
        console.log(`    expected=${expected.expectedVerdict}` +
          ` blockerCategory=${expected.expectedBlockerCategory ?? '-'} warningCategory=${expected.expectedWarningCategory ?? '-'} browser=${expected.expectedBrowserVerification ?? '-'}`);
        console.log(`    actual blockers=${[...blockerCategories].join(',') || '-'} warnings=${[...warningCategories].join(',') || '-'} browser=${report.browserVerification.status}`);
        for (const check of report.checks.filter((item) => item.status === 'block' || item.status === 'unknown')) {
          console.log(`    ${check.id}: ${check.summary}`);
        }
      }
    } catch (err: unknown) {
      console.log(`  ${pc.red('✗')} ${name.padEnd(30, ' ')} ERROR: ${err}`);
      results.push({
        name,
        verdict: 'NOT_READY',
        expectedVerdict: expected.expectedVerdict,
        blockers: 0,
        warnings: 0,
        unknowns: 0,
        isFalseBlocker: false,
        isMissedBug: false,
        durationMs: 0,
        passed: false,
      });
    } finally {
      const fixture = allFixtures.find((item) => item.name === name);
      await cleanupFixtureArtifacts(fixDir, Boolean(fixture && Object.hasOwn(fixture.files, 'package-lock.json')));
    }
  }

  const precision = (tp + fp) > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : '100.0';
  const recall = (tp + fn) > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : '100.0';

  console.log('');
  console.log(pc.bold('Benchmark Results:'));
  console.log(pc.dim('─'.repeat(45)));
  console.log(`  Total Fixtures:        ${results.length}`);
  console.log(`  True Positives (TP):   ${pc.green(String(tp))}`);
  console.log(`  True Negatives (TN):   ${pc.green(String(tn))}`);
  console.log(`  False Positives (FP):  ${fp === 0 ? pc.green('0 (TARGET MET)') : pc.red(String(fp))}`);
  console.log(`  False Negatives (FN):  ${fn === 0 ? pc.green('0') : pc.yellow(String(fn))}`);
  console.log(`  Blocker Precision:     ${pc.green(precision + '%')}`);
  console.log(`  Blocker Recall:        ${pc.green(recall + '%')}`);
  console.log(`  External Dependencies: ${pc.cyan(String(totalUnknowns))}`);
  console.log(`  Total Runtime:         ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(pc.dim('─'.repeat(45)));

  const failedCases = results.filter((result) => !result.passed).length;
  if (fp > 0 || fn > 0 || failedCases > 0) {
    console.error(pc.bold(pc.red(`\nFAILED: ${fp} false blocker(s), ${fn} missed bug(s), ${failedCases} expectation/error mismatch(es).`)));
    process.exitCode = 1;
  } else {
    console.log(pc.bold(pc.green(`\nPASSED: Known False Blockers: 0! Precision: ${precision}%, Recall: ${recall}%.`)));
    process.exitCode = 0;
  }

  process.exit(process.exitCode ?? 0);
}

if (process.argv[1] && process.argv[1].endsWith('run-bench.ts')) {
  runBenchmark()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
