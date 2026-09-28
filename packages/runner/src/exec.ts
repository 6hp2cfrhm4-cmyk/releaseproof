import { spawn, ChildProcess } from 'node:child_process';
import { killProcessTree } from './process-tree.js';
import { waitForPort } from './ports.js';
import { tokenizeCommandLine, resolveBinaryForPlatform } from './command-parser.js';

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  allowHostEnv?: string[];
  timeoutMs?: number;
  maxBufferBytes?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  shell?: boolean | string;
  signal?: AbortSignal;
}

const BASE_HOST_ENV = [
  'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
  'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA',
];

function appendBounded(current: string, next: string, limit: number): string {
  if (current.length >= limit) return current;
  return current + next.slice(0, limit - current.length);
}

/** Builds the deliberately small host environment exposed to verified code. */
export function buildVerificationEnv(
  overrides: Record<string, string | undefined> = {},
  allowHostEnv: string[] = []
): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of new Set([...BASE_HOST_ENV, ...allowHostEnv])) {
    if (process.env[key] !== undefined) result[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) result[key] = value;
  }
  result.CI = 'true';
  result.FORCE_COLOR = '0';
  return result;
}

export interface CommandResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
  aborted: boolean;
}

/**
 * Spawns a process securely, avoiding shell invocation whenever possible.
 */
function spawnSecure(command: string, options: CommandOptions): ChildProcess {
  const mergedEnv = buildVerificationEnv(options.env, options.allowHostEnv);

  const isWindows = process.platform === 'win32';
  const detached = !isWindows;

  if (options.shell !== undefined) {
    return spawn(command, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell: options.shell,
      detached,
      windowsHide: true,
    });
  }

  const { executable, args, hasShellOperators } = tokenizeCommandLine(command);

  // If command uses pipes, redirection, or chaining, use explicit shell
  if (hasShellOperators) {
    const shell = isWindows ? true : '/bin/sh';
    return spawn(command, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell,
      detached,
      windowsHide: true,
    });
  }

  // Direct execution with argument array, no shell injection possible
  const { binary, needsShell } = resolveBinaryForPlatform(executable);
  return spawn(needsShell ? command : binary, needsShell ? [] : args, {
    cwd: options.cwd || process.cwd(),
    env: mergedEnv,
    shell: needsShell,
    detached,
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
    if (options.signal?.aborted) {
      resolve({ command, exitCode: null, stdout: '', stderr: '', durationMs: 0, timedOut: false, killed: false, aborted: true });
      return;
    }
    const maxBuffer = options.maxBufferBytes ?? 5 * 1024 * 1024; // 5MB cap
    const timeoutMs = options.timeoutMs ?? 120000;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let aborted = false;
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
        aborted: false,
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
      const captured = text.slice(0, Math.max(0, maxBuffer - stdout.length));
      stdout = appendBounded(stdout, text, maxBuffer);
      if (captured) options.onStdout?.(captured);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const captured = text.slice(0, Math.max(0, maxBuffer - stderr.length));
      stderr = appendBounded(stderr, text, maxBuffer);
      if (captured) options.onStderr?.(captured);
    });

    const finish = (exitCode: number | null) => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      const durationMs = Date.now() - startTime;
      resolve({
        command,
        exitCode,
        stdout,
        stderr,
        durationMs,
        timedOut,
        killed,
        aborted,
      });
    };

    const onAbort = () => {
      aborted = true;
      killed = true;
      if (child.pid) void killProcessTree(child.pid);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

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
    if (options.signal?.aborted) {
      resolve({ command: cmdString, exitCode: null, stdout: '', stderr: '', durationMs: 0, timedOut: false, killed: false, aborted: true });
      return;
    }
    const maxBuffer = options.maxBufferBytes ?? 5 * 1024 * 1024;
    const timeoutMs = options.timeoutMs ?? 120000;

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let aborted = false;
    let timer: NodeJS.Timeout | null = null;

    const mergedEnv = buildVerificationEnv(options.env, options.allowHostEnv);

    const { binary } = resolveBinaryForPlatform(executable);
    const detached = process.platform !== 'win32';
    const child = spawn(binary, args, {
      cwd: options.cwd || process.cwd(),
      env: mergedEnv,
      shell: false,
      detached,
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
      const captured = text.slice(0, Math.max(0, maxBuffer - stdout.length));
      stdout = appendBounded(stdout, text, maxBuffer);
      if (captured) options.onStdout?.(captured);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const captured = text.slice(0, Math.max(0, maxBuffer - stderr.length));
      stderr = appendBounded(stderr, text, maxBuffer);
      if (captured) options.onStderr?.(captured);
    });

    const finish = (exitCode: number | null) => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      options.signal?.removeEventListener('abort', onAbort);
      const durationMs = Date.now() - startTime;
      resolve({
        command: cmdString,
        exitCode,
        stdout,
        stderr,
        durationMs,
        timedOut,
        killed,
        aborted,
      });
    };

    const onAbort = () => {
      aborted = true;
      killed = true;
      if (child.pid) void killProcessTree(child.pid);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

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
  aborted: () => boolean;
}

/**
 * Spawns a background server service, collects output, and manages cleanup.
 */
export function spawnService(
  command: string,
  options: CommandOptions = {}
): RunningService {
  if (options.signal?.aborted) {
    const error = new Error('Operation cancelled before process startup.');
    error.name = 'AbortError';
    throw error;
  }
  let stdout = '';
  let stderr = '';
  let exited = false;
  let aborted = false;
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
    const captured = text.slice(0, Math.max(0, maxBuffer - stdout.length));
    stdout = appendBounded(stdout, text, maxBuffer);
    if (captured) options.onStdout?.(captured);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    const captured = text.slice(0, Math.max(0, maxBuffer - stderr.length));
    stderr = appendBounded(stderr, text, maxBuffer);
    if (captured) options.onStderr?.(captured);
  });

  child.on('exit', () => {
    exited = true;
  });

  child.on('error', (err) => {
    stderr += `\nProcess error: ${err.message}`;
    exited = true;
  });

  const onAbort = () => {
    aborted = true;
    if (child.pid) void killProcessTree(child.pid);
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  child.once('close', () => options.signal?.removeEventListener('abort', onAbort));

  return {
    pid: child.pid,
    process: child,
    getLogs: () => ({ stdout, stderr }),
    isAlive: () => !exited && child.exitCode === null,
    aborted: () => aborted,
    kill: async () => {
      if (child.pid) {
        await killProcessTree(child.pid);
      }
      exited = true;
    },
    waitForPort: async (port: number, timeoutMs = 30000) => {
      return waitForPort(port, { timeoutMs, abortSignal: options.signal });
    },
  };
}
