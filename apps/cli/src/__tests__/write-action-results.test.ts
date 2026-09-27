import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { VerificationReportSchema } from '@releaseproof/schemas';
import { publishReportArtifacts } from '@releaseproof/reporter';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(process.cwd(), 'scripts/write-action-results.mjs');

describe('GitHub Action output writer', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('validates report artifacts and keeps untrusted paths inside one output value', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'releaseproof-action-output-'));
    roots.push(root);
    // Win32 file names cannot contain line breaks, while POSIX paths can.
    const pathSuffix = process.platform === 'win32' ? 'project path status=INJECTED' : 'project path\nstatus=INJECTED';
    const projectPath = path.join(root, pathSuffix);
    const artifactDir = path.join(projectPath, '.releaseproof');
    const outputPath = path.join(root, 'github output');
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(outputPath, '');
    const report = VerificationReportSchema.parse({
      schemaVersion: '1.0.0', id: 'action-output-test', version: '0.2.0-dev.0',
      timestamp: new Date().toISOString(), projectName: 'test', projectPath,
      profile: { root: projectPath, name: 'test' }, verdict: 'INCOMPLETE', score: 0,
      categoryScores: {}, counts: { total: 0, passed: 0, warnings: 0, blockers: 0, unknown: 0, skipped: 0, notApplicable: 0 },
      checks: [], durationMs: 1, artifactsDir: artifactDir,
    });
    await publishReportArtifacts(report, artifactDir);

    await execFileAsync(process.execPath, [scriptPath, path.join(artifactDir, 'report.json')], {
      env: { ...process.env, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: '' },
    });

    const records = parseMultilineOutputs(await fs.readFile(outputPath, 'utf8'));
    expect(records.get('status')).toBe('INCOMPLETE');
    expect(records.get('html-report')).toBe(path.join(artifactDir, 'report.html'));
    if (process.platform !== 'win32') expect(records.get('html-report')).toContain('\nstatus=INJECTED');
    expect(records.has('INJECTED')).toBe(false);
  });

  it('rejects a report that does not match the supported report schema', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'releaseproof-action-invalid-'));
    roots.push(root);
    const reportPath = path.join(root, 'report.json');
    const outputPath = path.join(root, 'github output');
    await fs.writeFile(reportPath, JSON.stringify({ schemaVersion: '2.0.0' }));
    await fs.writeFile(outputPath, '');

    await expect(execFileAsync(process.execPath, [scriptPath, reportPath], {
      env: { ...process.env, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: '' },
    })).rejects.toBeDefined();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('');
  });
});

function parseMultilineOutputs(text: string): Map<string, string> {
  const lines = text.split(/\r?\n/);
  const outputs = new Map<string, string>();
  for (let index = 0; index < lines.length;) {
    const match = /^([^<]+)<<([^\r\n]+)$/.exec(lines[index] ?? '');
    if (!match) { index += 1; continue; }
    const [, key, delimiter] = match;
    const value: string[] = [];
    index += 1;
    while (index < lines.length && lines[index] !== delimiter) value.push(lines[index++] ?? '');
    if (lines[index] !== delimiter) throw new Error(`Unclosed GitHub output for ${key}.`);
    outputs.set(key, value.join('\n'));
    index += 1;
  }
  return outputs;
}
