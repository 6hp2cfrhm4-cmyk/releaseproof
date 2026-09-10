import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createCleanWorkspace } from '../index.js';

describe('clean-room isolation hardening', () => {
  const testRoots: string[] = [];

  afterEach(async () => {
    for (const r of testRoots) {
      try {
        await fs.rm(r, { recursive: true, force: true });
      } catch {}
    }
    testRoots.length = 0;
  });

  it('purges all host artifacts: undeclared node_modules, pre-built dist, .next, and local .env files', async () => {
    const dirtyDir = path.join(os.tmpdir(), `rp-dirty-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    testRoots.push(dirtyDir);

    await fs.mkdir(path.join(dirtyDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(dirtyDir, 'node_modules', 'undeclared-dependency'), { recursive: true });
    await fs.mkdir(path.join(dirtyDir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(dirtyDir, '.next'), { recursive: true });
    await fs.mkdir(path.join(dirtyDir, '.venv'), { recursive: true });
    await fs.mkdir(path.join(dirtyDir, '.turbo'), { recursive: true });

    // Legitimate project files
    await fs.writeFile(path.join(dirtyDir, 'package.json'), JSON.stringify({ name: 'dirty-project', version: '1.0.0' }));
    await fs.writeFile(path.join(dirtyDir, 'src', 'server.js'), 'console.log("clean");');
    await fs.writeFile(path.join(dirtyDir, 'README.md'), '# Dirty App\n\n```bash\nnpm test\n```');

    // Dirty artifacts that only exist on developer machine
    await fs.writeFile(path.join(dirtyDir, 'node_modules', 'undeclared-dependency', 'index.js'), 'module.exports = "ghost";');
    await fs.writeFile(path.join(dirtyDir, 'dist', 'bundle.js'), 'console.log("prebuilt stale bundle");');
    await fs.writeFile(path.join(dirtyDir, '.next', 'stale.json'), '{}');
    await fs.writeFile(path.join(dirtyDir, '.env.local'), 'SECRET_HOST_TOKEN=12345');
    await fs.writeFile(path.join(dirtyDir, '.env.production.local'), 'PROD_TOKEN=secret');

    // Create clean-room sandbox
    const workspace = await createCleanWorkspace(dirtyDir);

    try {
      // 1. Legitimate files must be present
      expect(await fileExists(path.join(workspace.path, 'package.json'))).toBe(true);
      expect(await fileExists(path.join(workspace.path, 'src', 'server.js'))).toBe(true);
      expect(await fileExists(path.join(workspace.path, 'README.md'))).toBe(true);

      // 2. Polluting host artifacts MUST be absent
      expect(await fileExists(path.join(workspace.path, 'node_modules'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, 'node_modules', 'undeclared-dependency'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, 'dist'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, '.next'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, '.venv'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, '.turbo'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, '.env.local'))).toBe(false);
      expect(await fileExists(path.join(workspace.path, '.env.production.local'))).toBe(false);
    } finally {
      await workspace.dispose();
    }
  });

  it('guarantees disposal cleans up temp directory completely', async () => {
    const srcDir = path.join(os.tmpdir(), `rp-disp-${Date.now()}`);
    testRoots.push(srcDir);
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, 'index.js'), 'console.log(1);');

    const workspace = await createCleanWorkspace(srcDir);
    const sandboxPath = workspace.path;
    expect(await fileExists(sandboxPath)).toBe(true);

    await workspace.dispose();
    expect(await fileExists(sandboxPath)).toBe(false);
  });
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
