import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyProject } from '../engine.js';

describe('minimum executable evidence', () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('does not declare a monorepo root ready from only static checks', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-static-root-'));
    roots.push(root);
    await fs.writeFile(path.join(root, 'README.md'), '# Services\nSelect a subproject.\n');
    const report = await verifyProject({ projectDir: root });
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.checks.find((check) => check.id === 'runtime-evidence-missing')?.status).toBe('unknown');
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.capabilities?.runtime.status).toBe('unavailable');
    expect(report.capabilities?.browser.status).toBe('not_applicable');
    expect(report.cleanup?.status).toBe('clean');
  });
});
