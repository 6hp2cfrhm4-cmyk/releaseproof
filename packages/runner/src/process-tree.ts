import { execFileSync } from 'node:child_process';

/**
 * Cleanly terminates a process and all of its spawned child processes.
 * On Windows, uses taskkill /pid <PID> /T /F without a shell.
 * On POSIX systems, sends SIGKILL to the process group or process.
 */
export async function killProcessTree(pid: number, graceMs = 1500): Promise<void> {
  if (!pid || pid <= 0 || pid === process.pid) return;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T'], { stdio: 'ignore', timeout: 3000 });
    } catch {
      // Process might have already exited
    }
    if (await waitForExit(pid, graceMs)) return;
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 3000 });
    } catch {
      // Process might have exited between the graceful and forceful attempts.
    }
  } else {
    // POSIX children are launched detached, so signal the owned process group.
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {}
    // Fallback for callers that did not create a process group.
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone or no permission; verify before force-killing.
    }
    if (await waitForExit(pid, graceMs)) return;
    try { process.kill(-pid, 'SIGKILL'); } catch {}
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }

  await waitForExit(pid, Math.max(500, graceMs));
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isOwnedProcessGroupAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !isOwnedProcessGroupAlive(pid);
}

function isOwnedProcessGroupAlive(pid: number): boolean {
  if (isProcessAlive(pid)) return true;
  if (process.platform === 'win32') return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err: unknown) {
    return (err as { code?: string }).code === 'EPERM';
  }
}

/**
 * Checks if a process with the given PID is currently alive.
 */
export function isProcessAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    // EPERM means process exists but we don't have permission -> it is alive
    const code = (err as { code?: string }).code;
    return code === 'EPERM';
  }
}
