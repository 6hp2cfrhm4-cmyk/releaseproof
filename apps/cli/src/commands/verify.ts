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
  pythonInterpreter?: string;
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
  const startConfig = {
    ...(port !== undefined ? { port } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
  const cliConfig = {
    ...(options.ci !== undefined ? { ci: options.ci } : {}),
    ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
    ...(Object.keys(startConfig).length > 0 ? { start: startConfig } : {}),
    ...(options.pythonInterpreter ? { python: { interpreter: path.resolve(options.pythonInterpreter) } } : {}),
  };

  let currentStep = '';
  try {
    if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      throw new Error(`Invalid --port value: ${options.port}`);
    }
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 1)) {
      throw new Error(`Invalid --timeout value: ${options.timeout}`);
    }
    const report = await verifyProject({
      projectDir,
      skipSandbox: options.skipSandbox,
      config: cliConfig,
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

    const internalError = report.checks.some((check) => check.classification === 'RELEASEPROOF_INTERNAL_ERROR');
    if (internalError) {
      process.exitCode = 3;
    } else if (report.verdict === 'NOT_READY') {
      process.exitCode = 1;
    } else if (report.verdict === 'INCOMPLETE') {
      process.exitCode = 2;
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
    process.exitCode = 3;
  }
}
