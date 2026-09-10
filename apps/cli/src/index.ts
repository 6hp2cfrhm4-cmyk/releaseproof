#!/usr/bin/env node
import { Command } from 'commander';
import { handleVerify } from './commands/verify.js';
import { handleReport } from './commands/report.js';
import { handleVibe } from './commands/vibe.js';
import { handleDoctor } from './commands/doctor.js';
import { handleClean } from './commands/clean.js';

const program = new Command();

program
  .name('releaseproof')
  .description('Production-readiness verification engine for vibe-coders and AI agents.')
  .version('0.1.0')
  .argument('[path]', 'Project directory to verify', '.')
  .option('--ci', 'Run in deterministic CI mode with exit codes')
  .option('--json', 'Output results as JSON')
  .option('--verbose', 'Show detailed output and stream logs')
  .option('--timeout <ms>', 'Server startup timeout in milliseconds')
  .option('--port <port>', 'Port to verify')
  .option('--skip-sandbox', 'Run checks in place without copying to temporary clean-room')
  .action((targetPath, options) => {
    handleVerify(targetPath, options);
  });

program
  .command('verify')
  .description('Run full production verification pipeline')
  .argument('[path]', 'Project directory to verify', '.')
  .option('--ci', 'Run in deterministic CI mode with exit codes')
  .option('--json', 'Output results as JSON')
  .option('--verbose', 'Show detailed output and stream logs')
  .option('--timeout <ms>', 'Server startup timeout in milliseconds')
  .option('--port <port>', 'Port to verify')
  .option('--skip-sandbox', 'Run checks in place without copying to temporary clean-room')
  .action((targetPath, options) => {
    handleVerify(targetPath, options);
  });

program
  .command('report')
  .description('Open or inspect latest verification HTML report')
  .argument('[path]', 'Project directory', '.')
  .option('--no-open', 'Do not automatically launch browser')
  .action((targetPath, options) => {
    handleReport(targetPath, options);
  });

program
  .command('vibe')
  .description('Generate shareable terminal vibe check card')
  .argument('[path]', 'Project directory', '.')
  .action((targetPath) => {
    handleVibe(targetPath);
  });

program
  .command('doctor')
  .description('Inspect environment dependencies and tools')
  .action(() => {
    handleDoctor();
  });

program
  .command('clean')
  .description('Clean ReleaseProof artifact directory')
  .argument('[path]', 'Project directory', '.')
  .action((targetPath) => {
    handleClean(targetPath);
  });

program.parse(process.argv);
