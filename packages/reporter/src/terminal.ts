import pc from 'picocolors';
import { VerificationReport } from '@releaseproof/schemas';

export function formatTerminalReport(report: VerificationReport): string {
  const lines: string[] = [];
  const divider = pc.dim('─'.repeat(50));

  lines.push('');
  lines.push(`${pc.bold('ReleaseProof')} ${pc.dim(`v${report.version}`)}`);
  lines.push(pc.dim(`Project: ${report.projectName} (${report.projectPath})`));
  lines.push(divider);

  // Big Verdict Banner
  if (report.verdict === 'READY') {
    lines.push(
      pc.bold(pc.bgGreen(pc.black(' READY TO SHIP '))) +
        '  ' +
        pc.bold(pc.green(`${report.score} / 100`))
    );
  } else {
    lines.push(
      pc.bold(pc.bgRed(pc.white(' NOT READY TO SHIP '))) +
        '  ' +
        pc.bold(pc.red(`${report.score} / 100`))
    );
  }

  lines.push(
    pc.dim(
      `${pc.red(String(report.counts.blockers) + ' blockers')} · ` +
        `${pc.yellow(String(report.counts.warnings) + ' warnings')} · ` +
        `${pc.green(String(report.counts.passed) + ' passed')} · ` +
        `${(report.durationMs / 1000).toFixed(1)}s`
    )
  );
  lines.push(divider);

  // Category Breakdown Table
  lines.push(pc.bold('Categories:'));
  for (const [cat, data] of Object.entries(report.categoryScores)) {
    const paddedCat = cat.padEnd(15, ' ');
    const scoreStr = `${data.score}/${data.max}`.padStart(6, ' ');
    let statusBadge = pc.green('PASS');
    if (data.status === 'fail') statusBadge = pc.red('FAIL');
    else if (data.status === 'warn') statusBadge = pc.yellow('WARN');
    else if (data.status === 'skipped') statusBadge = pc.dim('SKIP');

    lines.push(`  ${paddedCat} ${statusBadge}  ${pc.dim(scoreStr)}`);
  }

  // Highlight Blockers
  const blockers = report.checks.filter(
    (c) => c.severity === 'blocker' || c.status === 'block'
  );

  if (blockers.length > 0) {
    lines.push('');
    lines.push(pc.bold(pc.red(`Verified Blockers (${blockers.length}):`)));

    for (const b of blockers) {
      lines.push('');
      lines.push(pc.red(`  ✗ [${b.category}] ${pc.bold(b.title)}`));
      lines.push(`    ${pc.white(b.summary)}`);

      if (b.evidence && b.evidence.length > 0) {
        for (const ev of b.evidence.slice(0, 2)) {
          if (ev.type === 'command') {
            lines.push(pc.dim(`    Evidence: command \`${ev.command}\` exited with ${ev.exitCode}`));
            if (ev.stderr) {
              const snippet = ev.stderr.trim().split('\n').slice(-2).join(' ');
              lines.push(pc.dim(`    Stderr: ${snippet}`));
            }
          } else if (ev.type === 'http') {
            lines.push(pc.dim(`    Evidence: HTTP ${ev.statusCode} on ${ev.url}`));
          } else if (ev.type === 'browser') {
            if (ev.pageErrors?.length) {
              lines.push(pc.dim(`    Browser error: ${ev.pageErrors[0]}`));
            }
          } else if (ev.type === 'filesystem') {
            lines.push(pc.dim(`    File: ${ev.path} — ${ev.contentPreview || ''}`));
          } else if (ev.type === 'environment') {
            lines.push(pc.dim(`    Variable: ${ev.variable} (used in: ${ev.usedInFiles.join(', ')})`));
          }
        }
      }

      if (b.remediation) {
        lines.push(pc.cyan(`    Fix: ${b.remediation}`));
      }
    }
  }

  // Highlight Warnings
  const warnings = report.checks.filter(
    (c) => c.status === 'warn' || c.severity === 'high'
  );
  if (warnings.length > 0) {
    lines.push('');
    lines.push(pc.bold(pc.yellow(`Warnings (${warnings.length}):`)));
    for (const w of warnings) {
      lines.push(`  ! [${w.category}] ${pc.bold(w.title)}: ${w.summary}`);
    }
  }

  lines.push('');
  lines.push(divider);
  lines.push(pc.dim('Artifacts:'));
  if (report.jsonReportPath) {
    lines.push(`  JSON Report:   ${pc.dim(report.jsonReportPath)}`);
  }
  if (report.htmlReportPath) {
    lines.push(`  HTML Report:   ${pc.cyan(report.htmlReportPath)}`);
  }
  if (report.fixPromptPath) {
    lines.push(`  AI Fix Prompt: ${pc.magenta(report.fixPromptPath)}`);
  }
  lines.push('');

  return lines.join('\n');
}
