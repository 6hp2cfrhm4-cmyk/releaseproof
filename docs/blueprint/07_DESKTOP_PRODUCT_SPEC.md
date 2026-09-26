# Desktop product experience

This file owns UX, not verifier logic. Desktop uses shared Core/report per [03](03_TARGET_ARCHITECTURE.md). Default dark, minimal, compact and professional; design rules in [09](09_DESIGN_SYSTEM.md).

## Information architecture

One window with a narrow left rail: **Project** (Home/chooser and current run), **Findings**, **Evidence**, **Logs**, **System Check**, and a bottom **Settings** entry. `Overview` is the default content inside Project once a run exists, not a redundant extra navigation item. The currently selected project/target and run status remain visible in the header. No 15-item sidebar or generic dashboard. Findings/Evidence/Logs can be disabled with helpful empty state before first run.

## Project/Home

**DESKTOP-SELECT-001 · P0:** Landing view shows `Choose Project`, drag-and-drop zone for a folder, and up to 8 recent project paths (name + path + last result/time). Picker must accept directories only. Dropped files are rejected with a clear message. Paths are canonicalized and existence checked; missing recent paths can be removed, not silently opened. Selection starts a **detection preview only**, never automatically executes scripts. Preview shows detected candidate targets, stack, package manager, expected commands, port, browser/API capability, required runtimes and uncertainty. If multiple targets, selection is mandatory; if none, prompt target/config instead of enabling misleading Verify.

**DESKTOP-VERIFY-001 · P0:** Primary `Verify Project` button is enabled only after a valid target and trust acknowledgement for first run. Confirm that project install/build/start scripts can execute local code and may access network; distinguish clean workspace from security isolation. A run shows current phase, elapsed time, compact step list, latest redacted log line, and `Cancel`. Disable duplicate Verify; switch to `Verify Again` after terminal result, preserving selected target and showing that it creates a new run. Changed source/config since prior run is signaled; never reuse old result as fresh.

**DESKTOP-PROGRESS-001 · P0:** Progress is event-driven, not invented percentage. Each phase has pending/running/pass/warn/block/unknown/skipped/cancelled; optional indeterminate spinner and elapsed time. Browser/API/cleanup phases are visible. Cancel sends worker abort and keeps UI responsive; after cleanup, show `Cancelled — no verdict`, optional technical cleanup error, and Verify Again. Window close during run follows [08](08_DESKTOP_TECHNICAL_ARCHITECTURE.md). No READY banner before cleanup and report persistence finish.

## Overview and verdict

**DESKTOP-RESULT-001 · P0:** Three exact labels: `READY TO SHIP`, `NOT READY TO SHIP`, `VERIFICATION INCOMPLETE`. Show verdict first, then score `/100`, evidence coverage/confidence, selected target, duration, blocker/warning/unknown counts, browser mode and route coverage. A low-confidence or fallback run cannot visually look fully green. Explain INCOMPLETE as “could not verify,” with next action (install tool, supply disposable env, choose target, retry). Verified blocker always remains NOT READY even if an unrelated step is unavailable. Top three actionable findings and buttons: `View Findings`, `Copy all issues for AI`, `Open HTML report`, `Open report directory`, `Verify Again`. `Open RELEASEPROOF_FIX.md` is available on non-ready/incomplete and can also show a no-issues summary for READY.

## Findings and details

**DESKTOP-FINDING-001 · P0:** List defaults to blockers → unknown → warnings → passes; filters for status/category and search by title/ID/path. Rows show status, category, title, one-line summary and evidence count. Clicking opens a detail pane with classification, what was observed vs inferred, exact run phase, affected files when known, bounded log/evidence excerpts, reproduction and remediation. `Copy Fix Prompt` copies only this finding's sanitized handoff, with confirmation toast. Do not call an unknown “fix this bug”; offer action to make verification possible. Passes may be collapsed but remain inspectable.

## Evidence and logs

**DESKTOP-EVIDENCE-001 · P1:** Evidence view groups by phase and route; typed cards for command/HTTP/process/browser/filesystem/environment/screenshots. Show timestamps, source, capability, redaction marker, bounded previews, and a button to reveal technical details **from already sanitized data**. Screenshots open in-app safely. No arbitrary HTML rendering of target output. Evidence gap says “Not collected” and why. Links to local files go through validated main-process open operation.

**DESKTOP-LOGS-001 · P1:** Logs view streams a bounded ring buffer with phase, timestamp and stdout/stderr source; pause autoscroll, search, copy sanitized selection. No raw secrets; no infinite memory growth. Before first run, explain logs will appear here. Worker crash or truncated output is visible. `Technical details` for errors includes command, exit/timeout, selected toolchain and redacted tail, never internal stack as the only user-facing message.

## System Check and Settings

**DESKTOP-DOCTOR-001 · P0:** System Check runs same capability probe as CLI Doctor for selected target: bundled Desktop runtime, project Node/version, manager/Corepack, Python/venv, Chromium, native build capability when detectable, disk/temp permissions, network indication. Mark required/optional/not applicable separately; remediation is concrete (“Node.js could not be found — install Node 20/22 to verify this project”), not `spawn ENOENT`. Recheck button; no false “all good” when required capability absent. Desktop launching itself must not require system Node/pnpm.

**DESKTOP-SETTINGS-001 · P1:** Theme `System | Dark | Light` with immediate preview and persisted choice. Show clean-workspace default, default timeout, browser availability and report location; advanced config opens the project config file rather than duplicating complex editor logic. Recent-project clear/remove controls. Local persistence includes only recent paths, theme and nonsecret settings. Never save credentials, env values or copied AI text. Explain `.env` opt-in and trust model.

## Error taxonomy and accessibility

Map typed errors to plain language: target missing/ambiguous, unsupported project, missing Node/Python/manager, incompatible lockfile, missing browser, occupied port, external DB/env, verified build/start failure, permission/path issue, cancellation, Core internal error, cleanup residue. Each message has `What happened`, `What to do`, optional `Technical details`; do not treat tool absence as app failure. Keyboard navigation, logical focus after dialogs/runs, visible focus, screen-reader status announcements, 44px-ish hit targets where practical and non-color status labels are required. See [09](09_DESIGN_SYSTEM.md).
