import { describe, expect, it, vi } from 'vitest';

const execCommand = vi.hoisted(() => vi.fn());
vi.mock('@releaseproof/runner', () => ({ execCommand }));

import { isIncompatiblePackageManager, isMissingNativeToolchain, isPackageManagerPolicyUnavailable, isUnsupportedVerificationPlatform, runInstallCheck } from '../checks/install.js';

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
    expect(isMissingNativeToolchain('maturin failed to build wheel for pydantic-core')).toBe(true);
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

  it('recognizes a package manager that cannot parse the committed lockfile', () => {
    expect(isIncompatiblePackageManager('ERR_PNPM_BROKEN_LOCKFILE\nThe lockfileVersion of 6.0 is incompatible with the supported formats')).toBe(true);
    expect(isIncompatiblePackageManager('ERR_PNPM_OUTDATED_LOCKFILE: package manifest changed')).toBe(false);
  });

  it('recognizes dependency build scripts blocked by the host package-manager policy', () => {
    expect(isPackageManagerPolicyUnavailable('ERR_PNPM_IGNORED_BUILDS\nIgnored build scripts: sharp')).toBe(true);
    expect(isPackageManagerPolicyUnavailable('npm ERR! build script failed with exit code 1')).toBe(false);
  });

  it('recognizes a dependency that explicitly does not support the verifier OS', () => {
    expect(isUnsupportedVerificationPlatform('RuntimeError: uvloop does not support Windows at the moment')).toBe(true);
    expect(isUnsupportedVerificationPlatform('\u001b[1;31mRuntimeError\u001b[0m: \u001b[35muvloop does not support Windows at the moment\u001b[0m')).toBe(true);
    expect(isUnsupportedVerificationPlatform('RuntimeError: invalid application configuration')).toBe(false);
  });
});
