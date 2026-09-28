import type { RunEvent } from '../shared/ipc.js';

export interface WorkerRunState {
  cancelling?: boolean;
  terminal?: boolean;
}

/** Convert an unexpected worker exit into a terminal error, never a report. */
export function handleWorkerExit(
  runId: string,
  code: number | null,
  state: WorkerRunState,
  emit: (event: RunEvent) => void,
): void {
  if (state.terminal) return;
  state.terminal = true;
  emit({
    type: 'error',
    runId,
    message: state.cancelling
      ? 'Verification worker stopped before cancellation completed.'
      : `Verification worker exited with code ${code ?? 'unknown'}.`,
  });
}
