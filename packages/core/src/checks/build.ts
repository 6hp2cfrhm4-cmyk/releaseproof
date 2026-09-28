import { CheckResult, CommandEvidence } from '@releaseproof/schemas';
import { execCommand } from '@releaseproof/runner';
import { detectExternalServiceDependency, detectMissingRequiredEnvironment } from './external-services.js';

export async function runBuildCheck(
  workspaceDir: string,
  buildCommand?: string,
  environment: Record<string, string | undefined> = {},
  allowHostEnv: string[] = [],
  signal?: AbortSignal
): Promise<CheckResult> {
  if (!buildCommand) {
    return {
      id: 'build-check',
      title: 'Production build',
      category: 'build',
      status: 'skipped',
      severity: 'info',
      summary: 'No build step required for this project.',
      evidence: [],
    };
  }

  const result = await execCommand(buildCommand, {
    cwd: workspaceDir,
    timeoutMs: 180000,
    env: environment,
    allowHostEnv,
    signal,
  });

  if (result.aborted) {
    const cancelled = new Error('Production build was cancelled.');
    cancelled.name = 'AbortError';
    throw cancelled;
  }

  const evidence: CommandEvidence = {
    type: 'command',
    command: buildCommand,
    exitCode: result.exitCode,
    stdout: result.stdout.slice(-3000),
    stderr: result.stderr.slice(-3000),
    durationMs: result.durationMs,
  };

  if (result.exitCode === 0) {
    return {
      id: 'build-check',
      title: 'Production build succeeded',
      category: 'build',
      status: 'pass',
      severity: 'info',
      summary: `Production build command \`${buildCommand}\` completed successfully in ${Math.round(result.durationMs / 1000)}s.`,
      evidence: [evidence],
    };
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (detectMissingRequiredEnvironment(combinedOutput)) {
    return {
      id: 'build-check',
      title: 'Required application environment was unavailable during build',
      category: 'build',
      status: 'unknown',
      severity: 'medium',
      summary: `Build command \`${buildCommand}\` could not be verified because required project environment values were not supplied.`,
      evidence: [evidence],
      remediation: 'Provide disposable verification values for the required variables and retry.',
      classification: 'VERIFICATION_UNAVAILABLE',
    };
  }
  const extDep = detectExternalServiceDependency(combinedOutput);

  if (extDep) {
    return {
      id: 'build-check',
      title: `Verification incomplete: ${extDep.name} required during build`,
      category: 'build',
      status: 'unknown',
      severity: 'medium',
      summary: `Build command \`${buildCommand}\` could not be verified: ${extDep.reason}`,
      evidence: [evidence],
      remediation: extDep.remediation,
      metadata: {
        requiresExternalService: true,
        service: extDep.name,
      },
      classification: 'EXTERNAL_DEPENDENCY_UNAVAILABLE',
    };
  }

  return {
    id: 'build-check',
    title: 'Production build failed',
    category: 'build',
    status: 'block',
    severity: 'blocker',
    summary: `Build failed with exit code ${result.exitCode}. Build errors prevent deployment.`,
    evidence: [evidence],
    remediation: 'Inspect compiler/bundler errors in build log and resolve compilation or type check errors.',
    classification: 'APPLICATION_FAILURE',
  };
}
