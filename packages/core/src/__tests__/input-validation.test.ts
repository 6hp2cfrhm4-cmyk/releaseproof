import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyProject } from '../engine.js';

describe('verification input validation precedes project side effects', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('rejects a missing project directory without creating output', async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-invalid-input-'));
    roots.push(parent);
    const missingProject = path.join(parent, 'missing');

    await expect(verifyProject({ projectDir: missingProject })).rejects.toThrow();
    await expect(fs.access(path.join(missingProject, '.releaseproof'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects malformed config and escaping targets without creating output', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-invalid-config-'));
    roots.push(project);

    await fs.writeFile(path.join(project, '.releaseproof.json'), '{invalid json');
    await expect(verifyProject({ projectDir: project })).rejects.toThrow(/Invalid \.releaseproof\.json/);
    await expect(fs.access(path.join(project, '.releaseproof'))).rejects.toMatchObject({ code: 'ENOENT' });

    await fs.writeFile(path.join(project, '.releaseproof.json'), JSON.stringify({ target: '../outside' }));
    await expect(verifyProject({ projectDir: project })).rejects.toThrow(/escapes the project directory/);
    await expect(fs.access(path.join(project, '.releaseproof'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('honors an already-aborted signal before creating output', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-aborted-input-'));
    roots.push(project);
    const controller = new AbortController();
    controller.abort();

    await expect(verifyProject({ projectDir: project, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(fs.access(path.join(project, '.releaseproof'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
