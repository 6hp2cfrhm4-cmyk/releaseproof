import { CheckResult, CommandEvidence } from '@releaseproof/schemas';
import { execCommand } from '@releaseproof/runner';

const MISSING_NATIVE_TOOLCHAIN_PATTERNS = [
  /Microsoft Visual C\+\+ [\d.]+ or greater is required/i,
  /(?:unable to execute|command)\s+['"`]*(?:cc|gcc|g\+\+|clang|clang\+\+)['"`]*.*(?:no such file|not found)/i,
  /(?:Rust compiler|rustc).*(?:not found|is required|could not be found)/i,
  /(?:CMake|ninja).*(?:not found|is required|could not be found)/i,
];

export function isMissingNativeToolchain(output: string): boolean {
  return MISSING_NATIVE_TOOLCHAIN_PATTERNS.some((pattern) => pattern.test(output));
}

export async function runInstallCheck(
  workspaceDir: string,
  installCommand?: string,
  environment: Record<string, string | undefined> = {},
  allowHostEnv: string[] = []
): Promise<CheckResult> {
  if (!installCommand) {
    return {
      id: 'install-check',
      title: 'Dependency installation',
      category: 'install',
      status: 'skipped',
      severity: 'info',
      summary: 'No installation command configured or needed.',
      evidence: [],
    };
  }

  const result = await execCommand(installCommand, {
    cwd: workspaceDir,
    timeoutMs: 180000,
    env: environment,
    allowHostEnv,
  });

  const evidence: CommandEvidence = {
    type: 'command',
    command: installCommand,
    exitCode: result.exitCode,
    stdout: result.stdout.slice(-2000),
    stderr: result.stderr.slice(-2000),
    durationMs: result.durationMs,
  };

  if (result.exitCode === 0) {
    return {
      id: 'install-check',
      title: 'Clean dependency installation',
      category: 'install',
      status: 'pass',
      severity: 'info',
      summary: `Clean dependency installation succeeded in ${Math.round(result.durationMs / 1000)}s.`,
      evidence: [evidence],
    };
  }

  if (result.timedOut || result.killed) {
    return {
      id: 'install-check',
      title: 'Dependency installation timed out before verification completed',
      category: 'install',
      status: 'unknown',
      severity: 'medium',
      summary: `Installation command \`${installCommand}\` did not complete within the verification time limit.`,
      evidence: [evidence],
      remediation: 'Retry with a reachable package registry, a compatible lockfile, or a verification environment with sufficient dependency-install capacity.',
      metadata: {
        timedOut: result.timedOut,
        killed: result.killed,
      },
      classification: 'VERIFICATION_UNAVAILABLE',
    };
  }

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (isMissingNativeToolchain(combinedOutput)) {
    return {
      id: 'install-check',
      title: 'Dependency installation could not be verified',
      category: 'install',
      status: 'unknown',
      severity: 'medium',
      summary: `Installation command \`${installCommand}\` required a native build toolchain that is unavailable in the verification environment.`,
      evidence: [evidence],
      remediation: 'Install the compiler/build tools required by the dependency, or verify with a supported runtime that has a compatible prebuilt package.',
      classification: 'VERIFICATION_UNAVAILABLE',
    };
  }

  return {
    id: 'install-check',
    title: 'Clean dependency installation failed',
    category: 'install',
    status: 'block',
    severity: 'blocker',
    summary: `Installation command \`${installCommand}\` failed with exit code ${result.exitCode}.`,
    evidence: [evidence],
    remediation: 'Check package lockfile, missing dependencies, or incompatible node/runtime versions in error log.',
    classification: 'APPLICATION_FAILURE',
  };
}
