import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
import { VerificationReport } from '@releaseproof/schemas';
import { assertReportArtifactSet, formatVibeCheckCard, publishReportArtifacts } from '@releaseproof/reporter';
import { verifyProject } from '@releaseproof/core';

export async function handleVibe(targetPath = '.'): Promise<void> {
  const projectDir = path.resolve(targetPath);
  const artifactDir = path.join(projectDir, '.releaseproof');
  const manifestPath = path.join(artifactDir, 'report-manifest.json');

  let report: VerificationReport;
  if (await pathExists(manifestPath)) {
    report = await assertReportArtifactSet(artifactDir);
  } else {
    // If not scanned yet, run verification
    console.log(pc.dim('No existing scan found. Running verification...'));
    report = await verifyProject({ projectDir });
    await publishReportArtifacts(report, artifactDir);
  }

  console.log('');
  console.log(formatVibeCheckCard(report));
  console.log('');
}

async function pathExists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
