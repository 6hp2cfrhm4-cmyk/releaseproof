import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import pc from 'picocolors';

export async function handleReport(
  targetPath = '.',
  options: { open?: boolean } = {}
): Promise<void> {
  const projectDir = path.resolve(targetPath);
  const htmlPath = path.join(projectDir, '.releaseproof', 'report.html');

  try {
    await fs.stat(htmlPath);
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
    const startCmd =
      process.platform === 'darwin'
        ? `open "${htmlPath}"`
        : process.platform === 'win32'
        ? `start "" "${htmlPath}"`
        : `xdg-open "${htmlPath}"`;

    exec(startCmd);
  }
}
