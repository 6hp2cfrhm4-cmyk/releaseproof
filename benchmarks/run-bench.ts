import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { verifyProject } from '@releaseproof/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

interface FixtureExpected {
  expectedVerdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
  expectedBlockerCategory?: string;
  expectedWarningCategory?: string;
  minBlockers?: number;
  minWarnings?: number;
}

interface BenchResult {
  name: string;
  verdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
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
  console.log('');
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.bold('               RELEASEPROOF BENCHMARK SUITE                '));
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.dim(`Running verification against test fixtures in: fixtures`));
  console.log('');

  const entries = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const fixtureDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

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
        skipSandbox: true, // run in-place for benchmark speed
        config: {
          start: {
            timeoutMs: 2500, // fast timeout for bench
          },
          browser: {
            maxPages: 3,
            timeoutMs: 3000,
          },
        },
      });

      const durationMs = Date.now() - start;
      totalDuration += durationMs;

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

      const match = !isFalseBlocker && !isMissedBug;

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

  if (fp > 0) {
    console.error(pc.bold(pc.red(`\nFAILED: Found ${fp} false blocker(s)! False blockers must be 0.`)));
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
