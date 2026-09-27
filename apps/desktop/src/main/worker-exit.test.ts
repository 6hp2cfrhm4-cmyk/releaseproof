import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { RunEvent } from '../shared/ipc.js';
import { handleWorkerExit } from './worker-exit.js';

describe('Desktop worker exit handling', () => {
  it('turns a real unexpected worker crash into one terminal error and never READY', async () => {
    const runId = 'worker-crash-regression';
    const worker = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(23), 25)'], {
      stdio: 'ignore',
    });
    const state: { terminal?: boolean } = {};
    const events: RunEvent[] = [];

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      worker.once('error', reject);
      worker.once('exit', resolve);
    });
    handleWorkerExit(runId, exitCode, state, (event) => events.push(event));
    handleWorkerExit(runId, exitCode, state, (event) => events.push(event));

    expect(exitCode).toBe(23);
    expect(state.terminal).toBe(true);
    expect(events).toEqual([{
      type: 'error',
      runId,
      message: 'Verification worker exited with code 23.',
    }]);
    expect(events.some((event) => event.type === 'finished')).toBe(false);
  });

  it('reports a cancellation-time exit as incomplete cleanup, not a successful cancel', () => {
    const events: RunEvent[] = [];
    handleWorkerExit('cancelled-run', null, { cancelling: true }, (event) => events.push(event));

    expect(events).toEqual([{
      type: 'error',
      runId: 'cancelled-run',
      message: 'Verification worker stopped before cancellation completed.',
    }]);
  });
});
