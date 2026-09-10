import { spawn, ChildProcess } from 'node:child_process';
import { killProcessTree } from './process-tree.js';
import { waitForPort } from './ports.js';
import { tokenizeCommandLine, resolveBinaryForPlatform } from './command-parser.js';

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  maxBufferBytes?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  shell?: boolean | string;
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
}

/**
 * Spawns a process securely, avoiding shell invocation whenever possible.
 */
function spawnSecure(command: string, options: CommandOptions): ChildProcess {
  const mergedEnv = {
    ...process.env,
    ...options.env,
    CI: 'true',
    FORCE_COLOR: '0',
  };

  if (options.shell !== undefined) {
    return spawn(command, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell: options.shell,
      windowsHide: true,
    });
  }

  const { executable, args, hasShellOperators } = tokenizeCommandLine(command);

  // If command uses pipes, redirection, or chaining, use explicit shell
  if (hasShellOperators) {
    const shell = process.platform === 'win32' ? true : '/bin/sh';
    return spawn(command, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell,
      windowsHide: true,
    });
  }

  // Direct execution with argument array, no shell injection possible
  const { binary, needsShell } = resolveBinaryForPlatform(executable);
  return spawn(needsShell ? command : binary, needsShell ? [] : args, {
    cwd: options.cwd || process.cwd(),
    env: mergedEnv,
    shell: needsShell,
    windowsHide: true,
  });
}

/**
 * Executes a command safely with argument parsing, timeouts, and buffer caps.
 */
export function execCommand(
  command: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const maxBuffer = options.maxBufferBytes ?? 5 * 1024 * 1024; // 5MB cap
    const timeoutMs = options.timeoutMs ?? 120000;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let timer: NodeJS.Timeout | null = null;

    let child: ChildProcess;
    try {
      child = spawnSecure(command, options);
    } catch (err: unknown) {
      return resolve({
        command,
        exitCode: 1,
        stdout: '',
        stderr: `Failed to spawn process: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: 0,
        timedOut: false,
        killed: false,
      });
    }

    if (timeoutMs > 0) {
      timer = setTimeout(async () => {
        timedOut = true;
        killed = true;
        if (child.pid) {
          await killProcessTree(child.pid);
        }
      }, timeoutMs);
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (stdout.length < maxBuffer) {
        stdout += text;
      }
      options.onStdout?.(text);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (stderr.length < maxBuffer) {
        stderr += text;
      }
      options.onStderr?.(text);
    });

    const finish = (exitCode: number | null) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        command,
        exitCode,
        stdout,
        stderr,
        durationMs,
        timedOut,
        killed,
      });
    };

    child.on('error', (err) => {
      stderr += `\nProcess error: ${err.message}`;
      finish(1);
    });

    child.on('close', (code) => {
      finish(code);
    });
  });
}

/**
 * Executes an executable with explicit argument array (strictly no shell).
 */
export function execFileArgs(
  executable: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const cmdString = [executable, ...args].join(' ');
  return new Promise((resolve) => {
    const startTime = Date.now();
    const maxBuffer = options.maxBufferBytes ?? 5 * 1024 * 1024;
    const timeoutMs = options.timeoutMs ?? 120000;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let timer: NodeJS.Timeout | null = null;

    const mergedEnv = {
      ...process.env,
      ...options.env,
      CI: 'true',
      FORCE_COLOR: '0',
    };

    const { binary } = resolveBinaryForPlatform(executable);
    const child = spawn(binary, args, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell: false,
      windowsHide: true,
    });

    if (timeoutMs > 0) {
      timer = setTimeout(async () => {
        timedOut = true;
        killed = true;
        if (child.pid) {
          await killProcessTree(child.pid);
        }
      }, timeoutMs);
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (stdout.length < maxBuffer) {
        stdout += text;
      }
      options.onStdout?.(text);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (stderr.length < maxBuffer) {
        stderr += text;
      }
      options.onStderr?.(text);
    });

    const finish = (exitCode: number | null) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        command: cmdString,
        exitCode,
        stdout,
        stderr,
        durationMs,
        timedOut,
        killed,
      });
    };

    child.on('error', (err) => {
      stderr += `\nProcess error: ${err.message}`;
      finish(1);
    });

    child.on('close', (code) => {
      finish(code);
    });
  });
}

export interface RunningService {
  pid: number | undefined;
  process: ChildProcess;
  getLogs: () => { stdout: string; stderr: string };
  isAlive: () => boolean;
  kill: () => Promise<void>;
  waitForPort: (port: number, timeoutMs?: number) => Promise<boolean>;
}

/**
 * Spawns a background server service, collects output, and manages cleanup.
 */
export function spawnService(
  command: string,
  options: CommandOptions = {}
): RunningService {
  let stdout = '';
  let stderr = '';
  let exited = false;
  const maxBuffer = options.maxBufferBytes ?? 5 * 1024 * 1024;

  const child = spawnSecure(command, {
    ...options,
    env: {
      ...options.env,
      NODE_ENV: 'production',
      PORT: options.env?.PORT || '3000',
    },
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    if (stdout.length < maxBuffer) {
      stdout += text;
    }
    options.onStdout?.(text);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    if (stderr.length < maxBuffer) {
      stderr += text;
    }
    options.onStderr?.(text);
  });

  child.on('exit', () => {
    exited = true;
  });

  return {
    pid: child.pid,
    process: child,
    getLogs: () => ({ stdout, stderr }),
    isAlive: () => !exited && child.exitCode === null,
    kill: async () => {
      if (child.pid) {
        await killProcessTree(child.pid);
      }
      exited = true;
    },
    waitForPort: async (port: number, timeoutMs = 30000) => {
      return waitForPort(port, { timeoutMs });
    },
  };
}
