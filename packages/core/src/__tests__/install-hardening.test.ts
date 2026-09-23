import { describe, expect, it, vi } from 'vitest';

const execCommand = vi.hoisted(() => vi.fn());
vi.mock('@releaseproof/runner', () => ({ execCommand }));

import { isMissingNativeToolchain, runInstallCheck } from '../checks/install.js';

describe('install failure classification', () => {
  it('recognizes a missing Windows native compiler as unavailable verification capability', () => {
    expect(
      isMissingNativeToolchain(
        'error: Microsoft Visual C++ 14.0 or greater is required. Get it with Microsoft C++ Build Tools'
      )
    ).toBe(true);
  });

  it('recognizes missing POSIX and Rust build toolchains', () => {
    expect(isMissingNativeToolchain("error: command 'gcc' failed: No such file or directory")).toBe(true);
    expect(isMissingNativeToolchain('error: Rust compiler not found')).toBe(true);
  });

  it('does not hide ordinary dependency or application failures', () => {
    expect(isMissingNativeToolchain('npm ERR! package-lock.json is out of date')).toBe(false);
    expect(isMissingNativeToolchain('SyntaxError: invalid syntax in setup.py')).toBe(false);
  });

  it('classifies an install timeout as unavailable verification capability', async () => {
    execCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'registry request still pending',
      durationMs: 180000,
      timedOut: true,
      killed: true,
    });
    const result = await runInstallCheck('workspace', 'npm install');
    expect(result.status).toBe('unknown');
    expect(result.classification).toBe('VERIFICATION_UNAVAILABLE');
    expect(result.metadata).toEqual({ timedOut: true, killed: true });
  });
});
