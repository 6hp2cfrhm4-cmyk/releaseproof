import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import pc from 'picocolors';
import { verifyProject } from '@releaseproof/core';
import { CheckCategorySchema, type CheckCategory } from '@releaseproof/schemas';
import { allFixtures, cleanupFixtureArtifacts, setupFixtures } from './setup-fixtures.js';

interface FixtureExpected {
  expectedVerdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
  expectedBlockerCategory?: CheckCategory;
  expectedWarningCategory?: CheckCategory;
  expectedBlockerCheckId?: string;
  minBlockers?: number;
  minWarnings?: number;
  maxBlockers?: number;
  maxWarnings?: number;
  expectedBrowserVerification?: 'VERIFIED' | 'HTTP_FALLBACK' | 'UNAVAILABLE' | 'SKIPPED';
}

const verdicts = new Set(['READY', 'NOT_READY', 'INCOMPLETE']);
const browserModes = new Set(['VERIFIED', 'HTTP_FALLBACK', 'UNAVAILABLE', 'SKIPPED']);
const countFields = ['minBlockers', 'minWarnings', 'maxBlockers', 'maxWarnings'] as const;

export function parseFixtureExpected(raw: string, fixtureName: string): FixtureExpected {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Fixture ${fixtureName} has invalid expected.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Fixture ${fixtureName} expected.json must contain an object.`);
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'expectedVerdict', 'expectedBlockerCategory', 'expectedWarningCategory', 'expectedBlockerCheckId',
    ...countFields, 'expectedBrowserVerification',
  ]);
  const unknownKeys = Object.keys(record).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Fixture ${fixtureName} expected.json contains unsupported field(s): ${unknownKeys.join(', ')}.`);
  }
  if (typeof record.expectedVerdict !== 'string' || !verdicts.has(record.expectedVerdict)) {
    throw new Error(`Fixture ${fixtureName} expected.json must declare expectedVerdict as READY, NOT_READY, or INCOMPLETE.`);
  }
  for (const key of ['expectedBlockerCategory', 'expectedWarningCategory'] as const) {
    const category = record[key];
    if (category !== undefined && !CheckCategorySchema.safeParse(category).success) {
      throw new Error(`Fixture ${fixtureName} expected.json has invalid ${key}.`);
    }
  }
  if (record.expectedBlockerCheckId !== undefined
    && (typeof record.expectedBlockerCheckId !== 'string' || record.expectedBlockerCheckId.trim() === '')) {
    throw new Error(`Fixture ${fixtureName} expected.json has invalid expectedBlockerCheckId.`);
  }
  if (record.expectedBrowserVerification !== undefined
    && (typeof record.expectedBrowserVerification !== 'string' || !browserModes.has(record.expectedBrowserVerification))) {
    throw new Error(`Fixture ${fixtureName} expected.json has invalid expectedBrowserVerification.`);
  }
  for (const key of countFields) {
    const count = record[key];
    if (count !== undefined && (!Number.isInteger(count) || Number(count) < 0)) {
      throw new Error(`Fixture ${fixtureName} expected.json has invalid ${key}; use a non-negative integer.`);
    }
  }
  if (record.minBlockers !== undefined && record.maxBlockers !== undefined
    && Number(record.minBlockers) > Number(record.maxBlockers)) {
    throw new Error(`Fixture ${fixtureName} expected.json has minBlockers greater than maxBlockers.`);
  }
  if (record.minWarnings !== undefined && record.maxWarnings !== undefined
    && Number(record.minWarnings) > Number(record.maxWarnings)) {
    throw new Error(`Fixture ${fixtureName} expected.json has minWarnings greater than maxWarnings.`);
  }
  return record as unknown as FixtureExpected;
}

export async function loadFixtureExpected(filePath: string, fixtureName: string): Promise<FixtureExpected> {
  const raw = await fs.readFile(filePath, 'utf-8').catch((error: unknown) => {
    throw new Error(`Fixture ${fixtureName} is missing expected.json: ${error instanceof Error ? error.message : String(error)}`);
  });
  return parseFixtureExpected(raw, fixtureName);
}

export function selectBenchmarkFixtures(
  declaredNames: readonly string[],
  requestedNames: readonly string[],
): string[] {
  const known = new Set(declaredNames);
  const unknown = requestedNames.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown benchmark fixture selection: ${unknown.join(', ')}.`);
  }
  const selected = requestedNames.length > 0
    ? [...new Set(requestedNames)]
    : [...declaredNames];
  if (selected.length === 0) {
    throw new Error('Benchmark fixture selection is empty; refusing to report a vacuous pass.');
  }
  return selected;
}

export function formatMetric(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : 'N/A';
}

export function parseGitPorcelainStatus(status: string): string[] {
  return status.split(/\r?\n/).filter((line) => line.length > 0);
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
  const fixturesRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'releaseproof-benchmark-'));
  try {
    await setupFixtures(fixturesRoot);
    await runBenchmarkAtRoot(fixturesRoot);
  } finally {
    await fs.rm(fixturesRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function runBenchmarkAtRoot(fixturesRoot: string): Promise<void> {
  const mode = (process.env.RELEASEPROOF_BENCH_MODE || 'AUTHORITATIVE').toUpperCase();
  if (mode !== 'FAST' && mode !== 'AUTHORITATIVE') {
    throw new Error(`Unsupported RELEASEPROOF_BENCH_MODE: ${mode}`);
  }
  console.log('');
  console.log(pc.dim(`Mode: ${mode}`));
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.bold('               RELEASEPROOF BENCHMARK SUITE                '));
  console.log(pc.bold('═══════════════════════════════════════════════════════════'));
  console.log(pc.dim(`Running verification against generated fixtures in: ${fixturesRoot}`));
  console.log('');

  const entries = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const requestedFixtures = new Set(
    (process.env.RELEASEPROOF_BENCH_FIXTURES || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  );
  const fixtureDirs = selectBenchmarkFixtures(
    allFixtures.map((fixture) => fixture.name),
    [...requestedFixtures],
  );
  const actualDirectories = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const missingDirectories = fixtureDirs.filter((name) => !actualDirectories.has(name));
  if (missingDirectories.length > 0) {
    throw new Error(`Benchmark fixtures are missing from disk: ${missingDirectories.join(', ')}. Run setup-fixtures first.`);
  }

  const startingSourceChanges = sourceTreeChanges();
  const results: BenchResult[] = [];
  let expectationMismatches = 0;
  let executionErrors = 0;
  let tp = 0; // True Positives: broken apps correctly blocked
  let tn = 0; // True Negatives: working / env-incomplete apps not falsely blocked
  let fp = 0; // False Positives: working apps falsely blocked (False Blockers)
  let fn = 0; // False Negatives: broken apps falsely passed
  let totalUnknowns = 0;
  let totalDuration = 0;

  for (const name of fixtureDirs) {
    const fixDir = path.join(fixturesRoot, name);
    const expectedPath = path.join(fixDir, 'expected.json');

    const expected = await loadFixtureExpected(expectedPath, name);

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
            // A disposable Python venv can spend several seconds resolving
            // its interpreter on hosted Windows runners. FAST is a smoke
            // profile, not a claim that startup must fit a 2.5s budget.
            timeoutMs: mode === 'FAST' ? 10000 : 10000,
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
        && (expected.expectedBlockerCategory === undefined || blockerCategories.has(expected.expectedBlockerCategory))
        && (expected.expectedWarningCategory === undefined || warningCategories.has(expected.expectedWarningCategory))
        && (expected.expectedBlockerCheckId === undefined || report.checks.some((check) => check.id === expected.expectedBlockerCheckId && check.status === 'block'))
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
        expectationMismatches++;
        console.log(`    expected=${expected.expectedVerdict}` +
          ` blockerCategory=${expected.expectedBlockerCategory ?? '-'} warningCategory=${expected.expectedWarningCategory ?? '-'} browser=${expected.expectedBrowserVerification ?? '-'}`);
        console.log(`    actual blockers=${[...blockerCategories].join(',') || '-'} warnings=${[...warningCategories].join(',') || '-'} browser=${report.browserVerification.status}`);
        for (const check of report.checks.filter((item) => item.status === 'block' || item.status === 'unknown')) {
          console.log(`    ${check.id}: ${check.summary}`);
        }
      }
    } catch (err: unknown) {
      executionErrors++;
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

  const precision = formatMetric(tp, tp + fp);
  const recall = formatMetric(tp, tp + fn);
  const sourceChanges = sourceTreeChanges();
  const startingTree = startingSourceChanges === undefined ? 'UNKNOWN' : startingSourceChanges.length > 0 ? 'DIRTY' : 'CLEAN';
  const sourceTree = sourceChanges === undefined ? 'UNKNOWN' : sourceChanges.length > 0 ? 'DIRTY' : 'CLEAN';

  console.log('');
  console.log(pc.bold('Benchmark Results:'));
  console.log(pc.dim('─'.repeat(45)));
  console.log(`  Source commit:         ${sourceSha()}`);
  console.log(`  Working tree (start):  ${startingTree}`);
  if (startingSourceChanges?.length) {
    for (const change of startingSourceChanges.slice(0, 20)) console.log(`    ${change}`);
    if (startingSourceChanges.length > 20) console.log(`    ... and ${startingSourceChanges.length - 20} more change(s)`);
  }
  console.log(`  Working tree (end):    ${sourceTree}`);
  if (sourceChanges?.length) {
    for (const change of sourceChanges.slice(0, 20)) console.log(`    ${change}`);
    if (sourceChanges.length > 20) console.log(`    ... and ${sourceChanges.length - 20} more change(s)`);
  }
  console.log(`  Platform / Node:       ${process.platform}/${process.arch} · ${process.version}`);
  console.log(`  Total Fixtures:        ${results.length}`);
  console.log(`  True Positives (TP):   ${pc.green(String(tp))}`);
  console.log(`  True Negatives (TN):   ${pc.green(String(tn))}`);
  console.log(`  False Positives (FP):  ${fp === 0 ? pc.green('0 (TARGET MET)') : pc.red(String(fp))}`);
  console.log(`  False Negatives (FN):  ${fn === 0 ? pc.green('0') : pc.yellow(String(fn))}`);
  console.log(`  Blocker Precision:     ${pc.green(precision)}`);
  console.log(`  Blocker Recall:        ${pc.green(recall)}`);
  console.log(`  Expectation Mismatches:${String(expectationMismatches).padStart(4, ' ')}`);
  console.log(`  Execution Errors:      ${String(executionErrors).padStart(4, ' ')}`);
  console.log(`  External Dependencies: ${pc.cyan(String(totalUnknowns))}`);
  console.log(`  Total Runtime:         ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(pc.dim('─'.repeat(45)));

  const sourceIntegrityFailure = mode === 'AUTHORITATIVE' && (startingTree !== 'CLEAN' || sourceTree !== 'CLEAN');
  if (fp > 0 || fn > 0 || expectationMismatches > 0 || executionErrors > 0 || sourceIntegrityFailure) {
    console.error(pc.bold(pc.red(`\nFAILED: ${fp} false blocker(s), ${fn} missed bug(s), ${expectationMismatches} expectation mismatch(es), ${executionErrors} execution error(s), source tree ${sourceTree}.`)));
    process.exitCode = 1;
  } else {
    console.log(pc.bold(pc.green(`\nPASSED: FP ${fp}, FN ${fn}, expectation mismatches ${expectationMismatches}, execution errors ${executionErrors}; precision ${precision}, recall ${recall}.`)));
    process.exitCode = 0;
  }
}

function sourceSha(): string {
  // GitHub's GITHUB_SHA for pull_request workflows identifies the synthetic
  // merge ref even when checkout is explicitly pinned to the submitted head.
  // Report the source actually tested; use CI metadata only outside a Git
  // checkout (for example, a packaged benchmark invocation).
  try {
    const current = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
    return /^[a-f0-9]{40,64}$/i.test(current) ? current : 'unavailable';
  } catch {
    const configured = process.env.GITHUB_SHA ?? process.env.GITHUB_COMMIT;
    return configured && /^[a-f0-9]{40,64}$/i.test(configured) ? configured : 'unavailable';
  }
}

function sourceTreeChanges(): string[] | undefined {
  try {
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });
    return parseGitPorcelainStatus(status);
  } catch {
    return undefined;
  }
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
