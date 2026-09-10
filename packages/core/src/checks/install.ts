import { CheckResult, CommandEvidence } from '@releaseproof/schemas';
import { execCommand } from '@releaseproof/runner';

export async function runInstallCheck(
  workspaceDir: string,
  installCommand?: string
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

  return {
    id: 'install-check',
    title: 'Clean dependency installation failed',
    category: 'install',
    status: 'block',
    severity: 'blocker',
    summary: `Installation command \`${installCommand}\` failed with exit code ${result.exitCode}.`,
    evidence: [evidence],
    remediation: 'Check package lockfile, missing dependencies, or incompatible node/runtime versions in error log.',
  };
}
