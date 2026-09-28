import { CheckResult, ProcessEvidence, HttpEvidence } from '@releaseproof/schemas';
import {
  spawnService,
  RunningService,
  checkHealthEndpoint,
  isPortListening,
} from '@releaseproof/runner';
import { detectExternalServiceDependency, detectMissingRequiredEnvironment } from './external-services.js';

export interface StartupCheckResult {
  checkResult: CheckResult;
  service?: RunningService;
  port?: number;
}

export async function runStartupCheck(
  workspaceDir: string,
  startCommand?: string,
  port = 3000,
  timeoutMs = 30000,
  healthPath = '/',
  stabilityWindowMs = 5000,
  environment: Record<string, string | undefined> = {},
  allowHostEnv: string[] = [],
  signal?: AbortSignal
): Promise<StartupCheckResult> {
  if (!startCommand) {
    return {
      checkResult: {
        id: 'startup-check',
        title: 'Production startup',
        category: 'runtime',
        status: 'skipped',
        severity: 'info',
        summary: 'No start command configured.',
        evidence: [],
      },
    };
  }

  // A listener that predates this run cannot be used as target evidence.
  if (await isPortListening(port, '127.0.0.1', 200)) {
    return {
      checkResult: {
        id: 'startup-port-occupied',
        title: 'Verification port was already occupied',
        category: 'runtime',
        status: 'unknown',
        severity: 'medium',
        classification: 'VERIFICATION_UNAVAILABLE',
        summary: `Port ${port} was accepting connections before the target was started. The existing listener was not killed or used as application evidence.`,
        evidence: [],
        remediation: 'Stop the unrelated listener or configure a free port and run verification again.',
      },
    };
  }

  const service = spawnService(startCommand, {
    cwd: workspaceDir,
    env: { ...environment, PORT: String(port) },
    allowHostEnv,
    signal,
  });

  const isReady = await service.waitForPort(port, timeoutMs);

  if (signal?.aborted || service.aborted()) {
    await service.kill();
    const cancelled = new Error('Application startup verification was cancelled.');
    cancelled.name = 'AbortError';
    throw cancelled;
  }

  if (!isReady && service.isAlive()) {
    // On Windows the spawned npm.cmd/cmd.exe wrapper can briefly outlive an
    // immediately exiting project process. Observe a small bounded grace
    // window before deciding that the startup command is still genuinely
    // running and therefore unverifiable rather than crashed.
    const graceUntil = Date.now() + 750;
    while (service.isAlive() && Date.now() < graceUntil) {
      if (signal?.aborted || service.aborted()) {
        await service.kill();
        const cancelled = new Error('Application startup verification was cancelled.');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  if (!isReady) {
    const logs = service.getLogs();
    const alive = service.isAlive();
    await service.kill();

    const evidence: ProcessEvidence = {
      type: 'process',
      pid: service.pid,
      alive,
      port,
      listening: false,
      stdoutTail: logs.stdout.slice(-2000),
      stderrTail: logs.stderr.slice(-2000),
    };

    const combinedLogs = `${logs.stdout}\n${logs.stderr}`;
    if (detectMissingRequiredEnvironment(combinedLogs)) {
      return {
        checkResult: {
          id: 'startup-check',
          title: 'Required application environment was unavailable during startup',
          category: 'runtime',
          status: 'unknown',
          severity: 'medium',
          summary: 'The application rejected missing required environment values, so runtime startup could not be verified.',
          evidence: [evidence],
          remediation: 'Provide disposable verification values for the required variables and retry.',
          classification: 'VERIFICATION_UNAVAILABLE',
        },
      };
    }
    const extDep = detectExternalServiceDependency(combinedLogs);

    if (extDep) {
      return {
        checkResult: {
          id: 'startup-check',
          title: `Verification incomplete: ${extDep.name} required`,
          category: 'runtime',
          status: 'unknown',
          severity: 'medium',
          summary: `${extDep.reason} ReleaseProof could not verify runtime startup because external infrastructure was not configured.`,
          evidence: [evidence],
          remediation: extDep.remediation,
          metadata: {
            requiresExternalService: true,
            service: extDep.name,
          },
          classification: 'EXTERNAL_DEPENDENCY_UNAVAILABLE',
        },
      };
    }

    return {
      checkResult: {
        id: 'startup-check',
        title: alive ? 'Startup did not become observable before the verification timeout' : 'Production server crashed during startup',
        category: 'runtime',
        status: alive ? 'unknown' : 'block',
        severity: alive ? 'medium' : 'blocker',
        summary: alive
          ? `The startup process remained alive, but port ${port} did not become ready within ${timeoutMs / 1000}s. Available evidence does not establish whether startup is slow, waiting on external infrastructure, or misconfigured.`
          : `Server crashed immediately on startup. Process exited before port ${port} opened.`,
        evidence: [evidence],
        remediation: alive
          ? 'Inspect the bounded process logs and external service availability, then retry with an appropriate startup timeout.'
          : 'Check startup logs for runtime errors, missing environment variables, or uncaught exceptions during boot.',
        classification: alive ? 'VERIFICATION_UNAVAILABLE' : 'APPLICATION_FAILURE',
      },
    };
  }

  // Port is listening, check HTTP health
  const healthUrl = `http://127.0.0.1:${port}${healthPath}`;
  const health = await checkHealthEndpoint(healthUrl, 5000);

  const logs = service.getLogs();
  const procEvidence: ProcessEvidence = {
    type: 'process',
    pid: service.pid,
    alive: service.isAlive(),
    port,
    listening: true,
    stdoutTail: logs.stdout.slice(-1000),
  };

  const httpEvidence: HttpEvidence = {
    type: 'http',
    url: healthUrl,
    method: 'GET',
    statusCode: health.status,
    responsePreview: health.body.slice(0, 300),
    durationMs: health.durationMs,
  };

  if (!health.ok && health.status >= 500) {
    const combinedOutput = `${logs.stdout}\n${logs.stderr}\n${health.body}`;
    if (detectMissingRequiredEnvironment(combinedOutput)) {
      return {
        service,
        port,
        checkResult: {
          id: 'startup-check',
          title: 'Required application environment was unavailable during startup',
          category: 'runtime',
          status: 'unknown',
          severity: 'medium',
          summary: `Root route returned HTTP ${health.status} while required project environment values were missing.`,
          evidence: [procEvidence, httpEvidence],
          remediation: 'Provide disposable verification values for the required variables and retry.',
          classification: 'VERIFICATION_UNAVAILABLE',
        },
      };
    }
    const extDep = detectExternalServiceDependency(combinedOutput);

    if (extDep) {
      return {
        service,
        port,
        checkResult: {
          id: 'startup-check',
          title: `Verification incomplete: ${extDep.name} required`,
          category: 'runtime',
          status: 'unknown',
          severity: 'medium',
          summary: `Root route returned HTTP ${health.status} due to missing external infrastructure (${extDep.name}). ReleaseProof could not verify runtime health.`,
          evidence: [procEvidence, httpEvidence],
          remediation: extDep.remediation,
          metadata: {
            requiresExternalService: true,
            service: extDep.name,
          },
          classification: 'EXTERNAL_DEPENDENCY_UNAVAILABLE',
        },
      };
    }

    return {
      service,
      port,
      checkResult: {
        id: 'startup-check',
        title: 'Production server responded with server error on startup',
        category: 'runtime',
        status: 'block',
        severity: 'blocker',
        summary: `Application started on port ${port} but initial request to ${healthPath} failed with HTTP ${health.status}.`,
        evidence: [procEvidence, httpEvidence],
        remediation: 'Inspect server logs for unhandled exceptions or database connection failures during root route handling.',
        classification: 'APPLICATION_FAILURE',
      },
    };
  }

  // A single successful response is not sufficient: observe both ownership process
  // and HTTP health for a bounded stability window.
  const stabilityStarted = Date.now();
  let lastHealth = health;
  while (Date.now() - stabilityStarted < stabilityWindowMs) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(500, Math.max(50, stabilityWindowMs))));
    if (signal?.aborted || service.aborted()) {
      await service.kill();
      const cancelled = new Error('Application stability verification was cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    if (!service.isAlive()) {
      const crashedLogs = service.getLogs();
      await service.kill();
      return {
        checkResult: {
          id: 'startup-stability',
          title: 'Production server crashed during stability observation',
          category: 'runtime',
          status: 'block',
          severity: 'blocker',
          classification: 'APPLICATION_FAILURE',
          summary: `Application exited within the ${stabilityWindowMs}ms startup stability window.`,
          evidence: [{ ...procEvidence, alive: false, stdoutTail: crashedLogs.stdout.slice(-1000), stderrTail: crashedLogs.stderr.slice(-2000) }],
          remediation: 'Inspect the process logs and fix delayed startup/background-task failures.',
        },
      };
    }
    lastHealth = await checkHealthEndpoint(healthUrl, Math.min(2000, Math.max(250, timeoutMs)));
    if (!lastHealth.ok && (lastHealth.status === 0 || lastHealth.status >= 500)) {
      const unstableLogs = service.getLogs();
      const extDep = detectExternalServiceDependency(`${unstableLogs.stdout}\n${unstableLogs.stderr}\n${lastHealth.body}`);
      if (extDep) {
        await service.kill();
        return {
          checkResult: {
            id: 'startup-stability',
            title: `Verification incomplete: ${extDep.name} required during stability observation`,
            category: 'runtime',
            status: 'unknown',
            severity: 'medium',
            classification: 'EXTERNAL_DEPENDENCY_UNAVAILABLE',
            summary: `${extDep.reason} Runtime health could not be confirmed during the stability window.`,
            evidence: [procEvidence, { ...httpEvidence, statusCode: lastHealth.status, responsePreview: lastHealth.body.slice(0, 300) }],
            remediation: extDep.remediation,
          },
        };
      }
      if (lastHealth.status === 0 && /timed out/i.test(lastHealth.body) && service.isAlive()) {
        await service.kill();
        return {
          checkResult: {
            id: 'startup-stability',
            title: 'Runtime health timed out during stability observation',
            category: 'runtime',
            status: 'unknown',
            severity: 'medium',
            classification: 'VERIFICATION_UNAVAILABLE',
            summary: `The live process stopped answering HTTP within the ${stabilityWindowMs}ms stability window; the cause could not be determined from available evidence.`,
            evidence: [procEvidence, { ...httpEvidence, statusCode: lastHealth.status, responsePreview: lastHealth.body.slice(0, 300) }],
            remediation: 'Inspect application logs and external service availability, then retry verification.',
          },
        };
      }
      await service.kill();
      return {
        checkResult: {
          id: 'startup-stability',
          title: 'Production server became unhealthy during stability observation',
          category: 'runtime',
          status: 'block',
          severity: 'blocker',
          classification: 'APPLICATION_FAILURE',
          summary: `Application health changed to HTTP ${lastHealth.status} within the ${stabilityWindowMs}ms stability window.`,
          evidence: [procEvidence, { ...httpEvidence, statusCode: lastHealth.status, responsePreview: lastHealth.body.slice(0, 300) }],
        },
      };
    }
  }

  return {
    service,
    port,
    checkResult: {
      id: 'startup-check',
      title: 'Production server started and responded',
      category: 'runtime',
      status: 'pass',
      severity: 'info',
      summary: `Application started on port ${port}, responded with HTTP ${lastHealth.status}, and remained stable for ${stabilityWindowMs}ms.`,
      evidence: [procEvidence, httpEvidence],
    },
  };
}
