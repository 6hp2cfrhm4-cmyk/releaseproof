import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, DesktopSettings, RunEvent } from '../shared/ipc.js';

const api: DesktopApi = {
  chooseProject: () => ipcRenderer.invoke('project:choose'),
  previewProject: (projectPath) => ipcRenderer.invoke('project:preview', projectPath),
  startVerification: (input) => ipcRenderer.invoke('run:start', input),
  cancelVerification: (runId) => ipcRenderer.invoke('run:cancel', runId),
  subscribeRun: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: RunEvent) => listener(payload);
    ipcRenderer.on('run:event', wrapped);
    return () => ipcRenderer.removeListener('run:event', wrapped);
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<DesktopSettings>) => ipcRenderer.invoke('settings:update', settings),
  listRecent: () => ipcRenderer.invoke('recent:list'),
  removeRecent: (projectPath) => ipcRenderer.invoke('recent:remove', projectPath),
  runDoctor: (projectPath) => ipcRenderer.invoke('doctor:run', projectPath),
  copyFix: (runId, findingId) => ipcRenderer.invoke('artifact:copy', runId, findingId),
  openArtifact: (runId, kind) => ipcRenderer.invoke('artifact:open', runId, kind),
};
contextBridge.exposeInMainWorld('releaseproof', Object.freeze(api));
