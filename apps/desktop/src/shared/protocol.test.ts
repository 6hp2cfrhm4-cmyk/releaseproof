import { describe, expect, it } from 'vitest';
import { parseWorkerEvent, parseWorkerRequest } from './protocol.js';

const runId = 'a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab';

describe('Desktop worker protocol validation', () => {
  it('accepts bounded start and cancel messages and rejects malformed requests', () => {
    expect(parseWorkerRequest({ type: 'start', runId, projectPath: 'C:\\project', target: 'apps/web', timeoutMs: 30000 }))
      .toMatchObject({ type: 'start', runId, target: 'apps/web' });
    expect(parseWorkerRequest({ type: 'cancel' })).toEqual({ type: 'cancel' });
    expect(parseWorkerRequest({ type: 'start', runId, projectPath: '/project', target: '../outside' })).toBeUndefined();
    expect(parseWorkerRequest({ type: 'start', runId: 'not-a-run-id', projectPath: '/project' })).toBeUndefined();
    expect(parseWorkerRequest({ type: 'start', runId, projectPath: '/project', timeoutMs: 900000 })).toBeUndefined();
    expect(parseWorkerRequest({ type: 'start', runId, projectPath: '/project', extra: 'x'.repeat(17 * 1024 * 1024) })).toBeUndefined();
  });

  it('rejects events from another run and oversized/unbounded progress data', () => {
    expect(parseWorkerEvent({ type: 'started', runId }, runId)).toEqual({ type: 'started', runId });
    expect(parseWorkerEvent({ type: 'started', runId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, runId)).toBeUndefined();
    expect(parseWorkerEvent({ type: 'progress', runId, step: 'x'.repeat(161), status: 'running' }, runId)).toBeUndefined();
    expect(parseWorkerEvent({ type: 'progress', runId, step: 'Install', status: 'running', message: 'x'.repeat(4097) }, runId)).toBeUndefined();
  });
});
