import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fork, ChildProcess, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { detectProject } from '@releaseproof/detector';
import { VerificationReportSchema } from '@releaseproof/schemas';
import { generateAiHandoffMarkdown, generateFindingHandoffMarkdown } from '@releaseproof/reporter';
import type { DesktopSettings, DetectionPreview, RunEvent } from '../shared/ipc.js';
import { assertAbsoluteProjectPath, validateArtifactKind, validateRunInput, validateSettingsPatch } from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSettings: DesktopSettings = { theme: 'system', defaultTimeoutMs: 30000, cleanWorkspace: true };
const execFileAsync = promisify(execFile);
const runs = new Map<string, { projectPath: string; report?: ReturnType<typeof VerificationReportSchema.parse>; worker?: ChildProcess; cancelling?: boolean; terminal?: boolean }>();
let mainWindow: BrowserWindow | undefined;
let settingsCache: DesktopSettings = defaultSettings;

function settingsPath(): string { return path.join(app.getPath('userData'), 'settings.json'); }
function recentPath(): string { return path.join(app.getPath('userData'), 'recent.json'); }

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch { return fallback; }
}
async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}
function send(event: RunEvent): void { mainWindow?.webContents.send('run:event', event); }
function assertRun(runId: unknown) {
  if (typeof runId !== 'string' || !runs.has(runId)) throw new Error('Unknown verification run.');
  return runs.get(runId)!;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#111318',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.NODE_ENV === 'development') await mainWindow.loadURL('http://127.0.0.1:5178');
  else await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = undefined; });
}

function registerIpc(): void {
  ipcMain.handle('project:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle('project:preview', async (_event, projectPath: unknown): Promise<DetectionPreview> => {
    const canonical = assertAbsoluteProjectPath(projectPath);
    const profile = await detectProject(canonical);
    const recent = await readJson<string[]>(recentPath(), []);
    await writeJson(recentPath(), [canonical, ...recent.filter((item) => item !== canonical)].slice(0, 8));
    return { projectPath: canonical, profile, trustRequired: true };
  });
  ipcMain.handle('run:start', async (_event, rawInput: unknown) => {
    const input = validateRunInput(rawInput);
    const projectPath = input.projectPath;
    try {
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) throw new Error('Selected project path is not a directory.');
    } catch (error) {
      if (error instanceof Error && error.message === 'Selected project path is not a directory.') throw error;
      throw new Error('Selected project directory does not exist or is not accessible.');
    }
    const runId = randomUUID();
    const workerPath = path.join(__dirname, '../worker/verify.js');
    const worker = fork(workerPath, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    runs.set(runId, { projectPath, worker });
    worker.on('message', (event: RunEvent) => {
      if (event.type === 'finished') {
        try {
          const parsed = VerificationReportSchema.parse(event.report);
          const run = runs.get(runId);
          if (run) { run.report = parsed; run.terminal = true; }
          send({ ...event, report: parsed });
          if (run?.worker?.connected) run.worker.disconnect();
          if (run) run.worker = undefined;
        } catch (error) {
          send({ type: 'error', runId, message: `Verification report was invalid: ${error instanceof Error ? error.message : String(error)}` });
        }
      } else send(event);
    });
    worker.on('error', (error) => {
      const run = runs.get(runId);
      if (run && !run.terminal) {
        run.terminal = true;
        send({ type: 'error', runId, message: `Verification worker failed: ${error.message}` });
      }
    });
    worker.on('exit', (code) => {
      const run = runs.get(runId);
      if (run && !run.terminal) {
        run.terminal = true;
        send({ type: 'error', runId, message: run.cancelling ? 'Verification worker stopped before cancellation completed.' : `Verification worker exited with code ${code ?? 'unknown'}.` });
      }
      if (run) run.worker = undefined;
    });
    worker.send({ runId, projectPath, target: input.target, timeoutMs: input.timeoutMs ?? settingsCache.defaultTimeoutMs, cleanWorkspace: settingsCache.cleanWorkspace });
    return runId;
  });
  ipcMain.handle('run:cancel', async (_event, runId: unknown) => {
    const run = assertRun(runId);
    const verifiedRunId = runId as string;
    if (run.cancelling) return;
    run.cancelling = true;
    run.worker?.send({ type: 'cancel' });
    setTimeout(() => {
      if (run.worker && !run.worker.killed && !run.terminal) {
        run.worker.kill();
        run.terminal = true;
        send({ type: 'error', runId: verifiedRunId, message: 'Verification cancellation timed out; the worker was terminated.' });
      }
    }, 5000).unref();
  });
  ipcMain.handle('settings:get', async () => settingsCache);
  ipcMain.handle('settings:update', async (_event, rawPatch: unknown) => {
    const patch = validateSettingsPatch(rawPatch);
    settingsCache = {
      theme: patch.theme ?? settingsCache.theme,
      cleanWorkspace: patch.cleanWorkspace ?? settingsCache.cleanWorkspace,
      defaultTimeoutMs: Math.max(1000, Math.min(600000, Number(patch.defaultTimeoutMs ?? settingsCache.defaultTimeoutMs))),
    };
    await writeJson(settingsPath(), settingsCache);
    return settingsCache;
  });
  ipcMain.handle('recent:list', async () => readJson<string[]>(recentPath(), []));
  ipcMain.handle('recent:remove', async (_event, projectPath: unknown) => {
    const value = assertAbsoluteProjectPath(projectPath);
    const recent = (await readJson<string[]>(recentPath(), [])).filter((item) => item !== value);
    await writeJson(recentPath(), recent.slice(0, 8));
  });
  ipcMain.handle('doctor:run', async (_event, projectPath: unknown) => {
    const canonical = assertAbsoluteProjectPath(projectPath);
    const profile = await detectProject(canonical);
    const needsNode = profile.languages.some((language) => language === 'javascript' || language === 'typescript');
    const needsPython = profile.languages.includes('python');
    const capabilities = await Promise.all([
      probeTool('node', process.platform === 'win32' ? 'node.exe' : 'node', ['--version'], needsNode, 'Install Node.js 20 or newer for project verification.'),
      ...(needsPython ? [probeTool('python', process.platform === 'win32' ? 'python.exe' : 'python3', ['--version'], true, 'Install Python 3.11+ or configure an explicit interpreter.')] : []),
      ...(profile.packageManagers.some((manager) => manager.type === 'pnpm') ? [probeTool('pnpm', 'pnpm', ['--version'], true, 'Install pnpm or enable Corepack.')] : []),
      ...(profile.packageManagers.some((manager) => manager.type === 'yarn') ? [probeTool('yarn', 'yarn', ['--version'], true, 'Install Yarn or enable Corepack.')] : []),
    ]);
    return { capabilities, ready: capabilities.every((capability) => !capability.required || capability.available) };
  });
  ipcMain.handle('artifact:open', async (_event, runId: unknown, kind: unknown) => {
    const run = assertRun(runId);
    if (!run.report) throw new Error('The verification report is not ready.');
    const artifactKind = validateArtifactKind(kind);
    const root = path.resolve(run.projectPath);
    const target = artifactKind === 'directory' ? path.join(root, '.releaseproof') : path.join(root, '.releaseproof', artifactKind === 'html' ? 'report.html' : 'RELEASEPROOF_FIX.md');
    await fs.access(target);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Artifact path is outside the selected project.');
    if (kind === 'directory') await shell.openPath(target); else await shell.openPath(target);
  });
  ipcMain.handle('artifact:copy', async (_event, runId: unknown, findingId?: unknown) => {
    const report = assertRun(runId).report;
    if (!report) throw new Error('The verification report is not ready.');
    const text = typeof findingId === 'string'
      ? generateFindingHandoffMarkdown(report, findingId)
      : generateAiHandoffMarkdown(report);
    clipboard.writeText(text);
  });
}

async function probeTool(id: string, command: string, args: string[], required: boolean, remediation: string) {
  try {
    const result = await execFileAsync(command, args, { timeout: 5000, windowsHide: true });
    return { id, label: id === 'node' ? 'Node.js' : id[0].toUpperCase() + id.slice(1), required, available: true, version: `${result.stdout}${result.stderr}`.trim(), remediation };
  } catch (error) {
    return { id, label: id === 'node' ? 'Node.js' : id[0].toUpperCase() + id.slice(1), required, available: false, remediation, version: error instanceof Error ? error.message : undefined };
  }
}

app.whenReady().then(async () => {
  settingsCache = { ...defaultSettings, ...(await readJson<Partial<DesktopSettings>>(settingsPath(), {})) };
  registerIpc();
  await createWindow();
});
let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  for (const run of runs.values()) {
    run.cancelling = true;
    if (run.worker?.connected) run.worker.send({ type: 'cancel' });
  }
  // Do not keep the application alive indefinitely if a child is wedged.
  setTimeout(() => {
    for (const run of runs.values()) {
      if (run.worker && !run.worker.killed) run.worker.kill();
    }
    app.exit(0);
  }, 5000).unref();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
