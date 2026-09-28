import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyProject } from '../engine.js';

describe('Python interpreter identity', () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('uses one workspace-local interpreter for venv install and configured startup command', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-python-identity-'));
    roots.push(root);
    await fs.writeFile(path.join(root, 'requirements.txt'), '');
    await fs.writeFile(path.join(root, 'main.py'), 'print("python fixture")');
    const report = await verifyProject({
      projectDir: root,
      config: {
        checks: { startup: false, browser: false, build: false, environment: false, secrets: false, documentation: false, devProd: false },
      },
    });
    const setup = report.checks.find((check) => check.id === 'python-interpreter-setup');
    const install = report.checks.find((check) => check.id === 'install-check');
    expect(setup?.status).toBe('pass');
    expect(setup?.summary).toContain('.releaseproof');
    const commandEvidence = install?.evidence.find((item) => item.type === 'command');
    expect(commandEvidence && commandEvidence.type === 'command' ? commandEvidence.command : '').toContain('.releaseproof');
  }, 60000);
});
