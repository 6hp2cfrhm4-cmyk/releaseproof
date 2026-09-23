import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const reportPath = process.argv[2];
if (!reportPath || !process.env.GITHUB_OUTPUT) {
  console.error('Usage: GITHUB_OUTPUT=<path> node scripts/write-action-results.mjs <report.json>');
  process.exitCode = 2;
} else {
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const statusEmoji = report.verdict === 'READY' ? '✅' : report.verdict === 'INCOMPLETE' ? '⚠️' : '❌';
  const summary = [
    `### ${statusEmoji} ReleaseProof Verification: ${report.verdict}`,
    '',
    `- **Score**: ${report.score} / 100`,
    `- **Blockers**: ${report.counts?.blockers ?? 0}`,
    `- **Warnings**: ${report.counts?.warnings ?? 0}`,
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
  await appendFile(process.env.GITHUB_OUTPUT, `${outputs.map(([key, value]) => `${key}=${value}`).join('\n')}\n`, 'utf8');
}
