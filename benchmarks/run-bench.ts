import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { verifyProject } from '@releaseproof/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

interface FixtureExpected {
  expectedVerdict: 'READY' | 'NOT_READY';
  expectedBlockerCategory?: string;
  expectedWarningCategory?: string;
  minBlockers?: number;
  minWarnings?: number;
}

interface BenchResult {
  name: string;
  verdict: 'READY' | 'NOT_READY';
  expectedVerdict: 'READY' | 'NOT_READY';
  blockers: number;
  warnings: number;
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
  console.log(pc.dim(`Running verification against test fixtures in: ${fixturesRoot}`));
  console.log('');

  const entries = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const fixtureDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const results: BenchResult[] = [];
  let trueDetections = 0;
  let falseBlockers = 0;
  let missedBugs = 0;
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

      const isFalseBlocker = expected.expectedVerdict === 'READY' && report.verdict === 'NOT_READY';
      const isMissedBug = expected.expectedVerdict === 'NOT_READY' && report.verdict === 'READY';

      if (isFalseBlocker) falseBlockers++;
      if (isMissedBug) missedBugs++;
      if (expected.expectedVerdict === 'NOT_READY' && report.verdict === 'NOT_READY') {
        trueDetections++;
      }

      const match = !isFalseBlocker && !isMissedBug;

      results.push({
        name,
        verdict: report.verdict,
        expectedVerdict: expected.expectedVerdict,
        blockers: report.counts.blockers,
        warnings: report.counts.warnings,
        isFalseBlocker,
        isMissedBug,
        durationMs,
        passed: match,
      });

      const mark = match ? pc.green('✓') : pc.red('✗');
      const timeStr = `${(durationMs / 1000).toFixed(1)}s`.padStart(5, ' ');
      const verdictStr = report.verdict.padEnd(10, ' ');
      console.log(`  ${mark} ${name.padEnd(30, ' ')} ${verdictStr} (${report.counts.blockers}b, ${report.counts.warnings}w) ${pc.dim(timeStr)}`);
    } catch (err: unknown) {
      console.log(`  ${pc.red('✗')} ${name.padEnd(30, ' ')} ERROR: ${err}`);
      results.push({
        name,
        verdict: 'NOT_READY',
        expectedVerdict: expected.expectedVerdict,
        blockers: 0,
        warnings: 0,
        isFalseBlocker: false,
        isMissedBug: false,
        durationMs: 0,
        passed: false,
      });
    }
  }

  console.log('');
  console.log(pc.bold('Benchmark Results:'));
  console.log(pc.dim('─'.repeat(45)));
  console.log(`  Total Fixtures:    ${results.length}`);
  console.log(`  True Detections:   ${pc.green(String(trueDetections))}`);
  console.log(`  False Blockers:    ${falseBlockers === 0 ? pc.green('0 (TARGET MET)') : pc.red(String(falseBlockers))}`);
  console.log(`  Missed Bugs:       ${missedBugs === 0 ? pc.green('0') : pc.yellow(String(missedBugs))}`);
  console.log(`  Total Runtime:     ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(pc.dim('─'.repeat(45)));

  if (falseBlockers > 0) {
    console.error(pc.bold(pc.red(`\nFAILED: Found ${falseBlockers} false blocker(s)! False blockers must be 0 for MVP.`)));
    process.exitCode = 1;
  } else {
    console.log(pc.bold(pc.green(`\nPASSED: 0 False Blockers! ReleaseProof benchmark verified.`)));
    process.exitCode = 0;
  }
}

if (process.argv[1] && process.argv[1].endsWith('run-bench.ts')) {
  runBenchmark().catch(console.error);
}
