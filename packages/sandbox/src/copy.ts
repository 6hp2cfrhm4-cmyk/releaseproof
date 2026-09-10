import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const DEFAULT_EXCLUDES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.venv',
  'venv',
  '__pycache__',
  '.git',
  '.turbo',
  '.cache',
  '.releaseproof',
  '.temp',
  '.DS_Store',
  'Thumbs.db',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
]);

export interface CopyOptions {
  excludes?: Set<string>;
  onFileCopied?: (relPath: string) => void;
  maxFiles?: number;
}

/**
 * Recursively copies a directory tree while strictly isolating from cached/built host artifacts
 * and protecting against symlink path traversal attacks.
 */
export async function copyWorkspaceClean(
  sourceDir: string,
  targetDir: string,
  options: CopyOptions = {}
): Promise<{ copiedFilesCount: number }> {
  const excludes = options.excludes ?? DEFAULT_EXCLUDES;
  const maxFiles = options.maxFiles ?? 50000;
  const canonicalSource = await fs.realpath(sourceDir);
  const visitedDirs = new Set<string>();
  let copiedFilesCount = 0;

  async function copyRecursive(currentSource: string, currentTarget: string) {
    if (copiedFilesCount >= maxFiles) {
      throw new Error(`Workspace copy exceeded maximum file limit of ${maxFiles}`);
    }

    const realSource = await fs.realpath(currentSource).catch(() => currentSource);
    if (visitedDirs.has(realSource)) {
      return; // Circular directory link prevented
    }
    visitedDirs.add(realSource);

    await fs.mkdir(currentTarget, { recursive: true });
    let entries;
    try {
      entries = await fs.readdir(currentSource, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excludes.has(entry.name)) {
        continue;
      }

      const srcPath = path.join(currentSource, entry.name);
      const destPath = path.join(currentTarget, entry.name);

      // Verify destPath remains inside targetDir (path traversal defense)
      const relToTarget = path.relative(targetDir, destPath);
      if (relToTarget.startsWith('..') || path.isAbsolute(relToTarget)) {
        continue;
      }

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
        copiedFilesCount++;
        options.onFileCopied?.(path.relative(sourceDir, srcPath));
      } else if (entry.isSymbolicLink()) {
        try {
          const resolvedPath = await fs.realpath(srcPath);
          const relToRoot = path.relative(canonicalSource, resolvedPath);

          // Path traversal check: if symlink points outside source root, ignore it!
          if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
            continue;
          }

          const stat = await fs.stat(resolvedPath);
          if (stat.isFile()) {
            await fs.copyFile(resolvedPath, destPath);
            copiedFilesCount++;
          }
        } catch {
          // Skip broken symlinks safely
        }
      }
    }
  }

  await copyRecursive(sourceDir, targetDir);
  return { copiedFilesCount };
}
