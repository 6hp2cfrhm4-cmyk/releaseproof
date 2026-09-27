import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
import { VerificationReport } from '@releaseproof/schemas';
import { assertReportArtifactSet, formatVibeCheckCard, publishReportArtifacts } from '@releaseproof/reporter';
import { verifyProject } from '@releaseproof/core';
import { assertOutputDirectoryWritable, resolveArtifactDirectory } from './artifact-path.js';

export async function handleVibe(targetPath = '.', options: { outputDir?: string } = {}): Promise<void> {
  const projectDir = path.resolve(targetPath);
  let artifactDir: string;
  try { artifactDir = await resolveArtifactDirectory(projectDir, options.outputDir); }
  catch (error: unknown) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 3;
    return;
  }
  const manifestPath = path.join(artifactDir, 'report-manifest.json');

  let report: VerificationReport;
  try {
    if (await pathExists(manifestPath)) {
      report = await assertReportArtifactSet(artifactDir);
    } else {
      await assertOutputDirectoryWritable(artifactDir, options.outputDir !== undefined);
      // If not scanned yet, run verification
      console.log(pc.dim('No existing scan found. Running verification...'));
      report = await verifyProject({ projectDir, outputDir: options.outputDir });
      await publishReportArtifacts(report, artifactDir);
    }
  } catch (error: unknown) {
    console.error(pc.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 3;
    return;
  }

  console.log('');
  console.log(formatVibeCheckCard(report));
  console.log('');
}

async function pathExists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
