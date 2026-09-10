import { CheckResult, CommandEvidence } from '@releaseproof/schemas';
import { execCommand } from '@releaseproof/runner';

export async function runBuildCheck(
  workspaceDir: string,
  buildCommand?: string
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
  });

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

  return {
    id: 'build-check',
    title: 'Production build failed',
    category: 'build',
    status: 'block',
    severity: 'blocker',
    summary: `Build failed with exit code ${result.exitCode}. Build errors prevent deployment.`,
    evidence: [evidence],
    remediation: 'Inspect compiler/bundler errors in build log and resolve compilation or type check errors.',
  };
}
