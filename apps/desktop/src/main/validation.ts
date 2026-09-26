import * as path from 'node:path';
import type { DesktopSettings } from '../shared/ipc.js';

export function assertAbsoluteProjectPath(value: unknown): string {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error('A canonical absolute project path is required.');
  }
  const normalized = path.normalize(value);
  if (normalized.includes('\0')) throw new Error('Project path contains an invalid character.');
  return normalized;
}

export function validateRunInput(value: unknown): { projectPath: string; target?: string; trusted: true; timeoutMs?: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Verification input must be an object.');
  const input = value as Record<string, unknown>;
  const projectPath = assertAbsoluteProjectPath(input.projectPath);
  if (input.trusted !== true) throw new Error('Trust acknowledgement is required before executing project code.');
  let target: string | undefined;
  if (input.target !== undefined) {
    if (typeof input.target !== 'string' || !input.target.trim() || path.isAbsolute(input.target) || input.target.includes('\0')) {
      throw new Error('Target must be a non-empty relative path inside the selected project.');
    }
    target = input.target;
  }
  let timeoutMs: number | undefined;
  if (input.timeoutMs !== undefined) {
    if (typeof input.timeoutMs !== 'number' || !Number.isFinite(input.timeoutMs)) throw new Error('Timeout must be a finite number.');
    timeoutMs = Math.max(1000, Math.min(600000, Math.round(input.timeoutMs)));
  }
  return { projectPath, ...(target ? { target } : {}), trusted: true, ...(timeoutMs ? { timeoutMs } : {}) };
}

export function validateSettingsPatch(raw: unknown): Partial<DesktopSettings> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Settings update must be an object.');
  const patch = raw as Partial<DesktopSettings>;
  if (patch.theme !== undefined && !['system', 'dark', 'light'].includes(patch.theme)) throw new Error('Unknown theme.');
  if (patch.cleanWorkspace !== undefined && typeof patch.cleanWorkspace !== 'boolean') throw new Error('cleanWorkspace must be boolean.');
  if (patch.defaultTimeoutMs !== undefined && (typeof patch.defaultTimeoutMs !== 'number' || !Number.isFinite(patch.defaultTimeoutMs))) throw new Error('defaultTimeoutMs must be numeric.');
  return {
    ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
    ...(patch.cleanWorkspace !== undefined ? { cleanWorkspace: patch.cleanWorkspace } : {}),
    ...(patch.defaultTimeoutMs !== undefined ? { defaultTimeoutMs: patch.defaultTimeoutMs } : {}),
  };
}

export function validateArtifactKind(value: unknown): 'html' | 'fix' | 'directory' {
  if (value !== 'html' && value !== 'fix' && value !== 'directory') throw new Error('Unknown artifact type.');
  return value;
}
