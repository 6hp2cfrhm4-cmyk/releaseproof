import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { VerificationReportSchema } from '@releaseproof/schemas';
import type { VerificationReport } from '@releaseproof/schemas';
import { generateAiHandoffMarkdown } from './ai-handoff.js';
import { generateHtmlReport } from './html.js';

const artifactNames = ['report.json', 'report.html', 'RELEASEPROOF_FIX.md'] as const;
const manifestName = 'report-manifest.json';

type ArtifactName = (typeof artifactNames)[number];
interface ArtifactManifest {
  schemaVersion: 1;
  reportId: string;
  files: Record<ArtifactName, string>;
}

/**
 * Publish all user-facing artifacts from one validated report. The manifest is
 * the commit marker: readers reject a partial/mixed set if a process stops
 * between replacing files. Each file and the marker is atomically renamed.
 */
export async function publishReportArtifacts(reportInput: unknown, artifactsDir: string): Promise<void> {
  const report = VerificationReportSchema.parse(reportInput);
  const directory = path.resolve(artifactsDir);
  const contents: Record<ArtifactName, string> = {
    'report.json': `${JSON.stringify(report, null, 2)}\n`,
    'report.html': generateHtmlReport(report),
    'RELEASEPROOF_FIX.md': generateAiHandoffMarkdown(report),
  };
  const hashes = Object.fromEntries(artifactNames.map((name) => [name, sha256(contents[name])])) as Record<ArtifactName, string>;
  const manifest: ArtifactManifest = { schemaVersion: 1, reportId: report.id, files: hashes };
  const token = randomUUID();
  const staged = new Map<ArtifactName | typeof manifestName, string>();
  const manifestPath = path.join(directory, manifestName);

  await fs.mkdir(directory, { recursive: true });
  // An old marker must never certify a newly mixed set during publication.
  await fs.rm(manifestPath, { force: true });
  try {
    for (const name of artifactNames) {
      const tempPath = path.join(directory, `.${name}.tmp-${token}`);
      await fs.writeFile(tempPath, contents[name], { encoding: 'utf8', flag: 'wx' });
      staged.set(name, tempPath);
    }
    const manifestTemp = path.join(directory, `.${manifestName}.tmp-${token}`);
    await fs.writeFile(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    staged.set(manifestName, manifestTemp);

    for (const name of artifactNames) {
      await fs.rename(staged.get(name)!, path.join(directory, name));
      staged.delete(name);
    }
    await fs.rename(staged.get(manifestName)!, manifestPath);
    staged.delete(manifestName);
  } finally {
    await Promise.all([...staged.values()].map((file) => fs.rm(file, { force: true }).catch(() => {})));
  }
}

/** Reject missing, stale, malformed, modified, or internally mixed reports. */
export async function assertReportArtifactSet(artifactsDir: string, expectedReportId?: string): Promise<VerificationReport> {
  const directory = path.resolve(artifactsDir);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await fs.readFile(path.join(directory, manifestName), 'utf8'));
  } catch {
    throw new Error('Report artifact set is incomplete or has no commit manifest. Run `releaseproof verify` again.');
  }
  if (!isManifest(rawManifest)) throw new Error('Report artifact manifest is invalid. Run `releaseproof verify` again.');

  const reportRaw = await readArtifact(directory, 'report.json');
  const report = VerificationReportSchema.parse(JSON.parse(reportRaw));
  if (report.id !== rawManifest.reportId || (expectedReportId && report.id !== expectedReportId)) {
    throw new Error('Report artifacts belong to a different verification run. Run `releaseproof verify` again.');
  }
  const expectedContents: Record<ArtifactName, string> = {
    'report.json': `${JSON.stringify(report, null, 2)}\n`,
    'report.html': generateHtmlReport(report),
    'RELEASEPROOF_FIX.md': generateAiHandoffMarkdown(report),
  };
  for (const name of artifactNames) {
    const content = name === 'report.json' ? reportRaw : await readArtifact(directory, name);
    if (sha256(content) !== rawManifest.files[name] || sha256(content) !== sha256(expectedContents[name])) {
      throw new Error(`Report artifact ${name} does not match the committed report set. Run releaseproof verify again.`);
    }
  }
  const html = await readArtifact(directory, 'report.html');
  const handoff = await readArtifact(directory, 'RELEASEPROOF_FIX.md');
  if (!html.includes(`Report ${report.id}`) || !handoff.includes(`**Report ID**: ${report.id}`)) {
    throw new Error('Report HTML or AI handoff has a stale report identity. Run `releaseproof verify` again.');
  }
  return report;
}

async function readArtifact(directory: string, name: ArtifactName): Promise<string> {
  try { return await fs.readFile(path.join(directory, name), 'utf8'); }
  catch { throw new Error(`Report artifact ${name} is missing. Run releaseproof verify again.`); }
}

function isManifest(value: unknown): value is ArtifactManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<ArtifactManifest>;
  if (manifest.schemaVersion !== 1 || typeof manifest.reportId !== 'string' || !manifest.files || typeof manifest.files !== 'object') return false;
  return artifactNames.every((name) => typeof manifest.files?.[name] === 'string' && /^[a-f0-9]{64}$/.test(manifest.files[name]));
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
