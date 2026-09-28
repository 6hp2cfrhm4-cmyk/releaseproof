import { appendFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
// This script is executed directly by the composite Action from the repository
// root. Do not rely on the root package exposing workspace aliases: the root
// package intentionally has no runtime dependency on @releaseproof/* packages.
// The Action builds these packages immediately before invoking this script, so
// use stable repository-relative dist entrypoints instead.
import { VerificationReportSchema } from '../packages/schemas/dist/index.js';
import { assertReportArtifactSet } from '../packages/reporter/dist/index.js';

const reportPath = process.argv[2];
if (!reportPath || !process.env.GITHUB_OUTPUT) {
  console.error('Usage: GITHUB_OUTPUT=<path> node scripts/write-action-results.mjs <report.json>');
  process.exitCode = 2;
} else {
  const rawReport = JSON.parse(await readFile(reportPath, 'utf8'));
  const result = VerificationReportSchema.safeParse(rawReport);
  if (!result.success) throw new Error('ReleaseProof report does not match a supported schema.');
  const report = await assertReportArtifactSet(dirname(reportPath), result.data.id);
  const statusEmoji = report.verdict === 'READY' ? '✅' : report.verdict === 'INCOMPLETE' ? '⚠️' : '❌';
  const summary = [
    `### ${statusEmoji} ReleaseProof Verification: ${report.verdict}`,
    '',
    `- **Score**: ${report.score} / 100`,
    `- **Blockers**: ${report.counts?.blockers ?? 0}`,
    `- **Warnings**: ${report.counts?.warnings ?? 0}`,
    `- **Unknown / incomplete checks**: ${report.counts?.unknown ?? 0}`,
    `- **Evidence coverage**: ${Math.round((report.evidenceCoverage ?? 0) * 100)}%`,
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }
  const artifactDir = dirname(reportPath);
  const outputs = [
    ['score', report.score],
    ['status', report.verdict],
    ['blockers-count', report.counts?.blockers ?? 0],
    ['warnings-count', report.counts?.warnings ?? 0],
    ['html-report', join(artifactDir, 'report.html')],
    ['ai-fix-prompt', join(artifactDir, 'RELEASEPROOF_FIX.md')],
  ];
  const output = outputs.map(([key, rawValue]) => {
    const value = String(rawValue);
    let delimiter = `RELEASEPROOF_${randomUUID().replaceAll('-', '')}`;
    while (value.includes(delimiter)) delimiter = `RELEASEPROOF_${randomUUID().replaceAll('-', '')}`;
    return `${key}<<${delimiter}\n${value}\n${delimiter}`;
  }).join('\n');
  await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`, 'utf8');
}
