import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createCleanWorkspace } from '../index.js';

describe('sandbox', () => {
  const testRoot = path.join(os.tmpdir(), `test-src-${Date.now()}`);

  afterEach(async () => {
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {}
  });

  it('copies source files while strictly ignoring node_modules and dist', async () => {
    await fs.mkdir(path.join(testRoot, 'src'), { recursive: true });
    await fs.mkdir(path.join(testRoot, 'node_modules', 'fake-pkg'), { recursive: true });
    await fs.mkdir(path.join(testRoot, '.next'), { recursive: true });

    await fs.writeFile(path.join(testRoot, 'src', 'index.ts'), 'export const a = 1;');
    await fs.writeFile(path.join(testRoot, 'package.json'), '{"name":"test"}');
    await fs.writeFile(path.join(testRoot, 'node_modules', 'fake-pkg', 'index.js'), 'bad');
    await fs.writeFile(path.join(testRoot, '.next', 'build.js'), 'bad');

    const workspace = await createCleanWorkspace(testRoot);

    try {
      const srcExists = await fs
        .stat(path.join(workspace.path, 'src', 'index.ts'))
        .then(() => true)
        .catch(() => false);
      const pkgExists = await fs
        .stat(path.join(workspace.path, 'package.json'))
        .then(() => true)
        .catch(() => false);
      const nodeModulesExists = await fs
        .stat(path.join(workspace.path, 'node_modules'))
        .then(() => true)
        .catch(() => false);
      const nextExists = await fs
        .stat(path.join(workspace.path, '.next'))
        .then(() => true)
        .catch(() => false);

      expect(srcExists).toBe(true);
      expect(pkgExists).toBe(true);
      expect(nodeModulesExists).toBe(false);
      expect(nextExists).toBe(false);
    } finally {
      await workspace.dispose();
      const tempStillExists = await fs
        .stat(workspace.path)
        .then(() => true)
        .catch(() => false);
      expect(tempStillExists).toBe(false);
    }
  });
});
