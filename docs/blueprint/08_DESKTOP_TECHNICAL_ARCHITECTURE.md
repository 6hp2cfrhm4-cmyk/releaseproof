# Desktop technical architecture

Technology is fixed for this milestone: **Electron + React + TypeScript + Vite**. Use existing TypeScript Core directly; no Rust/Tauri rewrite. The renderer never runs verification logic or project commands.

## Processes and IPC

**DESKTOP-IPC-001 · P0:** `renderer (nodeIntegration:false, contextIsolation:true, sandbox:true where compatible)` → typed preload with a **frozen allowlisted API** → Electron main validation/authorization → dedicated utility process (preferred) or child Node worker → shared `packages/core` `verifyProject`. Do not expose `ipcRenderer`, Node `fs`, `child_process`, arbitrary shell, arbitrary URL open or generic channel invocation to renderer. CSP forbids remote scripts, inline eval and unapproved navigation; use Vite assets from app package only. Deny `window.open`, arbitrary navigation and new-window events; external links may open via main only after explicit allowlist/confirmation.

Typed preload surface (conceptual): `chooseProject(): Promise<ProjectSelection>`, `previewProject(path): Promise<DetectionPreview>`, `startVerification(request): Promise<runId>`, `cancelVerification(runId): Promise<void>`, `subscribeRun(runId, callback): unsubscribe`, `loadReport(runId): Promise<ReportDTO>`, `doctor(target?): Promise<DoctorDTO>`, `openArtifact(kind, runId): Promise<void>`, `copyText(kind, runId, findingId?): Promise<void>`, `getSettings/updateSettings`, `listRecent/removeRecent`. Main validates path, runId, finding ID, enum and payload size for each call using shared schemas; authorization binds run IDs to selected target and known generated artifacts. `openArtifact` cannot accept raw path from renderer.

**DESKTOP-WORKER-001 · P0:** One worker per active run (or an explicitly bounded queue), unique run ID, IPC messages `started`, `phase`, `log`, `finding`, `finished`, `cancelled`, `workerError`. Messages carry schema version, sequence, timestamp; main validates and redacts before forwarding. Worker performs Core work with AbortSignal and owns its child-process registry. Main has a watchdog and treats worker death as internal/incomplete, never READY. Cap event/log size and retain bounded history for late subscribers. CLI uses the same Core API independently; no renderer-only check.

## Cancellation and close

**DESKTOP-LIFE-001 · P0:** Cancel is idempotent: main sends abort → worker stops phases and gracefully closes browser/owned children → bounded grace deadline → main force-terminates worker/tree only if needed → confirm port/temp cleanup → terminal Cancelled event. On window close during run, show a compact “verification will stop” choice or cancel automatically with clear default; never orphan project servers. App quit, worker crash and OS shutdown use same cleanup path. Do not kill a foreign process by port. Tests inspect actual process/port state on Windows and POSIX.

## Main and persistence

Main owns directory picker (`openDirectory`), recent-project store, theme/settings store, clipboard, safe artifact open, menu, single-instance behavior, update/about metadata. Store under OS app-data path, atomic JSON write, schema validate on read; paths only, no env values/tokens. If a recent path disappears, retain removable stale entry with message. Reports remain in project `.releaseproof`, not copied into app state. Do not auto-upload anything.

## Build and packaging

`apps/desktop` is now a pnpm workspace package with separate main/preload/renderer builds, a forked worker and an electron-builder NSIS configuration. The current code is an implementation baseline, not completion: worker event schemas, IPC runtime validation, bounded streams, packaged browser strategy, license notices and installed-app E2E still need to meet this contract. Package includes Electron runtime and shared Core/CLI-independent dependencies. Pin builder versions in the lockfile and keep an explicit asset allowlist. `asar` layout must permit worker execution and any native/runtime assets; test the **installed** app, not just Vite dev. Installer requirements in [14](14_CI_CD_AND_RELEASE.md). All binaries/signing claims must be evidenced; unsigned development installer may show SmartScreen warning and must be labeled accordingly.

## Parity invariant

**DESKTOP-PARITY-001 · P0:** Given identical target, source snapshot, normalized config and toolchain, CLI and Desktop produce the same verdict, score, finding IDs/status/classification and browser capability. Run IDs/timestamps/artifact paths may differ. A five-fixture E2E parity suite (healthy, build failure, runtime failure, external dependency, browser issue) is mandatory. The UI formats fields; it never recomputes them.
