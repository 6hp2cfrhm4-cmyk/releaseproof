import type { VerificationReport } from '@releaseproof/schemas';

export interface DetectionPreview {
  projectPath: string;
  profile: Awaited<ReturnType<typeof import('@releaseproof/detector').detectProject>>;
  trustRequired: boolean;
}

export interface DesktopSettings {
  theme: 'system' | 'dark' | 'light';
  defaultTimeoutMs: number;
  cleanWorkspace: boolean;
}

export interface DoctorCapability {
  id: string;
  label: string;
  required: boolean;
  available: boolean;
  version?: string;
  remediation?: string;
}

export type RunEvent =
  | { type: 'started'; runId: string }
  | { type: 'progress'; runId: string; step: string; status: 'running' | 'done' | 'fail'; message?: string }
  | { type: 'finished'; runId: string; report: VerificationReport }
  | { type: 'error'; runId: string; message: string };
export type WorkerEvent =
  | { type: 'started' }
  | { type: 'progress'; step: string; status: 'running' | 'done' | 'fail'; message?: string }
  | { type: 'finished'; report: VerificationReport }
  | { type: 'error'; message: string };

export interface DesktopApi {
  getAppVersion(): Promise<string>;
  chooseProject(): Promise<string | undefined>;
  previewProject(projectPath: string): Promise<DetectionPreview>;
  startVerification(input: { projectPath: string; target?: string; trusted: boolean; timeoutMs?: number }): Promise<string>;
  cancelVerification(runId: string): Promise<void>;
  subscribeRun(listener: (event: RunEvent) => void): () => void;
  getSettings(): Promise<DesktopSettings>;
  updateSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings>;
  listRecent(): Promise<string[]>;
  removeRecent(projectPath: string): Promise<void>;
  runDoctor(projectPath: string): Promise<{ capabilities: DoctorCapability[]; ready: boolean }>;
  copyFix(runId: string, findingId?: string): Promise<void>;
  openArtifact(runId: string, kind: 'html' | 'fix' | 'directory'): Promise<void>;
}
