import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveArtifactDirectory } from './artifact-path.js';

describe('managed report output directory', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('defaults to .releaseproof and supports a nested managed directory without creating it', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-artifact-path-'));
    roots.push(project);
    const projectRoot = await fs.realpath(project);

    await expect(resolveArtifactDirectory(project, undefined)).resolves.toBe(path.join(projectRoot, '.releaseproof'));
    await expect(resolveArtifactDirectory(project, '.releaseproof/custom reports')).resolves.toBe(path.join(projectRoot, '.releaseproof', 'custom reports'));
    await expect(fs.access(path.join(projectRoot, '.releaseproof'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['reports', '.releaseproof/../reports', '.releaseproof\\..\\reports', 'C:\\outside', '/outside', ''])
    ('rejects an invalid output location: %s', async (outputDir) => {
      const project = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-artifact-path-invalid-'));
      roots.push(project);
      await expect(resolveArtifactDirectory(project, outputDir)).rejects.toThrow(/output-dir/i);
    });

  it.skipIf(process.platform === 'win32')('rejects a managed artifact root redirected outside the project by symlink', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-artifact-path-link-'));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-artifact-path-outside-'));
    roots.push(project, outside);
    await fs.symlink(outside, path.join(project, '.releaseproof'), 'dir');
    await expect(resolveArtifactDirectory(project, '.releaseproof/reports')).rejects.toThrow(/real directory inside/i);
  });
});
