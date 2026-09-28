import * as fs from 'node:fs/promises';
import { assertReportArtifactSet } from '@releaseproof/reporter';
import { resolveArtifactDirectory } from '@releaseproof/core';

export { resolveArtifactDirectory };

/** Never overwrite arbitrary files when the caller selects a custom output directory. */
export async function assertOutputDirectoryWritable(directory: string, explicitlySelected: boolean): Promise<void> {
  if (!explicitlySelected) return;
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (entries.length === 0) return;

  const allowed = new Set(['report-manifest.json', 'report.json', 'report.html', 'RELEASEPROOF_FIX.md', 'screenshots']);
  const unexpected = entries.filter((entry) => !allowed.has(entry.name));
  if (unexpected.length > 0) {
    throw new Error(`--output-dir contains files not owned by ReleaseProof: ${unexpected.map((entry) => entry.name).join(', ')}.`);
  }
  const screenshots = entries.find((entry) => entry.name === 'screenshots');
  if (screenshots && !screenshots.isDirectory()) throw new Error('--output-dir/screenshots is not a directory.');
  if (!entries.some((entry) => entry.name === 'report-manifest.json')) {
    throw new Error('--output-dir is non-empty but has no valid ReleaseProof report manifest. Use `releaseproof clean` for that artifact directory first.');
  }
  await assertReportArtifactSet(directory);
}
