import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';

export async function handleClean(targetPath = '.'): Promise<void> {
  const projectDir = path.resolve(targetPath);
  const artifactsDir = path.join(projectDir, '.releaseproof');

  try {
    await fs.rm(artifactsDir, { recursive: true, force: true });
    console.log(pc.green(`✓ Cleaned artifacts in ${artifactsDir}`));
  } catch (err) {
    console.error(pc.red(`Failed to clean ${artifactsDir}: ${String(err)}`));
    process.exitCode = 1;
  }
}
