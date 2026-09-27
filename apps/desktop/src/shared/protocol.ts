import { VerificationReportSchema } from '@releaseproof/schemas';
import type { RunEvent, WorkerEvent } from './ipc.js';

export type WorkerRequest =
  | { type: 'start'; runId: string; projectPath: string; target?: string; timeoutMs?: number; cleanWorkspace?: boolean }
  | { type: 'cancel' };

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROTOCOL_BYTES = 16 * 1024 * 1024;
const MAX_PHASE_TEXT = 160;
const MAX_DETAIL_TEXT = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withinProtocolLimit(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    return serialized !== undefined && Buffer.byteLength(serialized, 'utf8') <= MAX_PROTOCOL_BYTES;
  } catch {
    return false;
  }
}

function isRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID_PATTERN.test(value);
}

function isSafeRelativeTarget(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 1024
    && !value.includes('\0')
    && !/^[A-Za-z]:/.test(value)
    && !value.startsWith('/')
    && !value.startsWith('\\')
    && !value.replace(/\\/g, '/').split('/').some((segment) => segment === '..');
}

/** Runtime-validate main-to-worker messages; TypeScript types are not an IPC boundary. */
export function parseWorkerRequest(value: unknown): WorkerRequest | undefined {
  if (!withinProtocolLimit(value) || !isRecord(value)) return undefined;
  if (value.type === 'cancel') return { type: 'cancel' };
  if (value.type !== 'start' || !isRunId(value.runId)
    || typeof value.projectPath !== 'string' || value.projectPath.length > 32768 || value.projectPath.includes('\0')
    || !isAbsolutePath(value.projectPath)) return undefined;
  if (value.target !== undefined && !isSafeRelativeTarget(value.target)) return undefined;
  if (value.timeoutMs !== undefined && (typeof value.timeoutMs !== 'number' || !Number.isFinite(value.timeoutMs)
    || value.timeoutMs < 1000 || value.timeoutMs > 600000)) return undefined;
  if (value.cleanWorkspace !== undefined && typeof value.cleanWorkspace !== 'boolean') return undefined;
  return {
    type: 'start',
    runId: value.runId,
    projectPath: value.projectPath,
    ...(typeof value.target === 'string' ? { target: value.target } : {}),
    ...(typeof value.timeoutMs === 'number' ? { timeoutMs: value.timeoutMs } : {}),
    ...(typeof value.cleanWorkspace === 'boolean' ? { cleanWorkspace: value.cleanWorkspace } : {}),
  };
}

/** Runtime-validate and bound worker-to-main events before forwarding to renderer. */
export function parseWorkerEvent(value: unknown, expectedRunId: string): RunEvent | undefined {
  if (!withinProtocolLimit(value) || !isRecord(value) || value.runId !== expectedRunId || !isRunId(value.runId)) return undefined;
  if (value.type === 'started') return { type: 'started', runId: value.runId };
  if (value.type === 'progress') {
    if (typeof value.step !== 'string' || value.step.length > MAX_PHASE_TEXT
      || !['running', 'done', 'fail'].includes(String(value.status))
      || (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > MAX_DETAIL_TEXT))) return undefined;
    return {
      type: 'progress', runId: value.runId, step: value.step,
      status: value.status as Extract<RunEvent, { type: 'progress' }>['status'],
      ...(typeof value.message === 'string' ? { message: value.message } : {}),
    };
  }
  if (value.type === 'error') {
    if (typeof value.message !== 'string' || value.message.length > MAX_DETAIL_TEXT) return undefined;
    return { type: 'error', runId: value.runId, message: value.message };
  }
  if (value.type === 'finished') {
    const report = VerificationReportSchema.safeParse(value.report);
    if (!report.success) return undefined;
    return { type: 'finished', runId: value.runId, report: report.data };
  }
  return undefined;
}

export function toWorkerRunEvent(event: WorkerEvent, runId: string): RunEvent {
  return { ...event, runId } as RunEvent;
}

function isAbsolutePath(value: string): boolean {
  // Avoid importing platform-specific path behavior into this shared protocol.
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
}
