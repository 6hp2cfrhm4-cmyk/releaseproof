import { describe, expect, it } from 'vitest';
import { assertAbsoluteProjectPath, validateArtifactKind, validateRunInput, validateSettingsPatch } from '../main/validation.js';

describe('desktop IPC validation', () => {
  const projectPath = process.platform === 'win32' ? 'C:\\project' : '/project';

  it('requires trust and keeps targets relative to the selected project', () => {
    expect(() => validateRunInput({ projectPath, trusted: false })).toThrow(/Trust acknowledgement/);
    expect(() => validateRunInput({ projectPath, trusted: true, target: process.platform === 'win32' ? 'C:\\other' : '/other' })).toThrow(/relative path/);
    expect(() => validateRunInput({ projectPath, trusted: true, target: '../outside' })).toThrow(/relative path/);
    expect(() => validateRunInput({ projectPath, trusted: true, target: 'apps\\..\\outside' })).toThrow(/relative path/);
    expect(() => validateRunInput({ projectPath, trusted: true, target: 'C:outside' })).toThrow(/relative path/);
    expect(validateRunInput({ projectPath, trusted: true, target: 'apps/web', timeoutMs: 999999 })).toEqual({
      projectPath, target: 'apps/web', trusted: true, timeoutMs: 600000,
    });
  });

  it('rejects non-absolute paths and unknown artifact operations', () => {
    expect(() => assertAbsoluteProjectPath('.')).toThrow(/absolute/);
    expect(validateArtifactKind('html')).toBe('html');
    expect(() => validateArtifactKind('shell')).toThrow(/Unknown artifact/);
  });

  it('accepts only the persisted non-secret settings fields', () => {
    expect(validateSettingsPatch({ theme: 'light', cleanWorkspace: false, defaultTimeoutMs: 5000, secret: 'discard' })).toEqual({
      theme: 'light', cleanWorkspace: false, defaultTimeoutMs: 5000,
    });
    expect(() => validateSettingsPatch({ theme: 'neon' })).toThrow(/Unknown theme/);
  });
});
