import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  VerificationReport,
  ReleaseProofUserConfig,
  CheckResult,
} from '@releaseproof/schemas';
import { detectProject } from '@releaseproof/detector';
import { createCleanWorkspace } from '@releaseproof/sandbox';
import { analyzeEnvironment } from '@releaseproof/environment';
import { scanForSecrets, redactObject } from '@releaseproof/security';
import { verifyBrowserApp } from '@releaseproof/browser';
import { killPortProcess } from '@releaseproof/runner';

import { runInstallCheck } from './checks/install.js';
import { runBuildCheck } from './checks/build.js';
import { runStartupCheck } from './checks/startup.js';
import { runDevVsProdCheck } from './checks/dev-prod.js';
import { runReadmeContractCheck } from './checks/readme.js';
import { computeScore } from './scoring.js';

export interface ProgressCallback {
  (step: string, status: 'running' | 'done' | 'fail', message?: string): void;
}

export interface EngineOptions {
  projectDir: string;
  config?: ReleaseProofUserConfig;
  onProgress?: ProgressCallback;
  skipSandbox?: boolean;
}

export async function verifyProject(options: EngineOptions): Promise<VerificationReport> {
  const startTime = Date.now();
  const projectDir = path.resolve(options.projectDir);
  const artifactsDir = path.join(projectDir, '.releaseproof');
  const screenshotsDir = path.join(artifactsDir, 'screenshots');
  const progress: ProgressCallback = options.onProgress ?? (() => {});

  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Load local project config if present
  let localConfig: ReleaseProofUserConfig = {};
  try {
    const configPath = path.join(projectDir, '.releaseproof.json');
    const content = await fs.readFile(configPath, 'utf-8');
    localConfig = JSON.parse(content);
  } catch {}

  const ignoreDirs: string[] = [
    ...((localConfig.ignoreDirs || []).filter((d): d is string => Boolean(d))),
    ...((options.config?.ignoreDirs || []).filter((d): d is string => Boolean(d))),
  ];

  const config: ReleaseProofUserConfig = {
    ...localConfig,
    ...options.config,
    checks: {
      ...localConfig.checks,
      ...options.config?.checks,
    },
    ignoreDirs,
  };

  const allChecks: CheckResult[] = [];

  // Phase 1: Detect Project Profile
  progress('Detecting project profile', 'running');
  const profile = await detectProject(projectDir);
  progress(
    'Detecting project profile',
    'done',
    `${profile.frameworks.map((f) => f.name).join(', ') || 'Standard app'} (${profile.packageManagers[0]?.type || 'npm'})`
  );

  // Phase 2: Static Security & Environment Scans (on original source)
  if (config.checks?.secrets !== false) {
    progress('Scanning for exposed secrets', 'running');
    const secChecks = await scanForSecrets(projectDir, ignoreDirs);
    allChecks.push(...secChecks);
    const secHasIssues = secChecks.some((c) => c.status === 'block');
    progress('Scanning for exposed secrets', secHasIssues ? 'fail' : 'done');
  }

  if (config.checks?.environment !== false) {
    progress('Analyzing environment configuration', 'running');
    const envChecks = await analyzeEnvironment(projectDir, ignoreDirs);
    allChecks.push(...envChecks);
    const envHasIssues = envChecks.some((c) => c.status === 'block');
    progress('Analyzing environment configuration', envHasIssues ? 'fail' : 'done');
  }

  // Dev vs Prod dependency mismatch check
  if (config.checks?.devProd !== false) {
    const devProdCheck = await runDevVsProdCheck(projectDir);
    if (devProdCheck) {
      allChecks.push(devProdCheck);
    }
  }

  // Phase 3: Setup Clean Environment
  progress('Creating clean-room sandbox', 'running');
  const workspace = options.skipSandbox
    ? { path: projectDir, dispose: async () => {} }
    : await createCleanWorkspace(projectDir);
  progress('Creating clean-room sandbox', 'done');

  let runningService: any = null;
  let activePort = config.start?.port || profile.ports[0] || 3000;

  const onSignal = async () => {
    if (runningService) {
      try { await runningService.kill(); } catch {}
    }
    try { await workspace.dispose(); } catch {}
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    // Phase 4: Clean Install
    if (config.checks?.install !== false && profile.commands.install) {
      progress('Running clean installation', 'running', profile.commands.install);
      const installRes = await runInstallCheck(workspace.path, profile.commands.install);
      allChecks.push(installRes);
      progress('Running clean installation', installRes.status === 'block' ? 'fail' : 'done');

      // If install completely blocked, do not try to build or start
      if (installRes.status === 'block') {
        throw new Error('Installation failed in clean environment.');
      }
    }

    // Phase 5: Production Build
    const buildCmd = config.build?.command || profile.commands.build;
    if (config.checks?.build !== false && buildCmd) {
      progress('Running production build', 'running', buildCmd);
      const buildRes = await runBuildCheck(workspace.path, buildCmd);
      allChecks.push(buildRes);
      progress('Running production build', buildRes.status === 'block' ? 'fail' : 'done');

      if (buildRes.status === 'block') {
        throw new Error('Production build failed.');
      }
    }

    // Phase 6: Production Startup & Health Check
    const startCmd = config.start?.command || profile.commands.start;
    if (config.checks?.startup !== false && startCmd) {
      progress('Starting production server', 'running', `port ${activePort}`);
      const startupRes = await runStartupCheck(
        workspace.path,
        startCmd,
        activePort,
        config.start?.timeoutMs ?? 30000,
        config.start?.healthCheckPath ?? '/'
      );

      allChecks.push(startupRes.checkResult);
      runningService = startupRes.service;
      if (startupRes.port) activePort = startupRes.port;

      const startedOk = startupRes.checkResult.status === 'pass';
      progress('Starting production server', startedOk ? 'done' : 'fail');

      // Phase 7: Browser / Route Verification
      if (startedOk && config.checks?.browser !== false) {
        progress('Verifying application in browser', 'running');
        const browserRes = await verifyBrowserApp({
          baseUrl: `http://127.0.0.1:${activePort}`,
          initialRoutes: profile.entrypoints.length > 0 ? profile.entrypoints : ['/'],
          maxPages: config.browser?.maxPages ?? 15,
          maxDepth: config.browser?.maxDepth ?? 3,
          screenshotsDir,
          headless: config.browser?.headless ?? true,
        });

        allChecks.push(...browserRes.checks);
        const browserHasErrors = browserRes.checks.some((c) => c.status === 'block');
        progress('Verifying application in browser', browserHasErrors ? 'fail' : 'done', `${browserRes.pagesVisited} route(s) checked`);
      }
    }

    // Phase 8: README as contract
    if (config.checks?.documentation !== false) {
      progress('Checking README as contract', 'running');
      const readmeChecks = await runReadmeContractCheck(projectDir, activePort);
      allChecks.push(...readmeChecks);
      progress('Checking README as contract', 'done');
    }
  } catch (err: unknown) {
    const isExpectedShortCircuit =
      err instanceof Error &&
      (err.message.includes('failed in clean environment') || err.message.includes('build failed'));

    if (!isExpectedShortCircuit) {
      allChecks.push({
        id: 'engine-unexpected-error',
        title: 'Verification engine pipeline error',
        category: 'runtime',
        status: 'block',
        severity: 'blocker',
        summary: `Pipeline encountered an unexpected runtime failure: ${err instanceof Error ? err.message : String(err)}`,
        evidence: [],
      });
    }
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (runningService) {
      try {
        await runningService.kill();
      } catch {}
    }
    if (activePort) {
      try {
        await killPortProcess(activePort);
      } catch {}
    }
    await workspace.dispose();
  }

  // Phase 9: Scoring & Report Compilation
  const scoreResult = computeScore(allChecks);
  const durationMs = Date.now() - startTime;
  const reportId = randomBytes(6).toString('hex');
  const relProjectPath = (path.relative(process.cwd(), projectDir) || '.').replace(/\\/g, '/');
  const relArtifactsDir = (path.relative(process.cwd(), artifactsDir) || '.releaseproof').replace(/\\/g, '/');
  const relJsonPath = path.posix.join(relArtifactsDir, 'report.json');
  const relHtmlPath = path.posix.join(relArtifactsDir, 'report.html');
  const relFixPath = path.posix.join(relArtifactsDir, 'RELEASEPROOF_FIX.md');

  const rawReport: VerificationReport = {
    id: reportId,
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    projectName: profile.name,
    projectPath: relProjectPath,
    profile: {
      ...profile,
      root: relProjectPath,
    },
    verdict: scoreResult.verdict,
    score: scoreResult.score,
    categoryScores: scoreResult.categoryScores,
    counts: scoreResult.counts,
    checks: allChecks,
    durationMs,
    artifactsDir: relArtifactsDir,
    jsonReportPath: relJsonPath,
    htmlReportPath: relHtmlPath,
    fixPromptPath: relFixPath,
  };

  const report = redactObject(rawReport);

  // Save JSON report using absolute path on disk
  const absoluteJsonPath = path.join(artifactsDir, 'report.json');
  await fs.writeFile(absoluteJsonPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}
