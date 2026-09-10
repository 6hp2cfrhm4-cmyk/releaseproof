import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
import { VerificationReport } from '@releaseproof/schemas';
import { formatVibeCheckCard } from '@releaseproof/reporter';
import { verifyProject } from '@releaseproof/core';

export async function handleVibe(targetPath = '.'): Promise<void> {
  const projectDir = path.resolve(targetPath);
  const jsonReportPath = path.join(projectDir, '.releaseproof', 'report.json');

  let report: VerificationReport;

  try {
    const raw = await fs.readFile(jsonReportPath, 'utf-8');
    report = JSON.parse(raw);
  } catch {
    // If not scanned yet, run verification
    console.log(pc.dim('No existing scan found. Running verification...'));
    report = await verifyProject({ projectDir });
  }

  console.log('');
  console.log(formatVibeCheckCard(report));
  console.log('');
}
