import * as fs from 'node:fs/promises';
import pc from 'picocolors';
import { resolveArtifactDirectory } from './artifact-path.js';

export async function handleClean(targetPath = '.', options: { outputDir?: string } = {}): Promise<void> {
  let artifactsDir: string;
  try { artifactsDir = await resolveArtifactDirectory(targetPath, options.outputDir); }
  catch (err: unknown) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 3;
    return;
  }

  try {
    await fs.rm(artifactsDir, { recursive: true, force: true });
    console.log(pc.green(`✓ Cleaned artifacts in ${artifactsDir}`));
  } catch (err) {
    console.error(pc.red(`Failed to clean ${artifactsDir}: ${String(err)}`));
    process.exitCode = 1;
  }
}
