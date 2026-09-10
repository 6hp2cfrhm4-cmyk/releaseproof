import pc from 'picocolors';
import { VerificationReport } from '@releaseproof/schemas';

export function formatVibeCheckCard(report: VerificationReport): string {
  const width = 36;
  const pad = (str: string, len: number) => {
    const visibleLength = str.replace(/\u001b\[\d+m/g, '').length;
    const space = Math.max(0, len - visibleLength);
    return str + ' '.repeat(space);
  };
  const center = (str: string, len: number) => {
    const visibleLength = str.replace(/\u001b\[\d+m/g, '').length;
    const left = Math.max(0, Math.floor((len - visibleLength) / 2));
    const right = Math.max(0, len - visibleLength - left);
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const lines: string[] = [];
  lines.push('┌' + '─'.repeat(width) + '┐');
  lines.push('│' + center(pc.bold('ReleaseProof'), width) + '│');
  lines.push('│' + ' '.repeat(width) + '│');

  const vibeScore = `${report.score} / 100`;
  const vibeHeader = `VIBE CHECK: ${vibeScore}`;
  lines.push('│' + center(pc.bold(vibeHeader), width) + '│');
  lines.push('│' + ' '.repeat(width) + '│');

  const categories = [
    { name: 'Install', cat: 'install' },
    { name: 'Build', cat: 'build' },
    { name: 'Production', cat: 'runtime' },
    { name: 'Browser', cat: 'browser' },
    { name: 'Environment', cat: 'environment' },
    { name: 'Security', cat: 'security' },
  ] as const;

  for (const c of categories) {
    const data = report.categoryScores[c.cat];
    let statusText = pc.green('PASS');
    if (data?.status === 'fail') statusText = pc.red('FAIL');
    else if (data?.status === 'warn') statusText = pc.yellow('WARN');
    else if (data?.status === 'skipped') statusText = pc.dim('SKIP');

    const label = c.name.padEnd(16, ' ');
    const row = `  ${label}  ${statusText}`;
    lines.push('│' + pad(row, width) + '│');
  }

  lines.push('│' + ' '.repeat(width) + '│');
  const verdictBanner =
    report.verdict === 'READY'
      ? pc.bold(pc.green('READY TO SHIP'))
      : pc.bold(pc.red('NOT READY TO SHIP'));

  lines.push('│' + center(verdictBanner, width) + '│');
  lines.push('└' + '─'.repeat(width) + '┘');

  return lines.join('\n');
}
