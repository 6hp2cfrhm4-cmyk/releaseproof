import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { inspectPackageManagerPolicy } from './package-manager-policy.js';

describe('package manager selection policy', () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('marks conflicting Node lockfiles incomplete unless a manager is explicitly declared', async () => {
    const root = await makeRoot();
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'ambiguous' }));
    await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const ambiguous = await inspectPackageManagerPolicy(root, ['javascript'], 'pnpm');
    expect(ambiguous.canExecute).toBe(false);
    expect(ambiguous.findings[0]?.status).toBe('unknown');

    const selected = await inspectPackageManagerPolicy(root, ['javascript'], 'pnpm', 'pnpm');
    expect(selected.canExecute).toBe(true);
    expect(selected.manager).toBe('pnpm');
    expect(selected.findings[0]?.status).toBe('warn');
  });

  it('does not silently ignore a lockfile for a different requested manager', async () => {
    const root = await makeRoot();
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'conflict' }));
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const policy = await inspectPackageManagerPolicy(root, ['javascript'], 'pnpm', 'npm');
    expect(policy.canExecute).toBe(false);
    expect(policy.findings[0]?.summary).toMatch(/no matching package-lock\.json/i);
  });

  it('requires a single-runtime target and rejects unsupported Poetry verification', async () => {
    const root = await makeRoot();
    const mixed = await inspectPackageManagerPolicy(root, ['javascript', 'python'], 'pnpm', 'pnpm');
    expect(mixed.canExecute).toBe(false);

    await fs.writeFile(path.join(root, 'pyproject.toml'), '[tool.poetry]\nname="x"');
    await fs.writeFile(path.join(root, 'poetry.lock'), '');
    const poetry = await inspectPackageManagerPolicy(root, ['python'], 'poetry');
    expect(poetry.canExecute).toBe(false);
    expect(poetry.findings[0]?.summary).toMatch(/Poetry/);
  });

  it('accepts a pinned uv project and reports uv without a lock as non-reproducible', async () => {
    const root = await makeRoot();
    await fs.writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="x"');
    await fs.writeFile(path.join(root, 'uv.lock'), 'version = 1');
    const locked = await inspectPackageManagerPolicy(root, ['python'], 'uv');
    expect(locked).toMatchObject({ canExecute: true, manager: 'uv', findings: [] });

    await fs.rm(path.join(root, 'uv.lock'));
    const unpinned = await inspectPackageManagerPolicy(root, ['python'], 'uv');
    expect(unpinned.canExecute).toBe(true);
    expect(unpinned.findings[0]?.status).toBe('warn');
  });

  async function makeRoot(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-manager-policy-'));
    roots.push(root);
    return root;
  }
});
