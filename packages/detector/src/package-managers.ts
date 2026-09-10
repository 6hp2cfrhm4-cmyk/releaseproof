import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PackageManagerInfo } from '@releaseproof/schemas';

export async function detectPackageManager(projectDir: string): Promise<PackageManagerInfo> {
  const checkExists = async (relPath: string) => {
    try {
      await fs.stat(path.join(projectDir, relPath));
      return true;
    } catch {
      return false;
    }
  };

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
