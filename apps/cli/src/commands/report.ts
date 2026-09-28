import * as path from 'node:path';
import { spawn } from 'node:child_process';
import pc from 'picocolors';
import { assertReportArtifactSet } from '@releaseproof/reporter';
import { resolveArtifactDirectory } from './artifact-path.js';

export async function handleReport(
  targetPath = '.',
  options: { open?: boolean; outputDir?: string } = {}
): Promise<void> {
  const projectDir = path.resolve(targetPath);
  let artifactsDir: string;
  try { artifactsDir = await resolveArtifactDirectory(projectDir, options.outputDir); }
  catch (error: unknown) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 3;
    return;
  }
  const htmlPath = path.join(artifactsDir, 'report.html');

  try {
    const report = await assertReportArtifactSet(artifactsDir);
    console.log(pc.dim(`  Verdict: ${report.verdict} · score ${report.score}/100 · evidence ${Math.round(report.evidenceCoverage * 100)}%`));
  } catch (error: unknown) {
    console.error(pc.red('No ReleaseProof report found.'));
    console.error(pc.dim('Run `releaseproof verify` first to generate a report.'));
    console.error(pc.dim(`Technical details (${artifactsDir}): ${error instanceof Error ? error.message : String(error)}`));
    process.exitCode = 1;
    return;
  }

  console.log(pc.bold('ReleaseProof Report:'));
  console.log(`  Path: ${pc.cyan(htmlPath)}`);

  if (options.open !== false) {
    console.log(pc.dim('  Opening report in default browser...'));
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
    const child = spawn(opener, [htmlPath], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  }
}
