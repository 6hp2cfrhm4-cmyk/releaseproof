import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { copyWorkspaceClean, CopyOptions } from './copy.js';

export interface CleanWorkspace {
  id: string;
  path: string;
  originalPath: string;
  fileCount: number;
  dispose: () => Promise<void>;
}

/**
 * Creates an isolated, clean-room workspace in temporary storage.
 * Strictly isolates verification from existing developer artifacts.
 */
export async function createCleanWorkspace(
  originalPath: string,
  options: CopyOptions = {}
): Promise<CleanWorkspace> {
  const id = randomBytes(6).toString('hex');
  const tempDir = path.join(os.tmpdir(), `releaseproof-${id}`);

  await fs.mkdir(tempDir, { recursive: true });

  const { copiedFilesCount } = await copyWorkspaceClean(originalPath, tempDir, options);

  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    try {
      await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      // Ignore cleanup error on exit
    }
  };

  return {
    id,
    path: tempDir,
    originalPath,
    fileCount: copiedFilesCount,
    dispose,
  };
}
