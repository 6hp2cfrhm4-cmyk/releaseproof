import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import pc from 'picocolors';
import { VerificationReportSchema } from '@releaseproof/schemas';

export async function handleReport(
  targetPath = '.',
  options: { open?: boolean } = {}
): Promise<void> {
  const projectDir = path.resolve(targetPath);
  const htmlPath = path.join(projectDir, '.releaseproof', 'report.html');
  const jsonPath = path.join(projectDir, '.releaseproof', 'report.json');

  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const report = VerificationReportSchema.parse(JSON.parse(raw));
    await fs.stat(htmlPath);
    console.log(pc.dim(`  Verdict: ${report.verdict} · score ${report.score}/100 · evidence ${Math.round(report.evidenceCoverage * 100)}%`));
  } catch {
    console.error(pc.red('No ReleaseProof report found.'));
    console.error(pc.dim('Run `releaseproof verify` first to generate a report.'));
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
