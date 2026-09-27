import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** Resolve an optional report directory without allowing it to escape the project's managed artifact root. */
export async function resolveArtifactDirectory(projectDir: string, outputDir?: string): Promise<string> {
  const projectRoot = await fs.realpath(path.resolve(projectDir));
  if (!(await fs.stat(projectRoot)).isDirectory()) throw new Error('Selected project path is not a directory.');
  const managedRoot = path.join(projectRoot, '.releaseproof');

  let candidate = managedRoot;
  if (outputDir !== undefined) {
    if (typeof outputDir !== 'string' || outputDir.length === 0 || outputDir.length > 4096 || outputDir.includes('\0')) {
      throw new Error('--output-dir must be a non-empty relative path of at most 4096 characters.');
    }
    if (path.isAbsolute(outputDir) || path.win32.isAbsolute(outputDir) || /^[A-Za-z]:/.test(outputDir)) {
      throw new Error('--output-dir must be relative to the project and inside .releaseproof/.');
    }
    if (outputDir.replace(/\\/g, '/').split('/').some((segment) => segment === '..')) {
      throw new Error('--output-dir cannot contain a parent-directory traversal.');
    }
    candidate = path.resolve(projectRoot, outputDir);
  }

  const relativeToManagedRoot = path.relative(managedRoot, candidate);
  if (relativeToManagedRoot !== '' && (relativeToManagedRoot === '..'
    || relativeToManagedRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToManagedRoot))) {
    throw new Error('--output-dir must resolve to .releaseproof/ or one of its subdirectories.');
  }

  let canonicalManagedRoot = managedRoot;
  try {
    const managedStat = await fs.lstat(managedRoot);
    canonicalManagedRoot = await fs.realpath(managedRoot);
    if (!managedStat.isDirectory() || !isWithin(projectRoot, canonicalManagedRoot)) {
      throw new Error('.releaseproof must be a real directory inside the selected project.');
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  let current = candidate;
  const missingSegments: string[] = [];
  while (true) {
    try {
      const stat = await fs.lstat(current);
      const canonicalCurrent = await fs.realpath(current);
      const canonicalCandidate = path.resolve(canonicalCurrent, ...missingSegments);
      if (!isWithin(canonicalManagedRoot, canonicalCandidate)) {
        throw new Error('--output-dir resolves through a symlink outside the managed .releaseproof/ directory.');
      }
      if (current === candidate && !stat.isDirectory()) throw new Error('--output-dir exists but is not a directory.');
      return candidate;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error('--output-dir could not be resolved safely.');
    missingSegments.unshift(path.basename(current));
    current = parent;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
