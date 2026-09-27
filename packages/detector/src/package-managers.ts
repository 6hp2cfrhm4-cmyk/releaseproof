import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PackageManagerInfo, PackageManagerType } from '@releaseproof/schemas';

export async function detectPackageManager(projectDir: string, override?: PackageManagerType): Promise<PackageManagerInfo> {
  const checkExists = async (relPath: string) => {
    try {
      await fs.stat(path.join(projectDir, relPath));
      return true;
    } catch {
      return false;
    }
  };

  const nodeLockfiles: Record<string, string> = {
    npm: 'package-lock.json',
    pnpm: 'pnpm-lock.yaml',
    yarn: 'yarn.lock',
  };
  const pythonLockfiles: Record<string, string> = {
    pip: 'requirements.txt',
    uv: 'uv.lock',
    poetry: 'poetry.lock',
  };

  let declaredNodeManager: PackageManagerType | undefined;
  try {
    const packageJson = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8')) as { packageManager?: unknown };
    if (typeof packageJson.packageManager === 'string') {
      const declared = /^(npm|pnpm|yarn)@/.exec(packageJson.packageManager)?.[1] as PackageManagerType | undefined;
      declaredNodeManager = declared;
    }
  } catch {}

  const selected = override ?? declaredNodeManager;
  if (selected && selected in nodeLockfiles) {
    const lockfile = nodeLockfiles[selected];
    return { type: selected, ...(await checkExists(lockfile) ? { lockfile } : {}) };
  }
  if (selected && selected in pythonLockfiles) {
    const lockfile = pythonLockfiles[selected];
    if (await checkExists(lockfile)) return { type: selected, lockfile };
    if (selected === 'uv') {
      if (await checkExists('pyproject.toml')) return { type: selected, lockfile: 'pyproject.toml' };
      if (await checkExists('requirements.txt')) return { type: selected, lockfile: 'requirements.txt' };
    }
    return { type: selected };
  }

  // Check Node.js package managers
  if (await checkExists('pnpm-lock.yaml')) {
    return { type: 'pnpm', lockfile: 'pnpm-lock.yaml' };
  }
  if (await checkExists('yarn.lock')) {
    return { type: 'yarn', lockfile: 'yarn.lock' };
  }
  if (await checkExists('package-lock.json')) {
    return { type: 'npm', lockfile: 'package-lock.json' };
  }

  // Check Python package managers
  if (await checkExists('uv.lock')) {
    return { type: 'uv', lockfile: 'uv.lock' };
  }
  if (await checkExists('poetry.lock')) {
    return { type: 'poetry', lockfile: 'poetry.lock' };
  }
  if (await checkExists('requirements.txt')) {
    return { type: 'pip', lockfile: 'requirements.txt' };
  }
  if (await checkExists('pyproject.toml')) {
    return { type: 'uv', lockfile: 'pyproject.toml' };
  }

  // Fallbacks
  if (await checkExists('package.json')) {
    return { type: 'npm' };
  }

  return { type: 'npm' };
}
