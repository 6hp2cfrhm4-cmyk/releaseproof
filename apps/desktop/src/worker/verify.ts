import * as path from 'node:path';
import { verifyProject } from '@releaseproof/core';
import { publishReportArtifacts } from '@releaseproof/reporter';
import type { WorkerEvent } from '../shared/ipc.js';
import { parseWorkerRequest, toWorkerRunEvent } from '../shared/protocol.js';

let active: AbortController | undefined;
process.on('message', async (rawMessage: unknown) => {
  const message = parseWorkerRequest(rawMessage);
  if (!message) return;
  if (message.type === 'cancel') { active?.abort(); return; }
  const runId = message.runId;
  active = new AbortController();
  const emit = (event: WorkerEvent) => process.send?.(toWorkerRunEvent(event, runId));
  emit({ type: 'started' });
  try {
    const report = await verifyProject({
      projectDir: message.projectPath,
      config: { ...(message.target ? { target: message.target } : {}), start: { timeoutMs: message.timeoutMs ?? 30000 } },
      skipSandbox: message.cleanWorkspace === false,
      signal: active.signal,
      onProgress: (step, status, detail) => emit({ type: 'progress', step, status, message: detail }),
    });
    await publishReportArtifacts(report, path.join(message.projectPath, '.releaseproof'));
    emit({ type: 'finished', report });
  } catch (error) {
    emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    active = undefined;
    // A forked worker must terminate after one verification. Keeping the IPC
    // listener alive would leave an orphan utility process after success,
    // failure, or cancellation.
    setTimeout(() => {
      if (process.connected) process.disconnect();
    }, 0).unref();
  }
});
