import { execFileSync } from 'node:child_process';

/**
 * Cleanly terminates a process and all of its spawned child processes.
 * On Windows, uses taskkill /pid <PID> /T /F without a shell.
 * On POSIX systems, sends SIGKILL to the process group or process.
 */
export async function killProcessTree(pid: number): Promise<void> {
  if (!pid || pid <= 0) return;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Process might have already exited
    }
  } else {
    // 1. Try killing all spawned child processes via pkill
    try {
      execFileSync('pkill', ['-KILL', '-P', String(pid)], { stdio: 'ignore' });
    } catch {}

    // 2. Try killing the process group (works if spawned with detached: true)
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {}

    // 3. Try killing the process itself
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone
    }
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
