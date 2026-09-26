import { verifyProject } from '@releaseproof/core';
import { generateHtmlReport, generateAiHandoffMarkdown } from '@releaseproof/reporter';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RunEvent, WorkerEvent } from '../shared/ipc.js';

let active: AbortController | undefined;
type StartMessage = { runId: string; projectPath: string; target?: string; timeoutMs?: number; cleanWorkspace?: boolean };
process.on('message', async (message: StartMessage | { type: 'cancel' }) => {
  if ('type' in message && message.type === 'cancel') { active?.abort(); return; }
  if (!('runId' in message) || !message.runId || !message.projectPath) return;
  const runId = message.runId;
  active = new AbortController();
  const emit = (event: WorkerEvent) => process.send?.({ ...event, runId } satisfies RunEvent);
  emit({ type: 'started' });
  try {
    const report = await verifyProject({
      projectDir: message.projectPath,
      config: { ...(message.target ? { target: message.target } : {}), start: { timeoutMs: message.timeoutMs ?? 30000 } },
      skipSandbox: message.cleanWorkspace === false,
      signal: active.signal,
      onProgress: (step, status, detail) => emit({ type: 'progress', step, status, message: detail }),
    });
    // Core paths are display-oriented and may be relative to process.cwd().
    // Desktop artifacts are always rooted in the selected project.
    if (report.htmlReportPath) await atomic(path.join(message.projectPath, '.releaseproof', 'report.html'), generateHtmlReport(report));
    if (report.fixPromptPath) await atomic(path.join(message.projectPath, '.releaseproof', 'RELEASEPROOF_FIX.md'), generateAiHandoffMarkdown(report));
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

async function atomic(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, file);
}
