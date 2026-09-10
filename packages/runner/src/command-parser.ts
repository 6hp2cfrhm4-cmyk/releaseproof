import * as path from 'node:path';

/**
 * Splits a command line string into [executable, ...args] respecting quoted substrings.
 */
export function tokenizeCommandLine(cmd: string): { executable: string; args: string[]; hasShellOperators: boolean } {
  const trimmed = cmd.trim();
  const hasShellOperators = /[&|><;]/.test(trimmed);

  const tokens: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingle) {
      escaped = true;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (/\s/.test(char) && !inDouble && !inSingle) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  const executable = tokens[0] || '';
  const args = tokens.slice(1);

  return { executable, args, hasShellOperators };
}

/**
 * Resolves standard CLI tools on Windows (e.g. npm -> npm.cmd, pnpm -> pnpm.cmd)
 * so they can be executed safely without invoking a shell.
 */
export function resolveBinaryForPlatform(bin: string): { binary: string; needsShell: boolean } {
  if (process.platform !== 'win32') {
    return { binary: bin, needsShell: false };
  }

  const base = path.basename(bin).toLowerCase();
  const nodeCliTools = new Set(['npm', 'pnpm', 'yarn', 'npx', 'corepack']);

  if (nodeCliTools.has(base) || base.endsWith('.cmd') || base.endsWith('.bat')) {
    return { binary: bin, needsShell: true };
  }

  return { binary: bin, needsShell: false };
}
