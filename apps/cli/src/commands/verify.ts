import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pc from 'picocolors';
import { verifyProject } from '@releaseproof/core';
import {
  formatTerminalReport,
  generateAiHandoffMarkdown,
  generateHtmlReport,
} from '@releaseproof/reporter';

export interface VerifyCommandOptions {
  ci?: boolean;
  json?: boolean;
  verbose?: boolean;
  timeout?: string;
  port?: string;
  skipSandbox?: boolean;
}

export async function handleVerify(
  targetPath = '.',
  options: VerifyCommandOptions = {}
): Promise<void> {
  const projectDir = path.resolve(targetPath);

  const displayTarget = targetPath === '.' ? '.' : (path.relative(process.cwd(), projectDir) || '.');

  if (!options.json) {
    console.log(pc.bold('ReleaseProof'));
    console.log(pc.dim(`Verifying production readiness: ${displayTarget}`));
    console.log('');
  }

  const port = options.port ? parseInt(options.port, 10) : undefined;
  const timeoutMs = options.timeout ? parseInt(options.timeout, 10) : undefined;

  let currentStep = '';
  try {
    const report = await verifyProject({
      projectDir,
      skipSandbox: options.skipSandbox,
      config: {
        ci: options.ci,
        verbose: options.verbose,
        start: {
          ...(port !== undefined ? { port } : {}),
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        },
      },
      onProgress: (step, status, detail) => {
        if (options.json) return;
        if (status === 'running') {
          currentStep = step;
          process.stdout.write(pc.dim(`  ... ${step}${detail ? ` (${detail})` : ''}\r`));
        } else if (status === 'done') {
          console.log(`  ${pc.green('✓')} ${step}${detail ? pc.dim(` — ${detail}`) : ''}`);
        } else if (status === 'fail') {
          console.log(`  ${pc.red('✗')} ${step}${detail ? pc.dim(` — ${detail}`) : ''}`);
        }
      },
    });

    // Write HTML report
    if (report.htmlReportPath) {
      const html = generateHtmlReport(report);
      const absHtml = path.resolve(process.cwd(), report.htmlReportPath);
      await fs.writeFile(absHtml, html, 'utf-8');
    }

    // Write AI Fix Prompt
    if (report.fixPromptPath) {
      const prompt = generateAiHandoffMarkdown(report);
      const absFix = path.resolve(process.cwd(), report.fixPromptPath);
      await fs.writeFile(absFix, prompt, 'utf-8');
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatTerminalReport(report));
    }

    if (report.verdict === 'NOT_READY') {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (err: unknown) {
    if (options.json) {
      console.error(JSON.stringify({ error: String(err) }));
    } else {
      console.error('');
      console.error(pc.red(`ReleaseProof execution error during: ${currentStep}`));
      console.error(pc.red(err instanceof Error ? err.stack || err.message : String(err)));
    }
    process.exitCode = 2;
  }
}
