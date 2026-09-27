import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DetectionPreview, DesktopSettings, RunEvent, DoctorCapability } from '../shared/ipc.js';
import './styles.css';

type View = 'home' | 'overview' | 'findings' | 'evidence' | 'logs' | 'doctor' | 'settings';

function App() {
  const [view, setView] = useState<View>('home');
  const [projectPath, setProjectPath] = useState<string>();
  const [preview, setPreview] = useState<DetectionPreview>();
  const [target, setTarget] = useState<string>('.');
  const [trusted, setTrusted] = useState(false);
  const [runId, setRunId] = useState<string>();
  const [event, setEvent] = useState<RunEvent>();
  const [eventLog, setEventLog] = useState<RunEvent[]>([]);
  const [settings, setSettings] = useState<DesktopSettings>({ theme: 'system', defaultTimeoutMs: 30000, cleanWorkspace: true });
  const [appVersion, setAppVersion] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [doctorCapabilities, setDoctorCapabilities] = useState<DoctorCapability[]>();
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [logsPaused, setLogsPaused] = useState(false);

  useEffect(() => {
    void window.releaseproof.getAppVersion().then(setAppVersion).catch((e) => setError(userError(e)));
    void window.releaseproof.getSettings().then(setSettings).catch((e) => setError(String(e)));
    void window.releaseproof.listRecent().then(setRecent).catch(() => {});
    return window.releaseproof.subscribeRun((next) => {
      if (next.type === 'started') setRunId(next.runId);
      setEvent(next);
      setEventLog((items) => logsPaused ? items : [...items, next].slice(-200));
    });
  }, [logsPaused]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);

  const report = event?.type === 'finished' ? event.report : undefined;

  async function selectProject(path?: string) {
    setError(undefined);
    try {
      const chosen = path ?? await window.releaseproof.chooseProject();
      if (!chosen) return;
      const detected = await window.releaseproof.previewProject(chosen);
      setProjectPath(chosen); setPreview(detected); setTarget(detected.profile.targetCandidates.find((candidate) => candidate.runnable)?.path ?? '.'); setRecent((items) => [chosen, ...items.filter((item) => item !== chosen)].slice(0, 8)); setTrusted(false); setView('home');
    } catch (e) { setError(userError(e)); }
  }
  async function verify() {
    if (!projectPath || !preview || !trusted) return;
    try {
      const id = await window.releaseproof.startVerification({ projectPath, target: target === '.' ? undefined : target, trusted, timeoutMs: settings.defaultTimeoutMs });
      const started: RunEvent = { type: 'started', runId: id };
      setRunId(id); setEvent(started); setEventLog([started]); setView('overview');
    } catch (e) { setError(userError(e)); }
  }
  async function cancel() { if (runId) await window.releaseproof.cancelVerification(runId).catch((e) => setError(userError(e))); }
  async function copy(findingId?: string) { if (runId) await window.releaseproof.copyFix(runId, findingId).then(() => setError('Copied sanitized handoff to clipboard.')).catch((e) => setError(userError(e))); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✓</span><span>ReleaseProof</span></div>
      <nav aria-label="Primary navigation">
        {(['home', 'overview', 'findings', 'evidence', 'logs', 'doctor', 'settings'] as View[]).map((item) => <button key={item} className={view === item ? 'nav-item active' : 'nav-item'} onClick={() => setView(item)} disabled={item !== 'home' && !report && item !== 'doctor' && item !== 'settings'}>{label(item)}</button>)}
      </nav>
      <div className="sidebar-foot">Local-first · no telemetry</div>
    </aside>
    <main className="content">
      <header className="topbar"><div className="project-title">{preview?.profile.name ?? 'Choose a project'}{projectPath && <span className="muted"> · {projectPath}</span>}</div><div className="run-state">{event?.type === 'progress' ? event.step : report?.verdict ?? 'Idle'}</div></header>
      {error && <div className="toast" role="status" onClick={() => setError(undefined)}>{error}</div>}
      {view === 'home' && <Home projectPath={projectPath} preview={preview} target={target} setTarget={setTarget} recent={recent} trusted={trusted} setTrusted={setTrusted} selectProject={selectProject} verify={verify} report={report} />}
      {view === 'overview' && <Overview report={report} event={event} cancel={cancel} verify={verify} copy={() => copy()} open={(kind: 'html' | 'fix' | 'directory') => runId && window.releaseproof.openArtifact(runId, kind).catch((e) => setError(userError(e)))} />}
      {view === 'findings' && <Findings report={report} copy={copy} selectedFindingId={selectedFindingId} selectFinding={setSelectedFindingId} />}
      {view === 'evidence' && <Evidence report={report} selectedFindingId={selectedFindingId} />}
      {view === 'logs' && <Logs events={eventLog} paused={logsPaused} setPaused={setLogsPaused} clear={() => setEventLog([])} />}
      {view === 'doctor' && <Doctor projectPath={projectPath} preview={preview} capabilities={doctorCapabilities} run={async () => { if (!projectPath) return; try { setDoctorCapabilities((await window.releaseproof.runDoctor(projectPath)).capabilities); } catch (e) { setError(userError(e)); } }} />}
      {view === 'settings' && <Settings settings={settings} version={appVersion} update={async (patch) => setSettings(await window.releaseproof.updateSettings(patch))} />}
    </main>
  </div>;
}

function Home(props: { projectPath?: string; preview?: DetectionPreview; target: string; setTarget: (value: string) => void; recent: string[]; trusted: boolean; setTrusted: (v: boolean) => void; selectProject: (p?: string) => void; verify: () => void; report?: any }) {
  return <section className="screen home-screen"><div className="eyebrow">EVIDENCE OVER CONFIDENCE</div><h1>Your AI says it’s done.<br /><span>ReleaseProof checks if it actually ships.</span></h1><p className="lede">Verify install, build, runtime, routes and browser behavior locally before you ship.</p><button className="primary-button" onClick={() => props.selectProject()}>{props.projectPath ? 'Choose another project' : 'Choose Project'}</button><div className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const path = (e.dataTransfer.files[0] as File & { path?: string } | undefined)?.path; if (path) props.selectProject(path); }}>Drop a project folder here</div>{props.preview && <div className="detection-panel"><div className="panel-heading">Detected targets</div><strong>{props.preview.profile.name}</strong><div className="muted">{props.preview.profile.frameworks.map((f: any) => f.name).join(', ') || 'Standard project'} · {props.preview.profile.packageManagers.map((p: any) => p.type).join(', ') || 'runtime pending'}</div><label className="target-picker">Runnable target<select value={props.target} onChange={(e) => props.setTarget(e.target.value)}>{props.preview.profile.targetCandidates.map((candidate: any) => <option key={candidate.path} value={candidate.path}>{candidate.path === '.' ? `${candidate.name} (root)` : `${candidate.path} — ${candidate.name}`}{candidate.runnable ? '' : ' · no start command'}</option>)}</select></label><div className="detection-grid"><span>Start</span><code>{props.preview.profile.targetCandidates.find((candidate: any) => candidate.path === props.target)?.commands.start ?? props.preview.profile.commands.start ?? 'not detected'}</code><span>Port</span><code>{props.preview.profile.ports[0] ?? 'allocated at run'}</code><span>Browser</span><code>{props.preview.profile.capabilities.browser ? 'Playwright capable' : 'API / HTTP'}</code></div><label className="trust"><input type="checkbox" checked={props.trusted} onChange={(e) => props.setTrusted(e.target.checked)} /> I understand project scripts may execute locally and access the network.</label><button className="primary-button" disabled={!props.trusted || !props.preview.profile.targetCandidates.find((candidate: any) => candidate.path === props.target)?.runnable} onClick={props.verify}>Verify Project</button></div>}{props.recent.length > 0 && <div className="recent"><div className="panel-heading">Recent projects</div>{props.recent.map((item) => <button className="recent-row" key={item} onClick={() => props.selectProject(item)}>{item}</button>)}</div>}</section>;
}

function Overview({ report, event, cancel, verify, copy, open }: any) { if (!report) { const active = event?.type === 'started' || event?.type === 'progress'; const failed = event?.type === 'error'; return <section className="screen"><div className="eyebrow">{active ? 'VERIFICATION IN PROGRESS' : failed ? 'VERIFICATION STOPPED' : 'OVERVIEW'}</div><h2>{active ? event?.type === 'progress' ? event.step : 'Preparing verification…' : failed ? 'Could not complete verification' : 'Ready to verify'}</h2>{active && <><div className="progress-track" aria-label="Verification in progress"><div className="progress-indicator" /></div><p className="lede">{event?.type === 'progress' ? event.message ?? 'ReleaseProof is collecting evidence for this phase.' : 'Starting the shared verification engine.'}</p><ol className="phase-list">{['Detecting project profile', 'Scanning for exposed secrets', 'Analyzing environment configuration', 'Creating isolated clean verification workspace', 'Running clean installation', 'Running production build', 'Starting production server', 'Verifying application in browser', 'Checking README as contract'].map((step) => <li key={step} aria-current={event?.type === 'progress' && event.step === step ? 'step' : undefined}>{step}</li>)}</ol><button className="danger-button" onClick={cancel}>Cancel verification</button></>}{failed && <><p role="alert">{event.message}</p><details><summary>Technical details</summary><pre className="evidence">{event.message}</pre></details><button className="primary-button" onClick={verify}>Retry verification</button></>}{!active && !failed && <p className="lede">Choose a project, inspect its detected target, then start verification.</p>}</section>; } const incomplete = report.verdict === 'INCOMPLETE'; return <section className="screen"><div className={`verdict ${report.verdict.toLowerCase()}`}><div><div className="eyebrow">{report.runStatus === 'cancelled' ? 'NO SHIPPING VERDICT' : 'VERIFICATION RESULT'}</div><h2>{report.verdict === 'READY' ? 'READY TO SHIP' : report.verdict === 'NOT_READY' ? 'NOT READY TO SHIP' : incomplete ? 'VERIFICATION INCOMPLETE' : 'VERIFICATION CANCELLED'}</h2><p>{report.counts.blockers} blockers · {report.counts.warnings} warnings · {report.counts.unknown} unknown · {Math.round(report.evidenceCoverage * 100)}% evidence coverage</p></div><div className="score">{report.score}<small>/100</small></div></div><div className="action-row"><button className="primary-button" onClick={verify}>Verify Again</button><button onClick={copy}>Copy for AI</button><button onClick={() => open('html')}>Open HTML report</button><button onClick={() => open('fix')}>Open RELEASEPROOF_FIX.md</button><button onClick={() => open('directory')}>Open report directory</button></div><div className="summary-grid"><Metric label="Target" value={report.projectName} /><Metric label="Duration" value={`${(report.durationMs / 1000).toFixed(1)}s`} /><Metric label="Browser" value={report.browserVerification.status} /><Metric label="Findings" value={String(report.checks.length)} /></div></section>; }
function Findings({ report, copy, selectedFindingId, selectFinding }: any) { const selected = report?.checks.find((check: any) => check.id === selectedFindingId); return <section className="screen"><div className="section-heading"><div><div className="eyebrow">INSPECT</div><h2>Findings</h2></div><button onClick={() => copy()}>Copy all issues for AI</button></div>{report?.checks.map((check: any) => <article className={`finding ${check.status}`} key={check.id} tabIndex={0} role="button" onClick={() => selectFinding(check.id)} onKeyDown={(event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') selectFinding(check.id); }}><div className="finding-status">{check.status.toUpperCase()}</div><div><strong>{check.title}</strong><p>{check.summary}</p><small>{check.id} · {check.category} · {check.evidence?.length ?? 0} evidence item(s)</small></div></article>)}{selected && <aside className="finding-detail"><div className="section-heading"><h3>{selected.title}</h3><button onClick={() => copy(selected.id)}>Copy Fix Prompt</button></div><p>{selected.summary}</p><p><strong>Classification:</strong> {selected.classification ?? selected.status}</p>{selected.remediation && <p><strong>Suggested next step:</strong> {selected.remediation}</p>}<p><strong>Evidence:</strong> {selected.evidence?.length ?? 0} item(s). Open Evidence to inspect the associated payloads.</p></aside>}</section>; }
function Evidence({ report, selectedFindingId }: any) { const checks = report?.checks.filter((check: any) => !selectedFindingId || check.id === selectedFindingId) ?? []; return <section className="screen"><div className="eyebrow">TRACEABILITY</div><h2>Evidence</h2>{selectedFindingId && <p className="muted">Filtered to finding {selectedFindingId}.</p>}{checks.flatMap((check: any) => (check.evidence ?? []).map((item: any, index: number) => <pre className="evidence" key={`${check.id}-${index}`}><span>{check.id} · {item.type}</span>{JSON.stringify(item, null, 2)}</pre>))}</section>; }
function Logs({ events, paused, setPaused, clear }: { events: RunEvent[]; paused: boolean; setPaused: (v: boolean) => void; clear: () => void }) { return <section className="screen"><div className="section-heading"><div><div className="eyebrow">LIVE OUTPUT</div><h2>Logs</h2></div><div className="action-row"><button onClick={() => setPaused(!paused)}>{paused ? 'Resume updates' : 'Pause updates'}</button><button onClick={clear}>Clear view</button></div></div><div className="log-box">{events.length === 0 ? 'Sanitized verification logs appear here during a run.' : events.map((item) => {
  if (item.type === 'progress') return `[${item.status}] ${item.step}${item.message ? ` — ${item.message}` : ''}`;
  if (item.type === 'error') return `[error] ${item.message}`;
  if (item.type === 'finished') return `[done] ${item.report.verdict} · ${item.report.score}/100`;
  return `[started] ${item.runId}`;
}).join('\n')}</div></section>; }
function Doctor({ projectPath, preview, capabilities, run }: { projectPath?: string; preview?: DetectionPreview; capabilities?: DoctorCapability[]; run: () => Promise<void> }) { return <section className="screen"><div className="eyebrow">SYSTEM CHECK</div><h2>System Doctor</h2>{!projectPath || !preview ? <p className="lede">Choose a project first to inspect its detected runtime requirements.</p> : <><p className="lede">Target: <code>{projectPath}</code></p><div className="summary-grid"><Metric label="Node" value={preview.profile.languages.some((item) => item === 'javascript' || item === 'typescript') ? 'Required' : 'Not required'} /><Metric label="Python" value={preview.profile.languages.includes('python') ? 'Required' : 'Not required'} /><Metric label="Browser" value={preview.profile.capabilities.browser ? 'Playwright capable' : 'HTTP/API checks'} /></div><button className="primary-button" onClick={() => void run()}>Run capability checks</button>{capabilities && <div className="doctor-list">{capabilities.map((capability) => <div className="finding" key={capability.id}><div className="finding-status">{capability.available ? 'AVAILABLE' : capability.required ? 'MISSING' : 'OPTIONAL'}</div><div><strong>{capability.label}</strong><p>{capability.version ?? 'Not detected'}</p>{!capability.available && capability.remediation && <small>{capability.remediation}</small>}</div></div>)}</div>}<p className="muted">A missing tool is a capability limitation, not proof that the checked project is broken.</p></>}</section>; }
function Settings({ settings, version, update }: { settings: DesktopSettings; version: string; update: (patch: Partial<DesktopSettings>) => Promise<void> }) { return <section className="screen"><div className="eyebrow">PREFERENCES</div><h2>Settings</h2><div className="setting-row"><span>ReleaseProof version</span><strong>{version || 'Loading…'}</strong></div><label className="setting-row">Theme<select value={settings.theme} onChange={(e) => void update({ theme: e.target.value as DesktopSettings['theme'] })}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="setting-row">Default startup timeout (ms)<input type="number" min="1000" max="600000" value={settings.defaultTimeoutMs} onChange={(e) => void update({ defaultTimeoutMs: Number(e.target.value) })} /></label><label className="setting-row"><input type="checkbox" checked={settings.cleanWorkspace} onChange={(e) => void update({ cleanWorkspace: e.target.checked })} /> Use a disposable clean workspace</label></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function label(item: View): string { return item === 'home' ? 'Home / Project' : item[0].toUpperCase() + item.slice(1); }
function userError(error: unknown): string { return error instanceof Error ? error.message : String(error); }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
