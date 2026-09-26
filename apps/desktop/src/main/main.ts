import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fork, ChildProcess } from 'node:child_process';
import { detectProject } from '@releaseproof/detector';
import { VerificationReportSchema } from '@releaseproof/schemas';
import type { DesktopSettings, DetectionPreview, RunEvent } from '../shared/ipc.js';

const defaultSettings: DesktopSettings = { theme: 'system', defaultTimeoutMs: 30000, cleanWorkspace: true };
const runs = new Map<string, { projectPath: string; report?: ReturnType<typeof VerificationReportSchema.parse>; worker?: ChildProcess }>();
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
function assertProjectPath(value: unknown): string {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('A canonical absolute project path is required.');
  return path.normalize(value);
}
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
      preload: path.join(__dirname, '../preload/index.js'),
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
    const canonical = assertProjectPath(projectPath);
    const profile = await detectProject(canonical);
    const recent = await readJson<string[]>(recentPath(), []);
    await writeJson(recentPath(), [canonical, ...recent.filter((item) => item !== canonical)].slice(0, 8));
    return { projectPath: canonical, profile, trustRequired: true };
  });
  ipcMain.handle('run:start', async (_event, input: { projectPath: unknown; target?: unknown; trusted?: unknown; timeoutMs?: unknown }) => {
    const projectPath = assertProjectPath(input?.projectPath);
    if (input?.trusted !== true) throw new Error('Trust acknowledgement is required before executing project code.');
    const runId = randomUUID();
    const workerPath = path.join(__dirname, '../worker/verify.js');
    const worker = fork(workerPath, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    runs.set(runId, { projectPath, worker });
    worker.on('message', (event: RunEvent) => {
      if (event.type === 'finished') {
        try {
          const parsed = VerificationReportSchema.parse(event.report);
          const run = runs.get(runId);
          if (run) run.report = parsed;
          send({ ...event, report: parsed });
        } catch (error) {
          send({ type: 'error', runId, message: `Verification report was invalid: ${error instanceof Error ? error.message : String(error)}` });
        }
      } else send(event);
    });
    worker.on('error', (error) => send({ type: 'error', runId, message: `Verification worker failed: ${error.message}` }));
    worker.on('exit', (code) => {
      if (code !== 0 && runs.has(runId) && !runs.get(runId)?.report) send({ type: 'error', runId, message: `Verification worker exited with code ${code ?? 'unknown'}.` });
    });
    worker.send({ runId, projectPath, target: typeof input?.target === 'string' ? input.target : undefined, timeoutMs: typeof input?.timeoutMs === 'number' ? input.timeoutMs : settingsCache.defaultTimeoutMs, cleanWorkspace: settingsCache.cleanWorkspace });
    return runId;
  });
  ipcMain.handle('run:cancel', async (_event, runId: unknown) => { assertRun(runId).worker?.send({ type: 'cancel' }); });
  ipcMain.handle('settings:get', async () => settingsCache);
  ipcMain.handle('settings:update', async (_event, patch: Partial<DesktopSettings>) => {
    if (!patch || typeof patch !== 'object') throw new Error('Settings update must be an object.');
    if (patch.theme !== undefined && !['system', 'dark', 'light'].includes(patch.theme)) throw new Error('Unknown theme.');
    if (patch.cleanWorkspace !== undefined && typeof patch.cleanWorkspace !== 'boolean') throw new Error('cleanWorkspace must be boolean.');
    if (patch.defaultTimeoutMs !== undefined && !Number.isFinite(Number(patch.defaultTimeoutMs))) throw new Error('defaultTimeoutMs must be numeric.');
    settingsCache = { ...settingsCache, ...patch, defaultTimeoutMs: Math.max(1000, Math.min(600000, Number(patch.defaultTimeoutMs ?? settingsCache.defaultTimeoutMs))) };
    await writeJson(settingsPath(), settingsCache);
    return settingsCache;
  });
  ipcMain.handle('recent:list', async () => readJson<string[]>(recentPath(), []));
  ipcMain.handle('recent:remove', async (_event, projectPath: unknown) => {
    const value = assertProjectPath(projectPath);
    const recent = (await readJson<string[]>(recentPath(), [])).filter((item) => item !== value);
    await writeJson(recentPath(), recent.slice(0, 8));
  });
  ipcMain.handle('artifact:open', async (_event, runId: unknown, kind: unknown) => {
    const run = assertRun(runId);
    if (!run.report) throw new Error('The verification report is not ready.');
    if (kind !== 'html' && kind !== 'fix' && kind !== 'directory') throw new Error('Unknown artifact type.');
    const root = path.resolve(run.projectPath);
    const target = kind === 'directory' ? path.join(root, '.releaseproof') : path.join(root, '.releaseproof', kind === 'html' ? 'report.html' : 'RELEASEPROOF_FIX.md');
    await fs.access(target);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Artifact path is outside the selected project.');
    if (kind === 'directory') await shell.openPath(target); else await shell.openPath(target);
  });
  ipcMain.handle('artifact:copy', async (_event, runId: unknown, findingId?: unknown) => {
    const report = assertRun(runId).report;
    if (!report) throw new Error('The verification report is not ready.');
    const finding = typeof findingId === 'string' ? report.checks.find((check) => check.id === findingId) : undefined;
    const text = finding ? `${finding.title}\n\n${finding.summary}\n\nClassification: ${finding.classification ?? 'not specified'}\nRemediation: ${finding.remediation ?? 'See evidence and retry verification.'}` : `ReleaseProof ${report.verdict}\nScore: ${report.score}/100\nEvidence coverage: ${Math.round(report.evidenceCoverage * 100)}%\n${report.checks.filter((check) => check.status === 'block' || check.status === 'unknown' || check.status === 'warn').map((check) => `- ${check.id}: ${check.title} — ${check.summary}`).join('\n')}`;
    clipboard.writeText(text);
  });
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
    if (run.worker?.connected) run.worker.send({ type: 'cancel' });
  }
  // Do not keep the application alive indefinitely if a child is wedged.
  setTimeout(() => app.exit(0), 3000).unref();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
