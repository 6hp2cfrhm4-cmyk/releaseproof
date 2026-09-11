import { CheckResult, ProcessEvidence, HttpEvidence } from '@releaseproof/schemas';
import {
  spawnService,
  RunningService,
  checkHealthEndpoint,
  isPortListening,
  waitForPortClose,
} from '@releaseproof/runner';
import { detectExternalServiceDependency } from './external-services.js';

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
  healthPath = '/'
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

  // Ensure port is not lingering in CLOSE_WAIT before spawning
  if (await isPortListening(port, '127.0.0.1', 200)) {
    await waitForPortClose(port, '127.0.0.1', 1000);
  }

  const service = spawnService(startCommand, {
    cwd: workspaceDir,
    env: { PORT: String(port) },
  });

  const isReady = await service.waitForPort(port, timeoutMs);

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
        },
      };
    }

    return {
      checkResult: {
        id: 'startup-check',
        title: 'Production server failed to start or open port',
        category: 'runtime',
        status: 'block',
        severity: 'blocker',
        summary: alive
          ? `Server started but port ${port} did not become ready within ${timeoutMs / 1000}s.`
          : `Server crashed immediately on startup. Process exited before port ${port} opened.`,
        evidence: [evidence],
        remediation: 'Check startup logs for runtime errors, missing environment variables, or uncaught exceptions during boot.',
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
      },
    };
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
      summary: `Application successfully started on port ${port} and responded to health check with HTTP ${health.status} (${health.durationMs}ms).`,
      evidence: [procEvidence, httpEvidence],
    },
  };
}
