import { VerificationReport } from '@releaseproof/schemas';

export function generateAiHandoffMarkdown(report: VerificationReport): string {
  const issues = report.checks.filter(
    (c) => c.status === 'block' || c.severity === 'blocker' || c.status === 'warn'
  );

  const lines: string[] = [];
  lines.push('# ReleaseProof Fix Task');
  lines.push('');
  lines.push('The application failed production-readiness verification.');
  lines.push('');
  lines.push('Your job is to fix ONLY the verified issues below.');
  lines.push('Do not rewrite unrelated architecture or refactor working code.');
  lines.push('');
  lines.push('After applying your changes, verify them by running:');
  lines.push('');
  lines.push('```bash');
  lines.push('npx releaseproof verify');
  lines.push('```');
  lines.push('');
  lines.push(`**Status**: ${report.verdict}`);
  lines.push(`**Score**: ${report.score} / 100`);
  lines.push(`**Issues Found**: ${issues.length} (${report.counts.blockers} blockers, ${report.counts.warnings} warnings)`);
  lines.push('');

  if (issues.length === 0) {
    lines.push('All checks passed! No issues detected.');
    return lines.join('\n');
  }

  issues.forEach((issue, index) => {
    lines.push(`## Issue ${index + 1}: ${issue.title}`);
    lines.push('');
    lines.push(`**Severity**: ${issue.severity.toUpperCase()}`);
    lines.push(`**Category**: ${issue.category}`);
    lines.push('');
    lines.push('### Problem');
    lines.push(issue.summary);
    lines.push('');

    // Evidence
    lines.push('### Verified Evidence');
    if (issue.evidence && issue.evidence.length > 0) {
      lines.push('```');
      for (const ev of issue.evidence) {
        if (ev.type === 'command') {
          lines.push(`Command: ${ev.command}`);
          lines.push(`Exit Code: ${ev.exitCode}`);
          if (ev.stderr) lines.push(`Stderr: ${ev.stderr.trim()}`);
          if (ev.stdout) lines.push(`Stdout: ${ev.stdout.trim()}`);
        } else if (ev.type === 'http') {
          lines.push(`HTTP ${ev.statusCode} on ${ev.method} ${ev.url}`);
          if (ev.responsePreview) lines.push(`Response: ${ev.responsePreview}`);
        } else if (ev.type === 'browser') {
          lines.push(`Route: ${ev.url}`);
          if (ev.pageErrors?.length) lines.push(`Page Errors: ${ev.pageErrors.join('; ')}`);
          if (ev.consoleErrors?.length) lines.push(`Console Errors: ${ev.consoleErrors.join('; ')}`);
          if (ev.failedRequests?.length) {
            lines.push(`Failed Network: ${ev.failedRequests.map((f) => `${f.url} (${f.status || f.errorText})`).join(', ')}`);
          }
        } else if (ev.type === 'filesystem') {
          lines.push(`File: ${ev.path}`);
          if (ev.contentPreview) lines.push(`Context: ${ev.contentPreview}`);
        } else if (ev.type === 'process') {
          lines.push(`Port: ${ev.port}, Alive: ${ev.alive}`);
          if (ev.stderrTail) lines.push(`Error log: ${ev.stderrTail}`);
        } else if (ev.type === 'environment') {
          lines.push(`Variable: ${ev.variable}`);
          lines.push(`Used in: ${ev.usedInFiles.join(', ')}`);
          lines.push(`Documented: ${ev.documentedInExample}`);
          lines.push(`Exposed to Client: ${ev.exposedToClient}`);
        }
      }
      lines.push('```');
    } else {
      lines.push('_No specific evidence payload recorded._');
    }
    lines.push('');

    // Reproduction
    lines.push('### Reproduction');
    lines.push('1. Run in clean environment.');
    if (issue.category === 'install') {
      lines.push(`2. Execute \`${report.profile.commands.install || 'npm install'}\`.`);
    } else if (issue.category === 'build') {
      lines.push(`2. Execute \`${report.profile.commands.build || 'npm run build'}\`.`);
    } else if (issue.category === 'runtime' || issue.category === 'browser') {
      lines.push(`2. Execute \`${report.profile.commands.start || 'npm start'}\`.`);
      lines.push('3. Inspect output or navigate to failing route.');
    } else {
      lines.push('2. Run `npx releaseproof verify`.');
    }
    lines.push('');

    // Expected vs Observed
    lines.push('### Expected vs Observed');
    lines.push(`- **Expected**: Normal execution with 0 errors, successful startup, and 200 HTTP responses.`);
    lines.push(`- **Observed**: ${issue.summary}`);
    lines.push('');

    // Remediation
    if (issue.remediation) {
      lines.push('### Recommended Fix');
      lines.push(issue.remediation);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

export function generateCompactAiContext(report: VerificationReport): string {
  const blockers = report.checks.filter(
    (c) => c.status === 'block' || c.severity === 'blocker'
  );

  const parts: string[] = [
    `Project: ${report.projectName}`,
    `Verdict: ${report.verdict} (Score: ${report.score}/100)`,
    `Blockers (${blockers.length}):`,
  ];

  for (const b of blockers) {
    parts.push(`- [${b.category}] ${b.title}: ${b.summary}`);
    if (b.remediation) {
      parts.push(`  Fix: ${b.remediation}`);
    }
  }

  return parts.join('\n');
}
