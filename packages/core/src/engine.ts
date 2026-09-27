import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  VerificationReport,
  VerificationReportSchema,
  ReleaseProofUserConfig,
  CheckResult,
  ReleaseProofConfigSchema,
} from '@releaseproof/schemas';
import { detectProject } from '@releaseproof/detector';
import { createCleanWorkspace, DEFAULT_EXCLUDES } from '@releaseproof/sandbox';
import { analyzeEnvironment } from '@releaseproof/environment';
import { scanForSecrets, redactObject } from '@releaseproof/security';
import { verifyBrowserApp } from '@releaseproof/browser';
import { execCommand } from '@releaseproof/runner';
import { resolveArtifactDirectory } from './artifact-path.js';
import { inspectPackageManagerPolicy } from './package-manager-policy.js';

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
  /** Relative to projectDir and restricted to .releaseproof/ and its descendants. */
  outputDir?: string;
  config?: ReleaseProofUserConfig;
  onProgress?: ProgressCallback;
  skipSandbox?: boolean;
  signal?: AbortSignal;
}

export async function verifyProject(options: EngineOptions): Promise<VerificationReport> {
  const startTime = Date.now();
  const requestedProjectDir = path.resolve(options.projectDir);
  // Validate the selected root before creating report folders or other output.
  const projectRoot = await fs.realpath(requestedProjectDir);
  const rootStat = await fs.stat(projectRoot);
  if (!rootStat.isDirectory()) throw new Error('Selected project path is not a directory.');
  let projectDir = projectRoot;
  const artifactsDir = await resolveArtifactDirectory(projectRoot, options.outputDir);
  const screenshotsDir = path.join(artifactsDir, 'screenshots');
  const signal = options.signal;
  const progress: ProgressCallback = options.onProgress ?? (() => {});

  throwIfAborted(signal);

  // Load local project config if present. A malformed config is user input,
  // not an instruction to silently fall back to defaults.
  let localConfig: ReleaseProofUserConfig = {};
  const configPath = path.join(projectDir, '.releaseproof.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    localConfig = JSON.parse(content) as ReleaseProofUserConfig;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw new Error(`Invalid .releaseproof.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const ignoreDirs: string[] = [
    '.releaseproof-venv',
    ...((localConfig.ignoreDirs || []).filter((d): d is string => Boolean(d))),
    ...((options.config?.ignoreDirs || []).filter((d): d is string => Boolean(d))),
  ];

  const mergedConfig: ReleaseProofUserConfig = {
    ...localConfig,
    ...options.config,
    checks: {
      ...localConfig.checks,
      ...options.config?.checks,
    },
    build: { ...localConfig.build, ...options.config?.build },
    start: { ...localConfig.start, ...options.config?.start },
    browser: { ...localConfig.browser, ...options.config?.browser },
    environment: { ...localConfig.environment, ...options.config?.environment },
    python: { ...localConfig.python, ...options.config?.python },
    criticalRoutes: options.config?.criticalRoutes ?? localConfig.criticalRoutes ?? [],
    ignoreDirs,
  };
  const config = ReleaseProofConfigSchema.parse(mergedConfig);

  if (config.target) {
    const resolvedTarget = path.resolve(projectRoot, config.target);
    const relativeTarget = path.relative(projectRoot, resolvedTarget);
    if (relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
      throw new Error(`Configured target escapes the project directory: ${config.target}`);
    }
    const canonicalTarget = await fs.realpath(resolvedTarget);
    const canonicalRelativeTarget = path.relative(projectRoot, canonicalTarget);
    if (canonicalRelativeTarget === '..' || canonicalRelativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelativeTarget)) {
      throw new Error(`Configured target escapes the project directory through a symlink: ${config.target}`);
    }
    if (!(await fs.stat(canonicalTarget)).isDirectory()) {
      throw new Error(`Configured target is not a directory: ${config.target}`);
    }
    projectDir = canonicalTarget;
  }

  // The request, config and selected target are now validated. Outputs may be
  // created only after those checks, so bad input cannot leave project files.
  throwIfAborted(signal);
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
  // Invalidate a previous run before execution; a process crash cannot leave an old READY report looking current.
  await fs.rm(path.join(artifactsDir, 'report-manifest.json'), { force: true });

  const allChecks: CheckResult[] = [];

  if (config.environment?.includeEnvFiles) {
    allChecks.push({
      id: 'environment-files-opt-in',
      title: 'Secret-bearing environment files explicitly included',
      category: 'security',
      status: 'warn',
      severity: 'medium',
      summary: 'Configuration explicitly opted into copying .env files into the verification workspace. Their provided values are not automatically discoverable for value-based redaction.',
      evidence: [],
      remediation: 'Prefer environment.provide for required values so ReleaseProof can register them for redaction.',
    });
  }

  // Phase 1: Detect Project Profile
  progress('Detecting project profile', 'running');
  const detectedProfile = await detectProject(projectDir);
  const managerPolicy = await inspectPackageManagerPolicy(
    projectDir,
    detectedProfile.languages,
    detectedProfile.packageManagers[0]?.type,
    config.packageManager,
  );
  const profile = managerPolicy.canExecute && managerPolicy.manager
    ? await detectProject(projectDir, managerPolicy.manager)
    : detectedProfile;
  allChecks.push(...managerPolicy.findings);
  progress(
    'Detecting project profile',
    'done',
    `${profile.frameworks.map((f) => f.name).join(', ') || 'Standard app'} (${profile.packageManagers[0]?.type || 'npm'})`
  );

  const primaryPackageManager = profile.packageManagers[0];
  if (managerPolicy.canExecute && profile.languages.some((language) => language === 'javascript' || language === 'typescript')) {
    allChecks.push({
      id: 'install-lockfile-policy',
      title: primaryPackageManager?.lockfile ? 'Lockfile-enforcing install selected' : 'Dependency lockfile not found',
      category: 'install',
      status: primaryPackageManager?.lockfile ? 'pass' : 'warn',
      severity: primaryPackageManager?.lockfile ? 'info' : 'medium',
      summary: primaryPackageManager?.lockfile
        ? `Detected ${primaryPackageManager.lockfile}; authoritative verification uses a lockfile-enforcing install command.`
        : 'No supported lockfile was detected, so dependency resolution cannot be fully reproducible.',
      evidence: [],
      remediation: primaryPackageManager?.lockfile ? undefined : 'Commit the package manager lockfile before release verification.',
    });
  }

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
  const copyExcludes = new Set(DEFAULT_EXCLUDES);
  if (config.environment?.includeEnvFiles) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.test', '.env.production', '.env.development.local', '.env.test.local', '.env.production.local']) {
      copyExcludes.delete(name);
    }
  }
  let workspace: { path: string; dispose: () => Promise<void> } = { path: projectDir, dispose: async () => {} };

  let runningService: any = null;
  let runStatus: VerificationReport['runStatus'] = 'completed';
  const cleanupErrors: string[] = [];
  let activePort = config.start?.port || profile.ports[0] || 3000;
  const browserDisabled = config.checks?.browser === false || config.browser?.enabled === false;
  let browserVerification: VerificationReport['browserVerification'] = browserDisabled
    ? { status: 'SKIPPED', reason: 'Browser verification was disabled by configuration.' }
    : !profile.capabilities.browser
      ? { status: 'SKIPPED', reason: 'API-only project: browser runtime verification is not applicable.' }
      : { status: 'UNAVAILABLE', reason: 'Browser verification was not reached.' };
  const allowHostEnv = config.environment?.allowHost ?? [];
  const providedEnvironment = config.environment?.provide ?? {};
  const sensitiveValues = [
    ...Object.values(providedEnvironment).filter((value): value is string => typeof value === 'string'),
    ...allowHostEnv.map((key) => process.env[key]).filter((value): value is string => Boolean(value)),
  ];
  if (config.environment?.includeEnvFiles) {
    sensitiveValues.push(...await loadSensitiveEnvFileValues(projectDir, config.environment.envFile));
  }
  let installCommand = profile.commands.install;
  let buildCommand = config.build?.command || profile.commands.build;
  let startCommand = config.start?.command || profile.commands.start;
  let executionEnvironment: Record<string, string | undefined> = { ...providedEnvironment };
  let pythonRuntimeDir: string | undefined;
  let pythonInterpreter: string | undefined;

  try {
    throwIfAborted(signal);
    progress('Creating isolated clean verification workspace', 'running');
    if (!options.skipSandbox) {
      workspace = await createCleanWorkspace(projectDir, { excludes: copyExcludes, signal });
    }
    throwIfAborted(signal);
    progress('Creating isolated clean verification workspace', 'done');
    pythonRuntimeDir = managerPolicy.canExecute && profile.languages.includes('python')
      ? path.join(workspace.path, '.releaseproof', `python-${randomBytes(6).toString('hex')}`)
      : undefined;

    if (managerPolicy.canExecute && profile.languages.includes('python') && (installCommand || buildCommand || startCommand)) {
      const prepared = await preparePythonExecution(workspace.path, pythonRuntimeDir!, { installCommand, buildCommand, startCommand }, executionEnvironment, allowHostEnv, config.python?.interpreter, signal);
      if (!prepared.ok) {
        allChecks.push({
          id: 'python-interpreter-setup',
          title: 'Isolated Python verification environment unavailable',
          category: 'install',
          status: 'unknown',
          severity: 'high',
          classification: 'VERIFICATION_UNAVAILABLE',
          summary: prepared.error,
          evidence: [],
        });
        throw new Error('Python verification environment unavailable.');
      }
      installCommand = prepared.installCommand;
      buildCommand = prepared.buildCommand;
      startCommand = prepared.startCommand;
      executionEnvironment = prepared.environment;
      pythonInterpreter = prepared.interpreter;
      allChecks.push({
        id: 'python-interpreter-setup',
        title: 'Isolated Python interpreter configured',
        category: 'install',
        status: 'pass',
        severity: 'info',
        summary: `Dependency installation and startup use the same workspace-local interpreter: ${prepared.interpreter}`,
        evidence: [],
      });
    }

    // Phase 4: Clean Install
    if (managerPolicy.canExecute && config.checks?.install !== false && installCommand) {
      progress('Running clean installation', 'running', installCommand);
      const installRes = await runInstallCheck(workspace.path, installCommand, executionEnvironment, allowHostEnv, signal);
      allChecks.push(installRes);
      progress('Running clean installation', installRes.status === 'block' ? 'fail' : 'done');

      // Build/start results are not meaningful when their dependency install did not complete.
      if (installRes.status === 'block') {
        throw new Error('Installation failed in clean environment.');
      }
      if (installRes.status === 'unknown') {
        if (!browserDisabled && profile.capabilities.browser) {
          browserVerification = {
            status: 'UNAVAILABLE',
            reason: 'Browser verification was not attempted because dependency installation could not be verified.',
          };
        }
        throw new Error('Installation could not be verified in the current environment.');
      }
    }

    // Phase 5: Production Build
    const buildCmd = buildCommand;
    if (managerPolicy.canExecute && config.checks?.build !== false && buildCmd) {
      progress('Running production build', 'running', buildCmd);
      const buildRes = await runBuildCheck(workspace.path, buildCmd, executionEnvironment, allowHostEnv, signal);
      allChecks.push(buildRes);
      progress('Running production build', buildRes.status === 'block' ? 'fail' : 'done');

      if (buildRes.status === 'block') {
        throw new Error('Production build failed.');
      }
      if (buildRes.status === 'unknown') {
        if (!browserDisabled && profile.capabilities.browser) {
          browserVerification = {
            status: 'UNAVAILABLE',
            reason: 'Browser verification was not attempted because the production build could not be verified.',
          };
        }
        throw new Error('Production build could not be verified in the current environment.');
      }
    }

    // Phase 6: Production Startup & Health Check
    const startCmd = startCommand;
    if (managerPolicy.canExecute && config.checks?.startup !== false && startCmd) {
      progress('Starting production server', 'running', `port ${activePort}`);
      const startupRes = await runStartupCheck(
        workspace.path,
        startCmd,
        activePort,
        config.start?.timeoutMs ?? 30000,
        config.start?.healthCheckPath ?? '/',
        config.start?.stabilityWindowMs ?? 5000,
        executionEnvironment,
        allowHostEnv,
        signal
      );

      allChecks.push(startupRes.checkResult);
      runningService = startupRes.service;
      if (startupRes.port) activePort = startupRes.port;

      const startedOk = startupRes.checkResult.status === 'pass';
      progress('Starting production server', startedOk ? 'done' : 'fail');

      // Phase 7: Browser / Route Verification
      if (startedOk && config.checks?.browser !== false && config.browser?.enabled !== false) {
        progress('Verifying application in browser', 'running');
        const browserRes = await verifyBrowserApp({
          baseUrl: `http://127.0.0.1:${activePort}`,
          initialRoutes: Array.from(new Set([
            ...(profile.entrypoints.length > 0 ? profile.entrypoints : ['/']),
            ...(config.criticalRoutes ?? []),
          ])),
          maxPages: config.browser?.maxPages ?? 15,
          maxDepth: config.browser?.maxDepth ?? 3,
          screenshotsDir,
          headless: config.browser?.headless ?? true,
          timeoutMs: config.browser?.timeoutMs ?? 15000,
          observationWindowMs: config.browser?.observationWindowMs ?? 2000,
          requiresBrowserRuntime: profile.capabilities.browser,
          signal,
        });

        allChecks.push(...browserRes.checks);
        browserVerification = {
          status: browserRes.capabilityStatus,
          ...(browserRes.capabilityReason ? { reason: browserRes.capabilityReason } : {}),
        };
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
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      runStatus = 'cancelled';
    } else {
    const isExpectedShortCircuit =
      err instanceof Error &&
      (err.message.includes('failed in clean environment') ||
        err.message.includes('could not be verified in the current environment') ||
        err.message.includes('build failed') ||
        err.message.includes('Python verification environment unavailable'));

    if (!isExpectedShortCircuit) {
      runStatus = 'internal_error';
      allChecks.push({
        id: 'engine-unexpected-error',
        title: 'Verification engine pipeline error',
        category: 'runtime',
        status: 'unknown',
        severity: 'high',
        classification: 'RELEASEPROOF_INTERNAL_ERROR',
        summary: `Pipeline encountered an unexpected runtime failure: ${err instanceof Error ? err.message : String(err)}`,
        evidence: [],
      });
    }
    }
  } finally {
    if (runningService) {
      try {
        await runningService.kill();
      } catch {}
    }
    if (pythonRuntimeDir) {
      try {
        await fs.rm(pythonRuntimeDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch (cleanupError: unknown) {
        cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
        allChecks.push({
          id: 'python-runtime-cleanup-error',
          title: 'Python runtime cleanup failed',
          category: 'security',
          status: 'unknown',
          severity: 'high',
          classification: 'RELEASEPROOF_INTERNAL_ERROR',
          summary: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          evidence: [],
        });
      }
    }
    try {
      await workspace.dispose();
    } catch (cleanupError: unknown) {
      cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      allChecks.push({
        id: 'workspace-cleanup-error',
        title: 'Temporary workspace cleanup failed',
        category: 'security',
        status: 'unknown',
        severity: 'high',
        classification: 'RELEASEPROOF_INTERNAL_ERROR',
        summary: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        evidence: [],
      });
    }
  }

  // Static checks alone cannot establish that an application actually runs.
  // In particular, a monorepo root with no detected executable target must
  // not become READY merely because its README and secret scan pass.
  const hasRuntimeEvidence = allChecks.some((check) =>
    check.status === 'pass' &&
    (check.id === 'startup-check' || check.id === 'browser-routes-verified')
  );
  if (!hasRuntimeEvidence && !allChecks.some((check) => check.status === 'block' || check.status === 'unknown')) {
    allChecks.push({
      id: 'runtime-evidence-missing',
      title: 'Runnable application target was not verified',
      category: 'runtime',
      status: 'unknown',
      severity: 'medium',
      classification: 'VERIFICATION_UNAVAILABLE',
      summary: 'No successful application startup or route verification was observed. For monorepos, select the runnable subproject or configure its start command.',
      evidence: [],
    });
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
    schemaVersion: '1.0.0',
    id: reportId,
    version: '0.2.0-dev.0',
    runStatus,
    timestamp: new Date().toISOString(),
    projectName: profile.name,
    projectPath: relProjectPath,
    target: { path: config.target ?? '.', kind: config.target ? 'nested' : 'root' },
    profile: {
      ...profile,
      root: relProjectPath,
    },
    verdict: runStatus === 'cancelled' ? 'CANCELLED' : scoreResult.verdict,
    score: runStatus === 'cancelled' ? 0 : scoreResult.score,
    evidenceCoverage: scoreResult.evidenceCoverage,
    categoryScores: scoreResult.categoryScores,
    counts: scoreResult.counts,
    checks: allChecks,
    browserVerification,
    capabilities: buildCapabilitySummary(allChecks, browserVerification, profile.capabilities),
    cleanup: {
      status: runStatus === 'cancelled' ? 'cancelled' : cleanupErrors.length > 0 ? 'failed' : 'clean',
      errors: cleanupErrors,
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      ...(pythonInterpreter ? { pythonInterpreter } : {}),
      hostEnvironmentPolicy: allowHostEnv.length > 0 ? 'explicit' : 'minimal',
    },
    timings: { totalMs: durationMs },
    limitations: [
      ...(browserVerification.status === 'UNAVAILABLE' ? ['Browser capability was unavailable; client-side behavior is not proven.'] : []),
      ...(profile.targetCandidates.length > 1 ? ['Multiple project targets were detected; verification covers only the selected target.'] : []),
    ],
    durationMs,
    artifactsDir: relArtifactsDir,
    jsonReportPath: relJsonPath,
    htmlReportPath: relHtmlPath,
    fixPromptPath: relFixPath,
  };

  const report = VerificationReportSchema.parse(redactObject(rawReport, sensitiveValues));

  return report;
}

function buildCapabilitySummary(
  checks: CheckResult[],
  browserVerification: VerificationReport['browserVerification'],
  profileCapabilities: { browser: boolean; api: boolean; docker: boolean },
): Record<string, { status: 'verified' | 'unavailable' | 'failed' | 'skipped' | 'not_applicable'; reason?: string }> {
  const statusFor = (category: CheckResult['category']) => {
    const relevant = checks.filter((check) => check.category === category);
    if (relevant.some((check) => check.status === 'block')) return { status: 'failed' as const };
    if (relevant.some((check) => check.status === 'unknown')) {
      const reason = relevant.find((check) => check.status === 'unknown')?.summary;
      return { status: 'unavailable' as const, ...(reason ? { reason } : {}) };
    }
    if (relevant.some((check) => check.status === 'pass' || check.status === 'warn')) return { status: 'verified' as const };
    return { status: 'skipped' as const };
  };

  return {
    install: statusFor('install'),
    build: statusFor('build'),
    runtime: statusFor('runtime'),
    http: statusFor('api'),
    routes: statusFor('api'),
    browser: profileCapabilities.browser
      ? browserVerification.status === 'VERIFIED'
        ? { status: 'verified' }
        : browserVerification.status === 'SKIPPED'
          ? { status: 'skipped', reason: browserVerification.reason }
          : { status: 'unavailable', reason: browserVerification.reason }
      : { status: 'not_applicable', reason: 'The detected target does not require a browser runtime.' },
    environment: statusFor('environment'),
    documentation: statusFor('documentation'),
    security: statusFor('security'),
    api: profileCapabilities.api ? statusFor('api') : { status: 'not_applicable', reason: 'No API capability was detected.' },
  };
}

interface PythonCommands {
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
}

async function preparePythonExecution(
  workspaceDir: string,
  venvDir: string,
  commands: PythonCommands,
  baseEnvironment: Record<string, string | undefined>,
  allowHostEnv: string[],
  explicitInterpreter?: string,
  signal?: AbortSignal
): Promise<(PythonCommands & { ok: true; interpreter: string; environment: Record<string, string | undefined> }) | { ok: false; error: string }> {
  const candidates = explicitInterpreter
    ? [JSON.stringify(path.resolve(explicitInterpreter))]
    // Prefer the interpreter selected by the host/toolchain (for example
    // actions/setup-python) before the Windows launcher. Some developer
    // machines expose an MSYS `python.exe` without pip; fall through to
    // common Windows Store aliases rather than getting stuck on it.
    : process.platform === 'win32'
      ? [
          'python', 'py -3', 'python3.13', 'python3.12', 'python3.11',
          ...(process.env.LOCALAPPDATA
            ? [path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'python.exe')]
            : []),
        ]
      : ['python3', 'python'];
  let lastError = 'No Python interpreter candidate succeeded.';

  for (const candidate of candidates) {
    const interpreterProbe = await execCommand(`${candidate} -c "import sys; print(sys.executable)"`, {
      cwd: workspaceDir,
      timeoutMs: 10000,
      env: baseEnvironment,
      allowHostEnv,
      signal,
    });
    if (interpreterProbe.exitCode !== 0) {
      lastError = `${candidate} is not runnable: ${interpreterProbe.stderr.trim() || interpreterProbe.stdout.trim() || `exit ${interpreterProbe.exitCode}`}`;
      continue;
    }
    const pipProbe = await execCommand(`${candidate} -m pip --version`, {
      cwd: workspaceDir,
      timeoutMs: 15000,
      env: baseEnvironment,
      allowHostEnv,
      signal,
    });
    if (pipProbe.exitCode !== 0) {
      lastError = `${candidate} does not provide pip: ${pipProbe.stderr.trim() || pipProbe.stdout.trim() || `exit ${pipProbe.exitCode}`}`;
      continue;
    }
    const result = await execCommand(`${candidate} -m venv ${JSON.stringify(venvDir)}`, {
      cwd: workspaceDir,
      timeoutMs: 120000,
      env: baseEnvironment,
      allowHostEnv,
      signal,
    });
    if (result.exitCode === 0) {
      const interpreterCandidates = process.platform === 'win32'
        ? [path.join(venvDir, 'Scripts/python.exe'), path.join(venvDir, 'bin/python.exe'), path.join(venvDir, 'bin/python')]
        : [path.join(venvDir, 'bin/python')];
      let resolvedInterpreter: string | undefined;
      for (const candidatePath of interpreterCandidates) {
        try {
          await fs.access(candidatePath);
          resolvedInterpreter = candidatePath;
          break;
        } catch {}
      }
      if (!resolvedInterpreter) {
        lastError = `${candidate} created a virtual environment without a usable interpreter.`;
        continue;
      }
      const pipProbe = await execCommand(`${JSON.stringify(resolvedInterpreter)} -m pip --version`, {
        cwd: workspaceDir,
        timeoutMs: 30000,
        env: baseEnvironment,
        allowHostEnv,
        signal,
      });
      if (pipProbe.exitCode !== 0) {
        await fs.rm(venvDir, { recursive: true, force: true }).catch(() => {});
        lastError = `${candidate} created a virtual environment whose pip is unusable: ${pipProbe.stderr.trim() || pipProbe.stdout.trim() || `exit ${pipProbe.exitCode}`}`;
        continue;
      }
      const binDir = path.dirname(resolvedInterpreter);
      const environment = {
        ...baseEnvironment,
        VIRTUAL_ENV: venvDir,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      };
      const quote = JSON.stringify(resolvedInterpreter);
      const rewrite = (command?: string) => {
        if (!command) return command;
        if (/^uv\s+sync\b/i.test(command)) return command;
        if (/^uv\s+pip\s+install\b/i.test(command)) {
          return command.replace(/^uv\s+pip\s+install\b/i, `uv pip install --python ${quote}`);
        }
        if (/^(?:python|python3|py\s+-3)\s+-m\s+pip\s+/i.test(command)) {
          return command.replace(/^(?:python|python3|py\s+-3)\s+-m\s+pip/i, `${quote} -m pip`);
        }
        if (/^(?:pip|pip3|uv\s+pip)\s+/i.test(command)) {
          return command.replace(/^(?:pip|pip3|uv\s+pip)/i, `${quote} -m pip`);
        }
        return command.replace(/^(?:python|python3|py\s+-3)\b/i, quote);
      };
      return {
        ok: true,
        interpreter: resolvedInterpreter,
        environment,
        installCommand: rewrite(commands.installCommand),
        buildCommand: rewrite(commands.buildCommand),
        startCommand: rewrite(commands.startCommand),
      };
    }
    lastError = result.stderr.trim() || result.stdout.trim() || `${candidate} exited with ${result.exitCode}`;
    await fs.rm(venvDir, { recursive: true, force: true }).catch(() => {});
  }

  return { ok: false, error: `Could not create workspace-local Python virtual environment: ${lastError}` };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Verification was cancelled.');
  error.name = 'AbortError';
  throw error;
}

async function loadSensitiveEnvFileValues(projectDir: string, configuredFile?: string): Promise<string[]> {
  const names = configuredFile
    ? [configuredFile]
    : ['.env', '.env.local', '.env.development', '.env.test', '.env.production', '.env.development.local', '.env.test.local', '.env.production.local'];
  const values: string[] = [];
  for (const name of names) {
    try {
      const content = await fs.readFile(path.resolve(projectDir, name), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
        const value = match?.[1] ?? match?.[2] ?? match?.[3]?.trim();
        if (value && value.length >= 4) values.push(value);
      }
    } catch {}
  }
  return values;
}
